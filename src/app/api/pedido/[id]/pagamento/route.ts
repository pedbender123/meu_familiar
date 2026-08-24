import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, atualizarPedido, registrarEvento } from '@/lib/db';
import {
  pagamentoEhFake,
  statusLiberaAcesso,
  type FormDataBrick,
} from '@/nucleo/checkouts/mercadopago';
import { provedorPara, gatewayDe, meioDe, campanhaDoPedido } from '@/nucleo/checkouts/gateway';
import type { DadosCaktoDoFront } from '@/nucleo/checkouts/cakto';
import type { DadosCriacaoWiven } from '@/nucleo/checkouts/wiven';
import { reportarVenda } from '@/lib/reportar-venda';
import { calcularExpiracao, produtoDe } from '@/lib/produtos';
import { produtoVigenteDe } from '@/lib/modelo-de-venda';
import { aposPagamento } from '@/lib/processar';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';

/**
 * Recebe o `formData` do Payment Brick e cria o pagamento no Mercado Pago.
 *
 * Diferente da versão Asaas, esta rota **não redireciona para gateway nenhum** —
 * o Brick já coletou tudo no nosso site. Ela devolve o status para a tela
 * decidir o que mostrar: aprovado vai pra geração, Pix mostra o QR, recusado
 * pede outro cartão.
 *
 * O que ela deliberadamente NÃO faz: confiar no status para liberar acesso
 * quando o gateway é real. Quem libera é o webhook (SPEC 10.6). Aqui o pedido
 * só sai de `aguardando_pagamento` no modo fake.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`pagamento:${ip}`, LIMITES.pagamento)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas. Aguarde um instante.' },
      { status: 429 }
    );
  }

  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }

  // Se a pessoa voltou pra essa tela com o pedido já adiantado, manda pro
  // lugar certo em vez de cobrar de novo.
  if (pedido.status === 'entregue') {
    return NextResponse.json({ redirect: `/revelacao/${id}` });
  }
  if (
    pedido.status === 'pago' ||
    pedido.status === 'gerando' ||
    pedido.status === 'erro'
  ) {
    return NextResponse.json({ redirect: `/obrigado/${id}` });
  }

  if (pagamentoEhFake()) {
    const pagoEm = new Date();
    atualizarPedido(id, {
      status: 'pago',
      pago_em: pagoEm.toISOString(),
      expira_em: calcularExpiracao(produtoDe(pedido.produto), pagoEm),
    });
    registrarEvento('pagamento_confirmado_fake', id);
    aposPagamento(id);
    return NextResponse.json({ status: 'approved', redirect: `/obrigado/${id}` });
  }

  let form: FormDataBrick;
  let cakto: DadosCaktoDoFront | undefined;
  let wiven: DadosCriacaoWiven['wiven'] | undefined;
  let utm: Record<string, string> | undefined;
  try {
    const corpo = await req.json();
    /**
     * Três fronts, um endpoint.
     *
     * O Payment Brick manda `{ formData }`; a tela da Cakto manda `{ cakto }`;
     * a da Wiven manda `{ wiven }`. Quem decidir o gateway a partir daqui
     * precisa saber qual dos três chegou — e não dá para adivinhar pelo
     * `payment_method_id`, porque nem Cakto nem Wiven mandam esse campo.
     */
    cakto = corpo?.cakto;
    wiven = corpo?.wiven;
    utm = cakto?.utm ?? corpo?.utm;
    form =
      corpo?.formData ??
      (cakto
        ? { payment_method_id: cakto.metodo }
        : wiven
          ? { payment_method_id: wiven.meio === 'pix' ? 'pix' : 'credit_card' }
          : corpo);
    if (!form?.payment_method_id) throw new Error('payment_method_id ausente');
  } catch {
    return NextResponse.json(
      { erro: 'dados de pagamento inválidos' },
      { status: 400 }
    );
  }

  /**
   * Quem cobra este meio, agora.
   *
   * Lido a cada requisição, e não fixado na importação: trocar `GATEWAY` no
   * `.env` e reiniciar passa a valer sem rebuild — que é o que torna o
   * rollback uma variável de ambiente em vez de um deploy.
   */
  const meio = meioDe(cakto?.metodo ?? wiven?.meio ?? form.payment_method_id);

  /**
   * A campanha sai do UTM do pedido, e não do corpo desta requisição.
   *
   * O corpo vem do navegador. Deixar o cliente dizer de qual campanha ele veio
   * seria deixar o cliente escolher em qual conta o dinheiro cai — e a
   * primeira pessoa a descobrir isso não seria um cliente.
   *
   * O UTM do pedido, sim, foi gravado por nós na primeira visita. Nos casos
   * em que ele ainda não existe (a gravação acontece logo abaixo), o `utm`
   * recém-chegado serve de reforço: os dois vêm da mesma sessão.
   */
  const campanha =
    campanhaDoPedido(pedido) ?? utm?.utm_campaign?.trim() ?? utm?.utm_source?.trim() ?? null;

  const nomeDoGateway = gatewayDe(meio, campanha);
  const provedor = provedorPara(meio, campanha);

  /**
   * **A tentativa é gravada ANTES de a cobrança sair.**
   *
   * Antes, tudo era gravado depois da resposta do gateway. Isso deixa uma
   * janela em que o dinheiro já saiu e o nosso banco não sabe de nada: a
   * chamada estoura o timeout, o processo cai, a notificação chega antes da
   * resposta — e sobra um pagamento sem pedido para casar com ele.
   *
   * Gravar antes inverte o risco. No pior caso fica um pedido marcado como
   * "tentou pagar e não sabemos o desfecho", que a reconciliação resolve
   * consultando o gateway. Um pedido com tentativa a mais é ruído; uma venda
   * paga sem entrega é prejuízo e é reclamação.
   */
  atualizarPedido(id, {
    tentativas_pagamento: (pedido.tentativas_pagamento ?? 0) + 1,
    metodo_tentado: form.payment_method_id ?? null,
    // Quem cobrou fica gravado NA TENTATIVA: é o que o painel usa depois para
    // saber a quem pedir estorno, e o que a reconciliação usa para saber
    // contra qual extrato comparar.
    gateway: nomeDoGateway,
    ...(cakto?.telefone || wiven?.telefone
      ? { telefone: cakto?.telefone ?? wiven?.telefone }
      : {}),
    /**
     * UTMs e IP, gravados no pedido.
     *
     * Quem reporta a venda para a Utmify é o webhook, horas depois, sem
     * navegador por perto — então a origem precisa estar guardada antes. Este
     * é o último ponto do funil em que ainda existe uma aba aberta.
     *
     * `ip_comprador` sai do cabeçalho e não do corpo: IP mandado pelo cliente
     * é IP escolhido pelo cliente.
     */
    ...(utm && Object.keys(utm).length ? { utm_json: JSON.stringify(utm) } : {}),
    ip_comprador: ip === 'local' ? null : ip.split(',')[0].trim(),
  });
  registrarEvento('pagamento_tentado', id);

  try {
    const resultado = await provedor.criarPagamento({
      form,
      // Ignorado pelo Mercado Pago; é o que a Cakto precisa para cobrar.
      ...(cakto ? { cakto: { ...cakto, cupomCodigo: pedido.cupom ?? undefined } } : {}),
      /**
       * O IP vem do CABEÇALHO, sobrescrevendo o que o front mandar.
       *
       * A Wiven exige `clientIp` no cartão e usa isso no antifraude. IP
       * mandado pelo cliente é IP escolhido pelo cliente — e num campo que
       * alimenta antifraude isso é exatamente o que não pode acontecer.
       */
      ...(wiven
        ? { wiven: { ...wiven, ip: ip === 'local' ? '127.0.0.1' : ip.split(',')[0].trim() } }
        : {}),
      /**
       * `produtoVigente`, nunca `produtoDe`.
       *
       * A tabela estática tem a Revelação com `precoCentavos: 0` — ela virou
       * a porta de entrada do modelo novo. Lida daqui, com o interruptor
       * DESLIGADO, esta rota mandava o gateway cobrar R$ 0,00 de uma venda
       * que a campanha anuncia a R$ 9,80. É o mesmo furo de 21/08, um degrau
       * adiante: lá a entrega saía de graça, aqui a cobrança sairia zerada.
       */
      produto: produtoVigenteDe(pedido.produto),
      pedidoId: id,
      emailDoPedido: pedido.email,
      // Lido do PEDIDO, nunca do corpo da requisição: é o cupom que já foi
      // validado contra o banco quando o pedido nasceu.
      descontoPercentual: pedido.desconto_percentual ?? 0,
    });

    /**
     * O que foi tentado fica gravado AQUI, na tentativa — não na aprovação.
     *
     * `metodo_pagamento` é escrito pelo webhook, e webhook só chega quando dá
     * certo. Sem estas colunas, uma recusa some do banco: sobrava o evento
     * `pagamento_criado_rejected` sem dizer se era cartão, Pix ou boleto, nem
     * por quê. É justamente a tentativa que falha que precisa ser analisada.
     */
    // `tentativas_pagamento` NÃO entra aqui: já foi contada antes da chamada.
    // Somar de novo faria cada cobrança contar duas tentativas, e é justamente
    // esse número que diz se alguém está apanhando para conseguir pagar.
    atualizarPedido(id, {
      pagamento_id: resultado.idExterno,
      metodo_tentado: resultado.metodo ?? form.payment_method_id ?? null,
      motivo_recusa: statusLiberaAcesso(resultado.status)
        ? null
        : resultado.statusDetalhe || null,
      ...(resultado.pix ? { pix_copia_e_cola: resultado.pix.copiaECola } : {}),
    });
    registrarEvento(`pagamento_criado_${resultado.status}`, id);

    /**
     * **A Utmify soube que a cobrança abriu.**
     *
     * `waiting_payment`, não `paid` — a venda ainda não aconteceu. Reportar só
     * a venda paga esconderia quem chegou ao checkout e desistiu, que é
     * metade do que faz o painel dela valer alguma coisa: sem o denominador
     * não existe taxa de conversão por campanha.
     *
     * Sem `await`: relatório é rastreio, e rastreio lento não pode segurar a
     * resposta de uma tela de pagamento com a pessoa esperando o QR.
     */
    void reportarVenda(buscarPedido(id)!, 'waiting_payment', {
      metodo: resultado.metodo ?? form.payment_method_id,
      taxaCentavos: resultado.taxaCentavos,
    });

    // Cartão aprovado: quem confirma de verdade é o webhook, mas mandar a
    // pessoa pra tela de espera já é correto — /obrigado faz poll até
    // `entregue`, então ela vê o resultado assim que a geração terminar.
    if (statusLiberaAcesso(resultado.status)) {
      return NextResponse.json({
        status: resultado.status,
        redirect: `/obrigado/${id}`,
      });
    }

    return NextResponse.json({
      status: resultado.status,
      statusDetalhe: resultado.statusDetalhe,
      ...(resultado.pix
        ? {
            pix: {
              copiaECola: resultado.pix.copiaECola,
              qrBase64: resultado.pix.qrBase64,
              // A Wiven deprecou o base64 e manda uma URL. Ver `wiven.ts`.
              qrUrl: resultado.pix.qrUrl,
            },
          }
        : {}),
    });
  } catch (erro) {
    console.error('[api/pedido/pagamento] erro ao criar pagamento:', erro);
    return NextResponse.json(
      { erro: 'O véu está denso esta noite. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
