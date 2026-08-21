import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { calcularSignos, calcularFaseDaLua } from '@/lib/astro';
import {
  atualizarPedido,
  criarPedido,
  rascunhoVirouPedido,
  registrarEvento,
} from '@/lib/db';
import { validarEmail, validarNome } from '@/lib/validacao';
import { calcularExpiracao, ehProdutoValido, PRODUTO_PADRAO, produtoDe } from '@/lib/produtos';
import { precoComDesconto } from '@/lib/preco';
import { processarPedido, descreverPerfil } from '@/lib/processar';
import { excedeuLimite } from '@/lib/rate-limit';
import { ITENS } from '@/lib/quiz/itens';
import { pontuar, type Respostas } from '@/lib/quiz/pontuacao';
import { aplicarDesempate, opcoesDeDesempate } from '@/lib/quiz/desempate';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { gerarVeu } from '@/lib/arte';
import { coordenadaDoEstado } from '@/lib/coordenadas';
import { gerarMensagemDoFamiliar } from '@/lib/teaser';

/**
 * Fecha o ritual: pontua, decide o familiar e cria o pedido.
 *
 * ── Duas mudanças estruturais em relação à versão anterior ────────────────
 *
 * 1. **O signo saiu da conta.** Antes, `calcularFamiliar(respostas, elemento
 *    Solar)` usava o elemento do signo como desempate — e com 8 itens para 12
 *    saídas o desempate era frequente, então na prática quem decidia era o
 *    signo (SPEC 2.1). Agora o motor é o circumplexo e o signo tem peso ZERO;
 *    ele volta só como textura da leitura.
 * 2. **Empate devolve a decisão para a pessoa.** Quando os dois primeiros
 *    ficam dentro do limiar, a rota **não cria pedido**: devolve as duas
 *    opções para o cliente mostrar a 27ª pergunta, e espera um segundo POST
 *    com a escolha. Nada é guardado no meio — as respostas continuam com o
 *    cliente, então não há rascunho para expirar nem limpar.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`quiz:${ip}`)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas. Aguarde um instante.' },
      { status: 429 }
    );
  }

  const corpo = await req.json();
  const {
    respostas,
    nome,
    email,
    dataNascimento,
    horaNascimento,
    cidadeNascimento,
    estadoNascimento,
    produto,
    desempate,
    cupom,
  } = corpo ?? {};

  if (!respostas || typeof respostas !== 'object') {
    return NextResponse.json({ erro: 'Respostas do ritual ausentes.' }, { status: 400 });
  }

  const faltando = ITENS.filter((item) => {
    const escolha = (respostas as Respostas)[item.id];
    return typeof escolha !== 'number' || escolha < 0 || escolha > 3;
  });
  if (faltando.length > 0) {
    return NextResponse.json(
      { erro: `Faltou responder ${faltando.length} cena(s) do ritual.` },
      { status: 400 }
    );
  }

  if (!validarNome(nome)) {
    return NextResponse.json({ erro: 'Nome inválido.' }, { status: 400 });
  }
  if (!validarEmail(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }
  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    return NextResponse.json({ erro: 'Data de nascimento inválida.' }, { status: 400 });
  }

  let resultado = pontuar(respostas as Respostas);

  // Empate sem escolha ainda: devolve a 27ª pergunta e não cria nada.
  if (resultado.empate && !desempate) {
    const opcoes = opcoesDeDesempate(resultado);
    return NextResponse.json({ empate: { entre: opcoes } });
  }

  let desempatadoPelaPessoa = false;
  if (desempate) {
    const aplicado = aplicarDesempate(resultado, desempate as FamiliarId);
    desempatadoPelaPessoa = aplicado.desempatadoPelaPessoa;
    resultado = aplicado;
  }

  const { signoSol, signoLua } = calcularSignos(dataNascimento, horaNascimento);
  const lua = calcularFaseDaLua(dataNascimento, horaNascimento);

  const produtoEscolhido = produtoDe(
    ehProdutoValido(produto) ? produto : PRODUTO_PADRAO
  );

  const descontoPercentual: number | null = null;
  const preco = precoComDesconto(produtoEscolhido, descontoPercentual ?? 0);

  // SPEC 0.8: os 12 escores salvos, não só o vencedor. Extraído para
  // variável porque `descreverPerfil` (usado na mensagem pré-pagamento, mais
  // abaixo) espera o mesmo formato JSON.
  const perfilJson = JSON.stringify({
    eixos: resultado.normalizado,
    bruto: resultado.bruto,
    angulo: resultado.angulo,
    magnitude: resultado.magnitude,
    afinidades: resultado.afinidades,
    empate: resultado.empate,
  });

  const pedidoId = uuidv4();
  criarPedido({
    id: pedidoId,
    nome: nome.trim().slice(0, 40),
    email: email.trim(),
    /**
     * O lugar de nascimento entra aqui junto da data e da hora.
     *
     * Não é para o familiar — ele sai das 26 cenas e não olha o céu. É para o
     * mapa natal do Calendário: sem lugar não há ascendente nem casas, e até
     * agora a cidade nunca era perguntada no ritual, só depois, dentro da
     * conta, como pendência. Perguntando aqui, `herdarNascimentoDosPedidos`
     * já entrega a conta completa no primeiro login e a pendência some.
     *
     * Sigla do estado validada contra a lista fechada: ela vira coordenada em
     * `coordenadas.ts`, e sigla inventada viraria mapa de lugar nenhum.
     */
    respostas_json: JSON.stringify({
      quiz: respostas,
      dataNascimento,
      horaNascimento,
      cidadeNascimento:
        typeof cidadeNascimento === 'string' ? cidadeNascimento.slice(0, 60) : undefined,
      estadoNascimento: (typeof estadoNascimento === 'string' && coordenadaDoEstado(estadoNascimento)) ? estadoNascimento : undefined,
    }),
    familiar: resultado.familiar,
    lua,
    signo_sol: signoSol,
    signo_lua: signoLua,
    // Produto inválido cai no padrão em vez de recusar o pedido: perder a
    // venda por causa de um parâmetro de UI é o pior desfecho possível.
    produto: produtoEscolhido.id,
    desconto_percentual: descontoPercentual,
    perfil_json: perfilJson,
    desempatado_pela_pessoa: desempatadoPelaPessoa ? 1 : 0,
  });

  // Rota de transição: só abas abertas ANTES do funil novo chegam aqui, e
  // elas chegam com as 26 respondidas — o ritual já está completo por
  // definição. Sem esta marca, `aposPagamento` mandaria a pessoa refazer.
  atualizarPedido(pedidoId, {
    ritual_completo: 1,
    cenas_respondidas: ITENS.length,
  });

  /**
   * Cupom de 100%: não existe cobrança para fazer, então não passa pelo
   * checkout.
   *
   * Mandar um pedido de R$ 0,00 para o Mercado Pago não é "grátis", é um
   * pagamento que ele recusa — a pessoa veria uma tela de erro no lugar do
   * presente. O uso do cupom é contado no `marcarPago`, junto com o de
   * qualquer outra venda.
   */
  if (preco.gratis) {
    const pagoEm = new Date();
    atualizarPedido(pedidoId, {
      status: 'pago',
      pago_em: pagoEm.toISOString(),
      expira_em: calcularExpiracao(produtoEscolhido, pagoEm),
    });
    registrarEvento('pagamento_dispensado_por_cupom', pedidoId);
    processarPedido(pedidoId);
    return NextResponse.json({ id: pedidoId, gratis: true });
  }

  /**
   * A mensagem do familiar é gerada AGORA, antes de qualquer pagamento.
   *
   * É o que a tela pós-teste mostra no lugar da carta e do nome — de
   * propósito, ela NUNCA diz qual bicho é (ver `gerarMensagemDoFamiliar`).
   * Só quem respondeu tudo chega aqui, então não é porta aberta para gastar
   * chamada de IA à toa.
   *
   * Falhar aqui não pode derrubar o pedido: sem a mensagem gerada, a tela usa
   * `MENSAGEM_PADRAO` no lugar.
   */
  /**
   * O véu é composto AGORA: é o que a tela pós-teste mostra no lugar da
   * carta. Uma operação de sharp por ritual concluído, sem IA. Falhar aqui
   * não derruba o pedido — a tela perde a imagem e continua funcionando.
   */
  try {
    await gerarVeu(pedidoId, FAMILIARES[resultado.familiar]);
  } catch (erro) {
    console.error('[api/quiz] véu falhou:', erro);
  }

  try {
    const resumoRespostas = ITENS.map((item) => {
      const escolha = (respostas as Respostas)[item.id];
      const opcao = typeof escolha === 'number' ? item.opcoes[escolha] : undefined;
      return opcao ? `«${item.cena}» → "${opcao.texto}"` : null;
    })
      .filter(Boolean)
      .join('\n');

    const familiar = FAMILIARES[resultado.familiar];
    const mensagem = await gerarMensagemDoFamiliar({
      nome: nome.trim().slice(0, 40),
      familiar,
      resumoRespostas,
      perfil: descreverPerfil(perfilJson),
    });
    /**
     * O bilhete NÃO é narrado.
     *
     * Ele já foi: cada pessoa que terminava o teste gerava um áudio, pago,
     * antes de qualquer venda — e a conversão não veio. Áudio pré-pagamento
     * virou custo por visitante em vez de custo por cliente. A narração
     * continua existindo onde ela é paga: na leitura completa, depois da
     * compra (ver `processarPedido`).
     */
    atualizarPedido(pedidoId, {
      mensagem_familiar: JSON.stringify(mensagem),
      custo_ia_centavos: mensagem.custoCentavos ?? 0,
    });
  } catch (erro) {
    console.error('[api/quiz] mensagem do familiar falhou:', erro);
  }



  return NextResponse.json({ id: pedidoId });
}
