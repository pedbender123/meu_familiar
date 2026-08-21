import { cookies } from 'next/headers';
import { lerSessao, COOKIE_DA_SESSAO, type Sessao } from './autenticacao';

/**
 * Lê a sessão do cookie num server component ou rota.
 *
 * Sempre no servidor: o cookie é `httpOnly`, então o navegador nunca consegue
 * lê-lo — e é isso que impede que um script injetado roube a sessão.
 */
export async function sessaoAtual(): Promise<Sessao | null> {
  const bolo = await cookies();
  return lerSessao(bolo.get(COOKIE_DA_SESSAO)?.value);
}
