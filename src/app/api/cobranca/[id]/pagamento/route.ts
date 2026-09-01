import { NextRequest, NextResponse } from 'next/server';
import {
  pagamentoEhFake,
  statusLiberaAcesso,
  type FormDataBrick,
} from '@/nucleo/checkouts/mercadopago';
import { provedorPara, provedorDe, gatewayDe, meioDe } from '@/nucleo/checkouts/gateway';
import {
  ErroDeGatewayIndisponivel,
  criarAssinaturaWiven,
  periodicidadeDe,
  type DadosCriacaoWiven,
} from '@/nucleo/checkouts/wiven';
import {
  buscarCobranca,
  anotarPagamento,
  anotarAssinaturaExterna,
  confirmarPagamento,
} from '@/nucleo/cobrancas';
import { buscarPlano } from '@/nucleo/planos';
import { registrarEvento } from '@/lib/db';
import { reportarAssinatura } from '@/lib/reportar-assinatura';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';
import { entregarChaveDaPlataforma, nomeDaConta } from '@/lib/acesso-plataforma';

/**
 * Cobra o plano — o gêmeo de `api/pedido/[id]/pagamento`, para assinatura.
 *
 * Mesma regra que vale no funil e vale aqui: **quem libera acesso é o
 * webhook**, nunca a resposta síncrona (SPEC 10.6). Cartão aprovado volta
 * `approved` na hora e Pix volta `pending` com o QR — em nenhum dos dois
 * casos esta rota cria assinatura. A exceção é o modo fake, onde não há
 * webhook para chegar.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`cobranca:${ip}`, LIMITES.pagamento)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const { id } = await params;
  const cobranca = buscarCobranca(id);
  if (!cobranca) {
    return NextResponse.json({ erro: 'cobrança não encontrada' }, { status: 404 });
  }

  if (cobranca.status === 'pago') {
    return NextResponse.json({ redirect: '/conta?assinatura=ok' });
  }

  const plano = buscarPlano(cobranca.plano_id);
  if (!plano) {
    return NextResponse.json({ erro: 'plano indisponível' }, { status: 400 });
  }

  if (pagamentoEhFake()) {
    const confirmada = confirmarPagamento(id, { metodo: 'fake' });
    registrarEvento('assinatura_confirmada_fake', id);
    // Sem webhook no modo fake, a chave sai daqui — senão testar o funil em
    // desenvolvimento sempre termina numa tela de login.
    if (confirmada?.assinatura) {
      await entregarChaveDaPlataforma({
        email: cobranca.email,
        nome: nomeDaConta(cobranca.email),
        contaNova: false,
      });
    }
    return NextResponse.json({ status: 'approved', redirect: '/conta?assinatura=ok' });
  }

  let form: FormDataBrick;
  let wiven: DadosCriacaoWiven['wiven'] | undefined;
  try {
    const corpo = await req.json();
    form = corpo?.formData ?? corpo;
    wiven = corpo?.wiven;
    if (!form?.payment_method_id && !wiven) throw new Error('payment_method_id ausente');
  } catch {
    return NextResponse.json({ erro: 'dados de pagamento inválidos' }, { status: 400 });
  }

  /**
   * Quem cobra a assinatura — o MESMO roteador que cobra os produtos.
   *
   * ── A lacuna que isto fecha ───────────────────────────────────────────────
   *
   * Esta rota importava o Mercado Pago direto, fixado na importação. O efeito
   * passava despercebido porque nada quebrava: com `GATEWAY=wiven`, TODO
   * produto ia para a Wiven e **toda assinatura continuava indo para o
   * Mercado Pago**.
   *
   * E isso não é só inconsistência de gateway: é dinheiro caindo na conta
   * errada. O split 40/40/20 vive na cobrança da Wiven, então a receita de
   * assinatura chegava inteira numa conta só, sem repasse a ninguém — e sem
   * nenhum sinal de que algo estivesse fora do lugar.
   */
  const meio = meioDe(wiven?.meio ?? form?.payment_method_id);
  const nomeDoGateway = gatewayDe(meio);
  const provedor = provedorPara(meio);

  /**
   * O IP de quem está pagando, obrigatório no cartão da Wiven.
   *
   * Sai do CABEÇALHO, nunca do corpo — o corpo vem do navegador, e IP que o
   * cliente escolhe é IP que não serve para antifraude nenhuma. A rota de
   * pedido já fazia isso; esta nasceu sem, e a Wiven recusou a assinatura com
   * `clientIp: Required` na primeira tentativa real.
   */
  const doCabecalho = req.headers.get('x-forwarded-for');
  const ipDoCliente =
    doCabecalho && doCabecalho !== 'local' ? doCabecalho.split(',')[0].trim() : '127.0.0.1';

  const dadosWiven = wiven ? { ...wiven, ip: ipDoCliente } : undefined;

  async function cobrar(usando: ReturnType<typeof provedorDe>) {
    return usando.criarPagamento({
      form,
      ...(dadosWiven ? { wiven: dadosWiven } : {}),
      // O plano é o `Cobravel`: só id, descrição e preço. O valor sai daqui,
      // do banco — nunca do que o navegador mandou.
      produto: {
        id: plano!.id,
        descricao: plano!.nome,
        precoCentavos: cobranca!.valor_centavos,
      },
      pedidoId: cobranca!.id,
      emailDoPedido: cobranca!.email,
      descontoPercentual: 0,
    } as Parameters<typeof usando.criarPagamento>[0]);
  }

  try {
    /**
     * Recorrência de verdade, quando as duas condições valem.
     *
     * ── Por que só na Wiven, e só em plano recorrente ───────────────────────
     *
     * As rotas `/gateway/{pix,card}/subscription` são dela. Plano de acesso
     * único (`recorrente = 0`) não tem o que renovar, e mandá-lo por ali
     * criaria um contrato mensal para quem comprou uma coisa só.
     *
     * Quando não vale, cai na cobrança avulsa de sempre: uma parcela de 30
     * dias mais o e-mail de renovação. É o que rodava antes disto existir, e
     * continua sendo a rede quando o Mercado Pago está cobrando.
     */
    /**
     * Plano recorrente não é cobrado no Pix por enquanto.
     *
     * Recusar é melhor que cair na cobrança avulsa. A queda daria 30 dias de
     * acesso SEM criar recorrência nenhuma — a pessoa acharia que assinou, e
     * a descoberta viria trinta dias depois, com o acesso fechando sozinho e
     * nenhuma cobrança nova para explicar por quê.
     *
     * A tela já esconde o Pix nesses planos; isto é a trava para quem chegar
     * por outro caminho.
     */
    if (plano.recorrente === 1 && meio === 'pix') {
      return NextResponse.json(
        { erro: 'Assinatura só no cartão por enquanto. Escolha cartão para continuar.' },
        { status: 400 }
      );
    }

    const recorrente = plano.recorrente === 1 && nomeDoGateway === 'wiven' && !!dadosWiven;

    let resultado;
    try {
      if (recorrente) {
        const criada = await criarAssinaturaWiven({
          cobrancaId: cobranca.id,
          emailDoCliente: cobranca.email,
          plano: { id: plano.id, nome: plano.nome, precoCentavos: cobranca.valor_centavos },
          periodicidade: periodicidadeDe(plano.duracao_dias),
          wiven: dadosWiven!,
        });

        /*
          Gravado ANTES de responder à tela. Se o processo cair na linha
          seguinte, o contrato já existe do lado deles e cobra todo mês —
          perder o id aqui é perder a única forma de cancelar.
        */
        if (criada.assinatura) {
          anotarAssinaturaExterna(cobranca.id, {
            id: criada.assinatura.id,
            proximaCobrancaEm: criada.assinatura.proximaCobrancaEm,
          });
          registrarEvento('assinatura_recorrente_criada', cobranca.id);
        }
        resultado = criada;
      } else {
        resultado = await cobrar(provedor);
      }
    } catch (erro) {
      /*
        Mesma queda do funil de produtos, e pelo mesmo motivo: cair para outro
        gateway no meio de uma cobrança de CARTÃO pode cobrar duas vezes,
        porque não dá para saber se a primeira nasceu do outro lado. No Pix
        não há esse risco — a cobrança só existe quando alguém paga o QR.
      */
      /*
        Assinatura recorrente NÃO cai para o Mercado Pago.

        A queda existe para o Pix avulso, onde refazer a cobrança é inofensivo.
        Aqui ela criaria um contrato mensal num gateway e possivelmente outro
        no primeiro — e dois contratos ativos cobram a mesma pessoa duas vezes,
        todo mês, até alguém reparar no extrato.
      */
      const podeCair =
        erro instanceof ErroDeGatewayIndisponivel &&
        meio === 'pix' &&
        !recorrente &&
        nomeDoGateway !== 'mercadopago';
      if (!podeCair) throw erro;

      console.warn(
        `[cobranca] ${nomeDoGateway} indisponível na cobrança ${id} — ` +
          'cobrando o Pix pelo Mercado Pago.'
      );
      resultado = await cobrar(provedorDe('mercadopago'));
    }

    anotarPagamento(id, resultado.idExterno);
    registrarEvento(`assinatura_pagamento_${resultado.status}`, id);

    /**
     * A intenção de assinar, para a UTMify.
     *
     * A venda paga sozinha não basta: é o par `waiting_payment` + `paid` que
     * dá o denominador da conversão no painel deles. Sem o primeiro, quem
     * abriu o checkout de assinatura e desistiu não existe — e a campanha
     * aparece convertendo 100% de um funil que ninguém vê.
     *
     * Aqui, e não em `abrirCobranca`, porque é neste ponto que o meio de
     * pagamento é conhecido. Reportar antes obrigaria a chutar Pix numa
     * assinatura que só aceita cartão.
     *
     * Sem `await`: esta rota está entre a pessoa e o pagamento dela.
     */
    void reportarAssinatura(buscarCobranca(id) ?? cobranca, 'waiting_payment', { metodo: meio });

    return NextResponse.json({
      status: resultado.status,
      statusDetalhe: resultado.statusDetalhe,
      pix: resultado.pix,
      // `approved` aqui só informa a tela; a assinatura nasce no webhook.
      redirect: statusLiberaAcesso(resultado.status) ? '/conta?assinatura=ok' : undefined,
    });
  } catch (erro) {
    console.error('[cobranca] falha ao cobrar:', erro);
    return NextResponse.json(
      { erro: 'Não consegui processar o pagamento. Tente de novo.' },
      { status: 502 }
    );
  }
}
