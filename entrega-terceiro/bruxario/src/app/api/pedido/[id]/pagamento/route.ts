import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, atualizarPedido, registrarEvento } from '@/lib/db';
import { pagamento, pagamentoEhFake, statusLiberaAcesso, METODOS_HABILITADOS } from '@/nucleo/checkouts/directpag';
import type { MetodoDePagamento } from '@/nucleo/checkouts/tipos';
import { calcularExpiracao, produtoDe } from '@/lib/produtos';
import { aposPagamento } from '@/lib/processar';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';
import { reportarVenda } from '@/lib/reportar-venda';

/**
 * Cria a cobrança no DirectPag e devolve o que a tela precisa mostrar.
 *
 * Não redireciona para gateway nenhum: o formulário é nosso e a pessoa nunca
 * sai do site. A resposta traz o QR do Pix ou a URL do boleto.
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

  let corpo: {
    metodo?: string;
    pagador?: { nome?: string; email?: string; telefone?: string; documento?: string };
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'dados de pagamento inválidos' }, { status: 400 });
  }

  const metodo = corpo.metodo ?? 'pix';
  if (!METODOS_HABILITADOS.includes(metodo)) {
    return NextResponse.json({ erro: 'método de pagamento indisponível' }, { status: 400 });
  }

  const pagador = corpo.pagador ?? {};
  /**
   * O CPF é exigido pelo DirectPag em toda transação, então falta dele é erro
   * de validação e não algo a contornar — sem ele a cobrança nem nasce.
   */
  if (
    !pagador.nome?.trim() ||
    !pagador.email?.includes('@') ||
    !pagador.telefone?.trim() ||
    (pagador.documento ?? '').replace(/\D/g, '').length < 11
  ) {
    return NextResponse.json({ erro: 'preencha nome, e-mail, telefone e CPF' }, { status: 400 });
  }

  try {
    const resultado = await pagamento.criarPagamento({
      metodo: metodo as MetodoDePagamento,
      pagador: {
        nome: pagador.nome,
        // O e-mail do PEDIDO manda: é para ele que a revelação vai, e deixar
        // o do formulário vencer entregaria a compra no endereço errado.
        email: pedido.email || pagador.email,
        telefone: pagador.telefone,
        documento: pagador.documento!,
      },
      produto: produtoDe(pedido.produto),
      pedidoId: id,
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
    atualizarPedido(id, {
      pagamento_id: resultado.idExterno,
      metodo_tentado: resultado.metodo ?? metodo,
      motivo_recusa: statusLiberaAcesso(resultado.status)
        ? null
        : resultado.statusDetalhe || null,
      tentativas_pagamento: (pedido.tentativas_pagamento ?? 0) + 1,
      ...(resultado.pix ? { pix_copia_e_cola: resultado.pix.copiaECola } : {}),
    });
    registrarEvento(`pagamento_criado_${resultado.status}`, id);

    /**
     * A Utmify recebe o pedido AQUI, como `waiting_payment`.
     *
     * Sem este envio ela só veria as vendas concluídas — e taxa de conversão
     * por campanha precisa dos dois lados: quem chegou ao checkout e quem
     * pagou. Sem `await`: o relatório não pode segurar a resposta da compra.
     */
    void reportarVenda(buscarPedido(id)!, 'waiting_payment', {
      metodo: resultado.metodo ?? metodo,
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
            },
          }
        : {}),
      ...(resultado.boleto ? { boleto: resultado.boleto } : {}),
    });
  } catch (erro) {
    console.error('[api/pedido/pagamento] erro ao criar pagamento:', erro);
    return NextResponse.json(
      { erro: 'O véu está denso esta noite. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
