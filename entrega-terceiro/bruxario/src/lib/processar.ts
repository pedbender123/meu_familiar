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
export async function processarPedido(pedidoId: string): Promise<void> {
  const pedido = buscarPedido(pedidoId);
  if (!pedido) return;
  if (pedido.status !== 'pago' && pedido.status !== 'erro') return;

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

    const leitura = await gerarLeitura({
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
     * **A entrega é o e-mail com o PDF.** É o produto inteiro.
     *
     * Não há conta, não há plataforma, não há link mágico para o cliente. Ele
     * compra uma leitura, ela chega na caixa de entrada, e o link da revelação
     * fica público pelo prazo do produto para ele reler e compartilhar.
     */
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
      // O link da revelação continua de pé: se o e-mail falhar, a pessoa
      // ainda abre pela aba que ficou aberta. Não derruba a entrega.
      console.error(`[processarPedido] e-mail da revelação falhou no ${pedidoId}:`, erro);
      registrarEvento('revelacao_email_falhou', pedidoId);
    }
  } catch (erro) {
    console.error(`[processarPedido] erro no pedido ${pedidoId}:`, erro);
    atualizarPedido(pedidoId, { status: 'erro' });
    registrarEvento('pedido_erro', pedidoId);
  }
}
