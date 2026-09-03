import { createHmac, timingSafeEqual } from 'crypto';

/**
 * A porta que abre sozinha para quem acabou de pagar.
 *
 * ── O problema ────────────────────────────────────────────────────────────
 *
 * Quem comprava terminava numa página solta (`/revelacao/[id]`) e recebia a
 * plataforma por e-mail, para entrar depois. "Depois" quase nunca acontece: a
 * atenção acaba no minuto seguinte ao pagamento, e o Oráculo, o calendário e a
 * estante ficavam atrás de uma porta que a pessoa nunca soube que existia.
 *
 * Agora ela entra no mesmo gesto: paga, e a aba seguinte já é o app, com a
 * revelação dentro. Nada do que ela vê ali deixou de ser comprado — o que
 * mudou é ela ver o tamanho do lugar onde a compra a colocou.
 *
 * ── Por que não basta o id do pedido ──────────────────────────────────────
 *
 * O id do pedido **é o link público da revelação**: ele viaja no WhatsApp de
 * quem compartilha. Uma rota que abrisse sessão só com o id na URL daria a
 * conta de quem comprou para qualquer pessoa que recebesse o link — e essa
 * conta tem o e-mail, o histórico e a assinatura da dona dentro.
 *
 * Então a prova não é o id: é **este navegador**. Um cookie assinado, posto no
 * momento em que o pedido nasce (a mesma aba que vai pagar), diz que quem
 * está pedindo a porta é quem começou o ritual. Quem só recebeu o link não
 * tem o cookie, e para essa pessoa a porta simplesmente não existe — ela cai
 * na revelação pública, que é o que ela veio ver.
 *
 * ── Por que assinado, e não um id no banco ────────────────────────────────
 *
 * Nada a gravar, nada a limpar, e nada que fique valendo para sempre: a
 * validade viaja dentro da assinatura. Um cookie sem assinatura seria só um
 * campo de texto que o dono do navegador edita — e o que ele escreveria lá é
 * o id do pedido de outra pessoa.
 *
 * ── Prazo curto de propósito ──────────────────────────────────────────────
 *
 * Doze horas. É folgado para o Pix que demora e para a pessoa que fecha a aba
 * e volta à noite, e curto o bastante para que um computador compartilhado no
 * dia seguinte não abra a conta de quem usou antes.
 */

/** O cookie fica com um nome curto e opaco: ele viaja em toda requisição. */
export const COOKIE_DO_COMPRADOR = 'bx_dono';

/** Ver o comentário acima sobre o prazo. */
export const VALIDADE_DA_PORTA_HORAS = 12;

function segredo(): string {
  /**
   * A mesma cadeia usada pelo link de descadastro (`remarketing.ts`): o que
   * existe garantido nas duas máquinas. O último termo é o que faz o
   * desenvolvimento local funcionar sem configurar nada — e ele não protege
   * nada em produção, onde as duas variáveis acima existem.
   */
  return (
    process.env.APP_SECRET ||
    process.env.MP_WEBHOOK_SECRET ||
    process.env.RESEND_API_KEY ||
    'bruxario-porta-do-comprador'
  );
}

function assinar(pedidoId: string, expiraEm: number): string {
  return createHmac('sha256', segredo())
    .update(`${pedidoId}.${expiraEm}`)
    .digest('base64url')
    .slice(0, 32);
}

/** O valor que vai no cookie: `<expiraEm>.<assinatura>`. */
export function selarPorta(
  pedidoId: string,
  agora: Date = new Date()
): { valor: string; expiraEm: Date } {
  const expiraEm = agora.getTime() + VALIDADE_DA_PORTA_HORAS * 3_600_000;
  return {
    valor: `${expiraEm}.${assinar(pedidoId, expiraEm)}`,
    expiraEm: new Date(expiraEm),
  };
}

/**
 * O cookie prova que este navegador é o dono deste pedido?
 *
 * Comparação em tempo constante, como no resto da autenticação: aqui a
 * diferença é medível por quem tenta, e um comparador ingênuo entrega a
 * assinatura byte a byte.
 */
export function portaConfere(
  pedidoId: string,
  cookie: string | undefined,
  agora: Date = new Date()
): boolean {
  if (!cookie) return false;

  const ponto = cookie.indexOf('.');
  if (ponto <= 0) return false;

  const expiraEm = Number(cookie.slice(0, ponto));
  const assinatura = cookie.slice(ponto + 1);
  if (!Number.isFinite(expiraEm) || expiraEm <= agora.getTime()) return false;

  const esperada = assinar(pedidoId, expiraEm);
  if (assinatura.length !== esperada.length) return false;

  return timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada));
}

/**
 * Põe o selo na resposta que cria o pedido.
 *
 * Fica junto do resto para que o nome do cookie e as opções dele existam num
 * lugar só: `httpOnly` (script de página nunca lê), `lax` (sobrevive à volta
 * do gateway de pagamento, que traz a pessoa de outro domínio) e o mesmo
 * prazo da assinatura que vai dentro.
 */
export function selarRespostaDoPedido<T extends { cookies: { set: (nome: string, valor: string, opcoes: Record<string, unknown>) => unknown } }>(
  resposta: T,
  pedidoId: string
): T {
  const { valor, expiraEm } = selarPorta(pedidoId);
  resposta.cookies.set(COOKIE_DO_COMPRADOR, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiraEm,
  });
  return resposta;
}
