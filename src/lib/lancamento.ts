/**
 * O cupom que serve de "condição de lançamento".
 *
 * Fica sozinho num arquivo sem dependência nenhuma de propósito: ele é usado
 * tanto por server components quanto pelo ritual, que é componente de cliente.
 * Quando morava junto das peças da landing, o import arrastava `cupons.ts` →
 * `db.ts` → `better-sqlite3` para dentro do bundle do navegador, e o build
 * quebrava com "Can't resolve 'fs'".
 *
 * O percentual NÃO está aqui: ele é lido do cupom real no banco, para que
 * desligar o cupom no painel desligue a condição em todo lugar de uma vez.
 */
export const CUPOM_DE_LANCAMENTO = 'LANCAMENTO20';
