import { enfileirarEventoCapi } from '../lib/fila-capi';
import { identidadeDoEmail, type Identidade } from '../lib/identidade';

/**
 * O único lugar de onde sai um evento de venda para a Meta.
 *
 * ── Por que existe um lugar só ────────────────────────────────────────────
 *
 * Porque existiam três. `/obrigado` disparava `Purchase`, `MarcaCompra`
 * disparava `Purchase`, e o servidor deveria disparar `Purchase` — nenhum dos
 * dois do navegador com `event_id`, e a trava deles era `localStorage`, que é
 * por navegador. Quem pagava no app do Instagram, abria o e-mail no Chrome e
 * depois olhava no computador gerava três vendas para um pagamento. Foi
 * exatamente o que aconteceu em produção.
 *
 * O navegador não pode ser dono desta contagem: ele não sabe quantas vezes já
 * contou. Quem sabe é o servidor, no instante em que o webhook confirma o
 * dinheiro, e ele sabe uma vez só.
 *
 * ── O que ainda vem do navegador ──────────────────────────────────────────
 *
 * `PageView`, e só. Ele precisa do navegador para existir, é o mais barato de
 * errar, e é ele que faz o pixel criar o `_fbp` — o cookie que esta camada lê
 * depois, no servidor, para dizer à Meta de qual anúncio veio a venda.
 */

/**
 * Para qual pixel vai o evento.
 *
 * `principal` é o Bruxário; `horoscopo` é o outro produto, com pixel e token
 * próprios. Devolve `null` quando o pixel daquele produto não está
 * configurado — e aí o evento nem entra na fila, para não acumular coisa que
 * nunca vai sair e disparar falso alarme da Sentinela.
 */
export type Destino = 'principal' | 'horoscopo';

function pixelDe(destino: Destino): { pixelId?: string; token?: string } | null {
  if (destino === 'horoscopo') {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID_HOROSCOPO;
    if (!pixelId) return null;
    return {
      pixelId,
      // Cai no token principal quando o do Horóscopo não existe: as duas
      // contas costumam viver sob o mesmo Business, e um token que funciona
      // vale mais que um evento não enviado.
      token:
        process.env.META_CAPI_ACCESS_TOKEN_HOROSCOPO ??
        process.env.META_CAPI_ACCESS_TOKEN,
    };
  }
  return process.env.NEXT_PUBLIC_META_PIXEL_ID ? {} : null;
}

/** O que a Meta usa para saber QUEM é — quanto mais, melhor a atribuição. */
function dadosDaPessoa(identidade: Identidade | undefined) {
  return {
    fbp: identidade?.fbp ?? undefined,
    fbc: identidade?.fbc ?? undefined,
    userAgent: identidade?.user_agent ?? undefined,
    ip: identidade?.ip ?? undefined,
  };
}

/**
 * A venda. **Um por pagamento confirmado, e mais nenhum.**
 *
 * `referencia` é o id do pedido ou da cobrança — o que identifica ESTA venda.
 * Ele vira o `event_id`, então um webhook reenviado pelo Mercado Pago não
 * produz uma segunda venda: a fila recusa a chave repetida e, mesmo que
 * passasse, a Meta deduplicaria pelo mesmo id.
 */
export function registrarCompra(dados: {
  referencia: string;
  email: string;
  destino?: Destino;
  valorEmReais?: number;
  quando?: Date;
}): void {
  const pixel = pixelDe(dados.destino ?? 'principal');
  if (!pixel) return;

  const identidade = identidadeDoEmail(dados.email);

  enfileirarEventoCapi({
    pedidoId: dados.referencia,
    nome: 'Purchase',
    quando: dados.quando ?? new Date(),
    email: dados.email,
    valorEmReais: dados.valorEmReais,
    eventId: `${dados.referencia}:purchase`,
    ...dadosDaPessoa(identidade),
    ...pixel,
  });
}

/**
 * O lead: a pessoa deixou o e-mail.
 *
 * Sai daqui, e não do navegador, pelo mesmo motivo da compra — e por um a
 * mais: o `Lead` do navegador disparava no momento em que o campo ficava
 * válido, o que conta gente que digitou o e-mail e desistiu antes de enviar.
 * Aqui ele só sai quando o endereço chegou ao banco.
 */
export function registrarLead(dados: {
  referencia: string;
  email: string;
  destino?: Destino;
  quando?: Date;
}): void {
  const pixel = pixelDe(dados.destino ?? 'principal');
  if (!pixel) return;

  const identidade = identidadeDoEmail(dados.email);

  enfileirarEventoCapi({
    pedidoId: dados.referencia,
    nome: 'Lead',
    quando: dados.quando ?? new Date(),
    email: dados.email,
    eventId: `${dados.referencia}:lead`,
    ...dadosDaPessoa(identidade),
    ...pixel,
  });
}

/**
 * A intenção de pagar: a pessoa abriu o checkout.
 *
 * Também sai do servidor, no momento em que a cobrança é criada — que é
 * exatamente quando a intenção existe. No navegador ele dependia da tela de
 * pagamento montar, então sumia para quem tinha bloqueador e contava duas
 * vezes para quem recarregava a página.
 */
export function registrarInicioDeCheckout(dados: {
  referencia: string;
  email: string;
  destino?: Destino;
  valorEmReais?: number;
  quando?: Date;
}): void {
  const pixel = pixelDe(dados.destino ?? 'principal');
  if (!pixel) return;

  const identidade = identidadeDoEmail(dados.email);

  enfileirarEventoCapi({
    pedidoId: dados.referencia,
    nome: 'InitiateCheckout',
    quando: dados.quando ?? new Date(),
    email: dados.email,
    valorEmReais: dados.valorEmReais,
    eventId: `${dados.referencia}:checkout`,
    ...dadosDaPessoa(identidade),
    ...pixel,
  });
}
