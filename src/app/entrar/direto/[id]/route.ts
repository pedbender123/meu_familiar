import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, registrarEvento } from '@/lib/db';
import { abrirSessao, garantirConta, COOKIE_DA_SESSAO } from '@/lib/autenticacao';
import { COOKIE_DO_COMPRADOR, portaConfere } from '@/lib/porta-do-comprador';
import { destinoAbsoluto } from '@/lib/destino-absoluto';

/**
 * Pagou, entra — a porta de quem acabou de comprar.
 *
 * É uma **rota** e não uma página, como `/entrar/verificar`: assim a sessão já
 * sai posta no redirecionamento e nada disso chega a virar HTML.
 *
 * ── A queda é a revelação pública, sempre ─────────────────────────────────
 *
 * Toda recusa aqui termina em `/revelacao/[id]`, sem mensagem de erro. Quem
 * chegou por um link compartilhado não fez nada de errado: ela veio ver a
 * revelação de uma amiga, e é isso que ela recebe. Uma tela de "acesso negado"
 * transformaria o link que circula — que é o que traz gente nova — numa porta
 * batida na cara.
 *
 * Quem é a dona e mesmo assim caiu na queda (trocou de navegador, o cookie
 * venceu) também não perde nada: o e-mail com o link de acesso continua
 * saindo no pagamento, e a revelação pública é a mesma coisa. Ver
 * `lib/porta-do-comprador.ts` para o que a porta exige.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const revelacaoPublica = NextResponse.redirect(destinoAbsoluto(`/revelacao/${id}`, req));

  const pedido = buscarPedido(id);
  if (!pedido || !pedido.email) return revelacaoPublica;

  /**
   * A sessão vale o que a entrega vale.
   *
   * `entregue` e não `pago`: antes disso não existe leitura para mostrar, e a
   * tela de dentro do app mandaria a pessoa para um 404 no melhor momento do
   * produto. Quem pagou e ainda espera continua no círculo de `/obrigado`,
   * que é onde a espera tem explicação.
   */
  if (pedido.status !== 'entregue') return revelacaoPublica;

  /** Amostra do mural não tem dona, e não pode abrir conta para ninguém. */
  if (pedido.exemplo === 1) return revelacaoPublica;

  const cookie = req.cookies.get(COOKIE_DO_COMPRADOR)?.value;
  if (!portaConfere(id, cookie)) return revelacaoPublica;

  garantirConta(pedido.email);
  const { token, expiraEm } = abrirSessao(pedido.email, 'conta');
  registrarEvento('conta_entrou_pela_compra', id);

  /**
   * `e=cp` marca o toque como vindo da compra, e não do link de e-mail
   * (`lg`). É o que permite ver, na jornada, quantas pessoas entraram na
   * plataforma no mesmo minuto em que pagaram — o número que esta porta
   * existe para mover.
   */
  const resposta = NextResponse.redirect(
    destinoAbsoluto(`/conta/familiar/${id}?e=cp`, req)
  );

  resposta.cookies.set(COOKIE_DA_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiraEm,
  });

  /**
   * O selo morre no uso. Ele já cumpriu o que tinha para cumprir, e um cookie
   * de porta que fica no navegador é uma chave sobrando na fechadura.
   */
  resposta.cookies.set(COOKIE_DO_COMPRADOR, '', { path: '/', maxAge: 0 });

  return resposta;
}
