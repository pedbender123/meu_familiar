/**
 * Constantes dos dados de nascimento — sem banco, sem servidor.
 *
 * Mora separado de `src/nucleo/perfil-astral.ts` de propósito: aquele importa
 * `db`, e o formulário que pede a hora é um componente de cliente. Importar o
 * módulo do banco a partir do navegador arrasta `better-sqlite3` para o bundle
 * e quebra o build inteiro — este arquivo existe para ser seguro dos dois
 * lados.
 */

/**
 * Meio-dia, quando a pessoa não sabe a hora em que nasceu.
 *
 * É a convenção astrológica para hora desconhecida: minimiza o erro máximo da
 * Lua (que anda ~13° por dia), deixando o pior caso em ±6h em vez de ±24h.
 *
 * Sol e Lua continuam confiáveis; **ascendente e casas, não** — o ascendente
 * gira 360° em 24h, cerca de um signo a cada duas horas. Por isso quem usa
 * este padrão é marcado (`nascimento_hora_aproximada`), e o produto entrega o
 * que dá para entregar sem afirmar o que não pode calcular.
 */
export const HORA_PADRAO = '12:00';
