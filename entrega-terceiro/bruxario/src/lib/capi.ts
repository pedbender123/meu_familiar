import { urlBase } from './marca';
import { createHash } from 'crypto';

/**
 * Conversions API da Meta — o mesmo evento que o pixel do navegador manda,
 * mas de servidor pra servidor. Existe para DUAS situações que o pixel
 * client-side (`lib/pixel.ts`) não cobre:
 *
 *  1. **Backfill**: vendas que já aconteceram e nunca dispararam Purchase no
 *     navegador (ver `scripts/backfill-pixel.ts` e o motivo em
 *     `MarcaCompra.tsx`/`obrigado/[id]/page.tsx` — Purchase depende de a
 *     pessoa estar com aquela aba aberta ou logada).
 *  2. Qualquer evento futuro que precise sobreviver a ad blocker, já que
 *     server-to-server não passa pelo navegador.
 *
 * `event_id` é o mesmo em ambos os mundos (formato `${pedidoId}:${nome}`) —
 * é o que permite o pixel do navegador e o CAPI mandarem o MESMO evento sem
 * a Meta contar duas vezes, caso os dois cheguem a disparar para o mesmo
 * pedido.
 */
const GRAPH_VERSION = 'v21.0';

function sha256(valor: string): string {
  return createHash('sha256').update(valor.trim().toLowerCase()).digest('hex');
}

export interface EventoCapi {
  nome: 'InitiateCheckout' | 'Purchase' | 'Lead';
  /** Quando o evento aconteceu de verdade — não quando o backfill roda. */
  quando: Date;
  email?: string | null;
  valorEmReais?: number;
  /** Estável por pedido+evento — impede o mesmo acontecimento contar duas vezes. */
  eventId: string;
  urlDaAcao?: string;

  /**
   * Os identificadores do navegador, lidos no servidor e guardados em
   * `identidades`. São o que liga a venda ao ANÚNCIO.
   *
   * Sem eles a Meta conta a venda mas não sabe de onde ela veio: o e-mail
   * hasheado identifica a pessoa, não o clique. `fbp` diz qual navegador e
   * `fbc` diz de qual anúncio — os dois vêm de cookie de primeira parte, que
   * chega ao nosso servidor sozinho.
   */
  fbp?: string;
  fbc?: string;
  /** Exigidos pela Meta em evento `website`; sem eles a qualidade cai. */
  userAgent?: string;
  ip?: string;

  /**
   * Para qual pixel, quando não for o principal.
   *
   * O Horóscopo é outro produto com outro pixel e outro token. Estes campos
   * viajam DENTRO do evento porque a fila guarda o evento como JSON e o envio
   * acontece depois, noutro processo — sem eles, tudo que entra na fila sai
   * pelo pixel principal e a venda do Horóscopo apareceria na campanha errada.
   */
  pixelId?: string;
  token?: string;
}

export interface ResultadoCapi {
  ok: boolean;
  erro?: string;
}

/**
 * Manda um evento. Nunca lança — quem chama decide o que fazer com a falha
 * (o script de backfill loga e segue para o próximo pedido).
 */
export async function enviarEventoCapi(
  evento: EventoCapi,
  opcoes?: { pixelId?: string; token?: string }
): Promise<ResultadoCapi> {
  const pixelId =
    opcoes?.pixelId ?? evento.pixelId ?? process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = opcoes?.token ?? evento.token ?? process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId) return { ok: false, erro: 'NEXT_PUBLIC_META_PIXEL_ID ausente' };
  if (!token) return { ok: false, erro: 'META_CAPI_ACCESS_TOKEN ausente' };

  const corpo = {
    data: [
      {
        event_name: evento.nome,
        event_time: Math.floor(evento.quando.getTime() / 1000),
        event_id: evento.eventId,
        action_source: 'website',
        event_source_url: evento.urlDaAcao ?? urlBase(),
        user_data: {
          ...(evento.email ? { em: [sha256(evento.email)] } : {}),
          // Não hasheados de propósito: a Meta espera `fbp`, `fbc`, IP e
          // user-agent em texto puro. Hashear estes quebra a atribuição.
          ...(evento.fbp ? { fbp: evento.fbp } : {}),
          ...(evento.fbc ? { fbc: evento.fbc } : {}),
          ...(evento.userAgent ? { client_user_agent: evento.userAgent } : {}),
          ...(evento.ip ? { client_ip_address: evento.ip } : {}),
        },
        ...(evento.valorEmReais !== undefined
          ? { custom_data: { value: evento.valorEmReais, currency: 'BRL' } }
          : {}),
      },
    ],
  };

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      }
    );

    if (!resposta.ok) {
      const texto = await resposta.text();
      return { ok: false, erro: `${resposta.status} ${texto}` };
    }
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}
