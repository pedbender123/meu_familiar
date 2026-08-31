import type { NextRequest } from 'next/server';

/**
 * O endereço para onde redirecionar, montado a partir de `BASE_URL` — e
 * **nunca** de `req.url`.
 *
 * ── Por que isto existe, e por que existe DUAS vezes ──────────────────────
 *
 * Atrás do nginx, `req.url` é o endereço interno: `http://localhost:3000`.
 * Redirecionar a partir dele manda a pessoa para um host que não existe no
 * navegador dela — e o modo de falha é cruel, porque em desenvolvimento
 * `req.url` JÁ é localhost e tudo funciona.
 *
 * Aconteceu a primeira vez no login: `/entrar/verificar` redirecionava por
 * `req.url` e **todo login quebrava em produção** enquanto passava em
 * desenvolvimento. O conserto ficou como uma função privada dentro daquele
 * arquivo — e por isso aconteceu de novo, meses depois, no alternador de
 * visão do painel, escrito por quem não sabia que a armadilha tinha nome.
 *
 * Uma correção que mora dentro de um arquivo só conserta aquele arquivo. Esta
 * mora aqui para ser a resposta óbvia da próxima vez, e `redirecionamento.test.ts`
 * falha se alguém montar um redirecionamento a partir de `req.url` de novo.
 *
 * `req.url` fica como último recurso: em desenvolvimento sem `BASE_URL`, ele
 * é a resposta certa.
 */
export function destinoAbsoluto(caminho: string, req: NextRequest): URL {
  const base = process.env.BASE_URL?.trim();
  return new URL(caminho, base || req.url);
}
