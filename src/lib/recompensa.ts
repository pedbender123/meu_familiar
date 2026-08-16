/**
 * Quanto vale compartilhar nos stories.
 *
 * Fica num arquivo sem dependências porque é lido tanto pelo servidor quanto
 * pelo componente de cliente da revelação. Importado de `marcacoes.ts`, ele
 * arrastava `db.ts` → `better-sqlite3` para o bundle do navegador e o build
 * quebrava com "Can't resolve 'fs'" — o mesmo tropeço do cupom de lançamento.
 */
export const BONUS_DE_CONSULTAS = 10;
