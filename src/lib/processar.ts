import fs from 'fs';
import path from 'path';
import { buscarPedido, atualizarPedido, registrarEvento } from './db';
import { FAMILIARES, type FamiliarId, type LuaId } from './familiares';
import { calcularSignos } from './astro';
import { gerarLeitura } from './leitura';
import { gerarArtes } from './arte';
import { gerarPdf } from './pdf';
import { gerarNarracao, textoDaLeituraParaNarrar } from './narracao';
import { pastaDoPedido } from './caminhos';
import { centavosDeNarracao } from './custos';
import { registrarUsoDeCupom } from './cupons';
import { enviarContaCriada, enviarCompraConfirmada, enviarRevelacao } from './email';
import {
  garantirConta,
  buscarConta,
  criarTokenMagico,
  VALIDADE_DO_LINK_MIN,
} from './autenticacao';
import { ITENS } from './quiz/itens';
import { produtoDe } from './produtos';
import { DESCRICAO_DOS_EIXOS, type Eixo } from './quiz/eixos';
import { FAMILIARES as TODOS } from './familiares';
import { criarAssinatura, assinaturasAtivasDaConta } from '../nucleo/assinaturas';
import { entregarChaveDaPlataforma } from './acesso-plataforma';

/**
 * Traduz o perfil numérico para PALAVRAS antes de mandar ao Gemini.
 *
 * Mandar z-score cru faria o modelo citar número na leitura, que é a última
 * coisa que o produto quer — e ele nem interpretaria bem. "Bem acima da média
 * em agência" é matéria-prima utilizável; "agencia: 1.84" não é.
 */
export function descreverPerfil(perfilJson: string | null): string | undefined {
  if (!perfilJson) return undefined;
  try {
    const p = JSON.parse(perfilJson);
    const faixa = (z: number) =>
      z >= 1.5 ? 'bem acima da média'
      : z >= 0.5 ? 'acima da média'
      : z > -0.5 ? 'na média'
      : z > -1.5 ? 'abaixo da média' : 'bem abaixo da média';

    const eixos = (['agencia', 'comunhao', 'abertura', 'estabilidade'] as Eixo[])
      .map((e) => `  ${DESCRICAO_DOS_EIXOS[e].nome}: ${faixa(p.eixos?.[e] ?? 0)}`)
      .join('\n');

    const vizinhos = (p.afinidades ?? [])
      .slice(1, 3)
      .map((a: { familiar: keyof typeof TODOS }) => TODOS[a.familiar]?.nome)
      .filter(Boolean)
      .join(' e ');

    return `${eixos}\n  Também tem parentesco com: ${vizinhos}`;
  } catch {
    return undefined;
  }
}

/**
 * O que acontece quando o dinheiro entra.
 *
 * No funil novo, pagar NÃO é o fim do caminho — a pessoa pagou com três
 * cenas respondidas, e a leitura só nasce quando as outras vinte e três
 * fecharem. Este roteador decide qual dos dois mundos o pedido está:
 *
 *  - ritual completo (ou pedido antigo, criado antes da mudança) → gera tudo
 *    agora, como sempre foi;
 *  - ritual pendente → manda o e-mail com o link de continuar e espera. Quem
 *    dispara a geração é o fim do ritual (`/api/ritual/[id]`) ou, se a
 *    pessoa sumir, o script de resgate — ninguém paga e fica sem nada.
 */
export async function aposPagamento(pedidoId: string): Promise<void> {
  const pedido = buscarPedido(pedidoId);
  if (!pedido) return;

  if (pedido.ritual_completo === 1) {
    processarPedido(pedidoId);
    return;
  }

  registrarEvento('ritual_pendente_apos_pagamento', pedidoId);
  if (pedido.exemplo === 1) return;
  // Quem veio do funil de anúncio sem aceitar os termos pagou sem deixar
  // e-mail. Não há para onde mandar — a tela pós-pagamento pede o endereço, e
  // é ela que dispara a entrega quando ele chegar.
  if (!pedido.email) {
    registrarEvento('email_pendente_apos_pagamento', pedidoId);
    return;
  }
  try {
    await enviarCompraConfirmada({
      nome: pedido.nome,
      email: pedido.email,
      pedidoId,
      nomeDoProduto: produtoDe(pedido.produto).nome,
    });
  } catch (erro) {
    // O e-mail é conveniência: a pessoa está NA TELA que redireciona para o
    // ritual. Falhar aqui não pode travar nada.
    console.error(`[aposPagamento] confirmação falhou no ${pedidoId}:`, erro);
    registrarEvento('email_falhou', pedidoId);
  }
}

/**
 * Roda em background após a confirmação de pagamento: calcula signos, gera a
 * leitura (Gemini), compõe as artes (sharp) e o PDF e marca `entregue`.
 * Nunca deve lançar para o chamador — erros marcam `erro` para o job de
 * reprocessamento pegar depois.
 *
 * A entrega tem dois caminhos, e os dois importam: o link (para onde
 * /obrigado/[id] redireciona sozinho) e o e-mail com o PDF anexado. O segundo
 * existe porque o link da Revelação **expira em 7 dias** — sem o anexo, quem
 * pagou R$ 9,80 ficaria sem cópia nenhuma depois disso.
 */
/**
 * Uma geração parada há mais que isto está morta, não em andamento.
 *
 * A geração inteira leva de dez a trinta segundos. Dez minutos é folgado o
 * bastante para nunca competir com uma que ainda está viva, e curto o
 * bastante para ninguém esperar meio dia por um PDF.
 */
export const GERACAO_MORTA_APOS_MS = 10 * 60 * 1000;

/**
 * Se este pedido pode entrar em geração agora.
 *
 * ── O buraco que isto fecha ───────────────────────────────────────────────
 *
 * Antes era `status !== 'pago' && status !== 'erro'` e pronto: qualquer
 * pedido em `gerando` era recusado em silêncio.
 *
 * A intenção era boa — não disparar duas gerações sobre o mesmo pedido. O
 * efeito foi outro: **quando uma geração morre no meio, o pedido fica em
 * `gerando` para sempre.** E o pior é que `pedidosTravados()` inclui
 * `gerando` de propósito, porque é exatamente ali que os mortos ficam. Ou
 * seja, `npm run reprocessar` listava o pedido, chamava esta função, ela
 * recusava sem dizer nada, e o script imprimia "Concluído".
 *
 * A rede de segurança existia, era chamada, e não pegava nada.
 *
 * Uma cliente que pagou o upgrade em 21/08 passou catorze horas assim. O
 * conserto é distinguir "gerando agora" de "morreu gerando", e a diferença é
 * o relógio: `atualizado_em` para de andar quando o processo cai.
 */
export function podeGerar(
  pedido: { status: string; atualizado_em?: string | null },
  agora = Date.now()
): boolean {
  if (pedido.status === 'pago' || pedido.status === 'erro') return true;

  if (pedido.status === 'gerando') {
    const carimbo = pedido.atualizado_em ? Date.parse(pedido.atualizado_em) : NaN;
    // Sem carimbo legível, assume morta: um pedido preso em `gerando` sem
    // saber desde quando é justamente o que precisa ser resgatado.
    if (!Number.isFinite(carimbo)) return true;
    return agora - carimbo > GERACAO_MORTA_APOS_MS;
  }

  return false;
}

export async function processarPedido(pedidoId: string): Promise<void> {
  const pedido = buscarPedido(pedidoId);
  if (!pedido) return;
  if (!podeGerar(pedido)) return;

  try {
    atualizarPedido(pedidoId, { status: 'gerando', tentativas: pedido.tentativas + 1 });
    registrarEvento('geracao_iniciada', pedidoId);

    const respostas = JSON.parse(pedido.respostas_json);
    const familiar = FAMILIARES[pedido.familiar as FamiliarId];
    const { signoSol, signoLua } = calcularSignos(respostas.dataNascimento, respostas.horaNascimento);

    // O resumo vai para o Gemini, então precisa ser TEXTO, não código. Antes
    // ele mandava "Pq01:0, Pq02:3" — o modelo não tem como saber o que isso
    // significa, e a leitura saía genérica justamente por falta desse material.
    // Agora vão as cenas e a escolha de cada uma, em palavras.
    /**
     * Pedido marcado como completo mas sem as 26 respostas é um bug de quem
     * marcou a flag, e antes deste guard virava `TypeError` aqui dentro — o
     * pedido caía em `erro` e o job de reprocessamento tentava de novo, para
     * sempre, batendo no mesmo undefined. Melhor parar com um evento legível.
     */
    const escolhas = respostas.quiz as Record<string, number> | undefined;
    if (!escolhas) {
      console.error(`[processarPedido] ${pedidoId} marcado completo sem as respostas do ritual`);
      registrarEvento('ritual_incompleto_na_geracao', pedidoId);
      // Volta para `pago`, não `erro`: o pedido está íntegro, só falta a
      // pessoa responder as 26 cenas. `erro` colocaria o job de
      // reprocessamento num laço infinito sobre um dado que não existe.
      atualizarPedido(pedidoId, { status: 'pago', ritual_completo: 0 });
      return;
    }

    const resumoRespostas = ITENS.map((item) => {
      const escolha = escolhas[item.id];
      const opcao = typeof escolha === 'number' ? item.opcoes[escolha] : undefined;
      return opcao ? `«${item.cena}» → "${opcao.texto}"` : null;
    })
      .filter(Boolean)
      .join('\n');

    const produto = produtoDe(pedido.produto);
    // Lido ANTES de garantir a conta: depois não dá mais para saber se ela já
    // existia, e o texto do e-mail depende disso.
    const contaJaExistia = !!buscarConta(pedido.email);

    /**
     * **A leitura já escrita é reaproveitada.**
     *
     * Antes esta chamada era incondicional, e isso quebrava duas coisas de
     * uma vez no upgrade de R$ 4,90:
     *
     * 1. **O texto mudava.** A pessoa já tinha lido a revelação dela. Pagar
     *    para desbloquear gráficos e narração e receber de volta um texto
     *    DIFERENTE não é um upgrade — é outro produto, e ela vai reparar.
     * 2. **Custava uma geração de IA inteira** para entregar arquivos que
     *    saem do texto que já existia. O upgrade é barato de propósito
     *    justamente porque não deveria ter custo marginal nenhum.
     *
     * O mesmo vale para o reprocessamento de um pedido que morreu no meio:
     * se a leitura sobreviveu, refazê-la é pagar duas vezes pela mesma coisa
     * e devolver um texto diferente a quem já tinha visto o primeiro.
     *
     * Só gera quando não existe nada — que é o caso de toda primeira entrega.
     */
    const leitura = pedido.leitura_json
      ? (JSON.parse(pedido.leitura_json) as Awaited<ReturnType<typeof gerarLeitura>>)
      : await gerarLeitura({
          nome: pedido.nome,
          familiar,
          signoSol,
          signoLua,
          lua: pedido.lua as LuaId,
          resumoRespostas,
          longa: produto.relatorioCompleto,
          perfil: descreverPerfil(pedido.perfil_json),
        });

    await gerarArtes(pedidoId, {
      nome: pedido.nome,
      familiar,
      lua: pedido.lua as LuaId,
      signoSol,
      signoLua,
      leitura,
    });

    // O PDF carrega a revelação inteira, inclusive os gráficos de quem comprou
    // a Completa — é a cópia que sobrevive ao link público expirando.
    await gerarPdf(pedidoId, {
      nome: pedido.nome,
      familiar,
      lua: pedido.lua as LuaId,
      leitura,
      signoSol,
      signoLua,
      perfil:
        produto.graficos && pedido.perfil_json
          ? JSON.parse(pedido.perfil_json)
          : null,
    });

    /**
     * Narração em áudio, só pra quem comprou um produto com `narracaoAudio`
     * (hoje, só a Completa). Roda AQUI, depois da leitura já existir — é o
     * texto dela, lido com a direção de voz que o próprio `gerarLeitura`
     * escreveu junto (`leitura.instrucoes_narracao`).
     *
     * Falhar aqui não pode impedir a entrega: a pessoa pagou pela leitura em
     * texto, PDF e imagens, e tudo isso já está pronto neste ponto. Sem a
     * narração, ela recebe o resto normalmente — só não vê o player.
     */
    let audioNarracaoOk = false;
    // Soma ao que o bilhete já custou antes do pagamento, em vez de
    // sobrescrever: o total do pedido é texto do bilhete + narração do
    // bilhete + leitura + narração da leitura.
    let custoIa = pedido.custo_ia_centavos ?? 0;
    custoIa += leitura.custoCentavos ?? 0;

    if (produto.narracaoAudio) {
      try {
        const textoNarrado = textoDaLeituraParaNarrar(leitura);
        const audio = await gerarNarracao({
          texto: textoNarrado,
          instrucoes: leitura.instrucoes_narracao,
          genero: familiar.genero,
        });
        const dir = pastaDoPedido(pedidoId);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'narracao.mp3'), audio);
        custoIa += centavosDeNarracao(textoNarrado.length);
        audioNarracaoOk = true;
      } catch (erroAudio) {
        console.error(`[processarPedido] narração falhou no pedido ${pedidoId}:`, erroAudio);
        registrarEvento('narracao_falhou', pedidoId);
      }
    }

    atualizarPedido(pedidoId, {
      status: 'entregue',
      signo_sol: signoSol,
      signo_lua: signoLua,
      leitura_json: JSON.stringify(leitura),
      audio_narracao: audioNarracaoOk ? 1 : 0,
      custo_ia_centavos: custoIa,
    });
    registrarEvento('pedido_entregue', pedidoId);

    // O uso do cupom é contado aqui, e não quando a pessoa digitou o código:
    // carrinho abandonado não pode queimar uma das dez vagas de um cupom. A
    // flag no pedido é o que impede reprocessamento e webhook repetido de
    // contarem o mesmo pedido duas vezes.
    if (pedido.cupom && !pedido.cupom_contabilizado) {
      registrarUsoDeCupom(pedido.cupom);
      atualizarPedido(pedidoId, { cupom_contabilizado: 1 });
    }

    /**
     * Amostras do mural não recebem e-mail nem viram conta.
     *
     * O endereço delas (`amostra+...@bruxario.com.br`) não existe, então cada
     * envio voltaria como bounce — e **bounce derruba a reputação do
     * domínio**, atrapalhando justamente as entregas que importam. Conta
     * também não: elas não são cliente de ninguém.
     */
    if (pedido.exemplo === 1) {
      registrarEvento('amostra_gerada', pedidoId);
      return;
    }

    // O e-mail é o último passo e falha isolada: se o Resend estiver fora do
    // ar, a revelação já está gerada e acessível pelo link. Marcar o pedido
    // como `erro` por causa disso faria o job de reprocessamento gerar tudo de
    // novo — inclusive uma segunda chamada paga ao Gemini.
    // Sem endereço não há envio nem conta. Não é falha: é um pedido que ainda
    // vai receber o e-mail pela tela pós-pagamento. `garantirConta('')` criaria
    // uma conta órfã que qualquer pedido futuro sem e-mail herdaria — é o pior
    // desfecho possível, porque daria acesso à revelação de outra pessoa.
    if (!pedido.email) {
      registrarEvento('entrega_sem_email', pedidoId);
      return;
    }

    /**
     * **Quem PAGOU recebe o familiar por e-mail. Todo mundo recebe o acesso.**
     *
     * Houve um momento em que o familiar deixou de ir por e-mail: a ideia era
     * que a pessoa entrasse na plataforma para buscá-lo e, de quebra, visse o
     * Oráculo e o calendário. Faz sentido para quem entra de graça — não tem
     * o que reclamar de um brinde que exige uma visita.
     *
     * Para quem pagou, não. Ela comprou uma leitura; segurar a entrega atrás
     * de um login é transformar produto entregue em produto a resgatar, e é o
     * tipo de coisa que gera pedido de reembolso com razão.
     *
     * Então os dois e-mails saem, nesta ordem: a revelação (com o PDF anexo)
     * se houve pagamento, e a chave da plataforma sempre. Um entrega o que
     * foi comprado; o outro abre a porta do resto.
     */
    const comprou = (pedido.bruto_centavos ?? 0) > 0;
    if (comprou) {
      try {
        await enviarRevelacao({
          nome: pedido.nome,
          email: pedido.email,
          pedidoId,
          produtoId: pedido.produto,
          nomeFamiliar: familiar.nome,
          nomeSecreto: leitura.nome_secreto,
          expiraEm: pedido.expira_em,
        });
        registrarEvento('revelacao_enviada', pedidoId);
      } catch (erro) {
        // A conta abaixo é o outro caminho até a mesma revelação: se este
        // e-mail falhar, a pessoa ainda entra e lê. Não derruba a entrega.
        console.error(`[processarPedido] e-mail da revelação falhou no ${pedidoId}:`, erro);
        registrarEvento('revelacao_email_falhou', pedidoId);
      }
    }

    /**
     * **Todo comprador ganha conta**, não só a Completa.
     *
     * A revelação fica registrada nela para sempre — o que a Revelação não tem
     * é o link público. Isso resolve a pior falha do desenho anterior: alguém
     * pagar R$ 9,80, deixar passar sete dias e perder o que comprou.
     *
     * SPEC 0.5.1: "conta em vez de download" — "seu familiar está no seu
     * Bruxário" é outra categoria de produto que "baixe seu PDF".
     */
    /**
     * **A conta nasce agora; a CHAVE não sai agora.**
     *
     * Até 19/08 o e-mail com o link de acesso saía aqui, para todo mundo, no
     * mesmo instante da entrega. Isso entregava a plataforma inteira antes de
     * a pessoa ter olhado a oferta — e a tela de oferta, que é o único
     * momento de atenção total do funil, passava a competir com um e-mail que
     * já tinha dado tudo.
     *
     * Agora a chave sai por dois caminhos, e nenhum deles é este:
     *
     *  - **comprou** → `entregarChaveDaPlataforma` no caminho do pagamento,
     *    na hora, porque ela pagou para entrar;
     *  - **não comprou** → `scripts/acesso-gratis.ts`, horas depois, com o
     *    convite para explorar.
     *
     * A conta em si continua sendo criada aqui: ela é onde a revelação fica
     * registrada para sempre, e existir sem ninguém ter entrado nela não
     * custa nada. O que não existe ainda é o token que abre a porta.
     */
    try {
      garantirConta(pedido.email);
      registrarEvento(contaJaExistia ? 'conta_reencontrada' : 'conta_criada', pedidoId);

      /**
       * **Quem pagou entra agora; quem não pagou entra depois.**
       *
       * A chave da plataforma sai na hora para quem comprou — ela pagou, e
       * fazer alguém esperar horas pelo acesso ao que acabou de comprar é
       * inventar um problema que não existia.
       *
       * Quem entrou de graça recebe pelo cron de horas depois
       * (`scripts/acesso-gratis.ts`): a oferta precisa do momento dela antes
       * de a plataforma inteira chegar por e-mail.
       */
      if (comprou) {
        await entregarChaveDaPlataforma({
          email: pedido.email,
          nome: pedido.nome,
          pedidoId,
          nomeFamiliar: familiar.nome,
          nomeSecreto: leitura.nome_secreto,
          contaNova: !contaJaExistia,
        });
      }
    } catch (erroConta) {
      console.error(`[processarPedido] conta falhou no pedido ${pedidoId}:`, erroConta);
      registrarEvento('conta_falhou', pedidoId);
    }
  } catch (erro) {
    console.error(`[processarPedido] erro no pedido ${pedidoId}:`, erro);
    atualizarPedido(pedidoId, { status: 'erro' });
    registrarEvento('pedido_erro', pedidoId);
  }
}
