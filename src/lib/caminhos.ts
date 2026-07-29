import path from 'path';

/**
 * Todo caminho de filesystem do projeto mora aqui. Antes disso havia
 * `path.join(process.cwd(), ...)` repetido em seis arquivos, então mudar a
 * organização das pastas exigia caçar string por string — foi exatamente o
 * que aconteceu na reorganização para `src/` + `var/`.
 *
 * Convenção das três raízes:
 * - `src/assets` — entra no repositório, é lido em runtime, nunca escrito
 * - `var/`       — escrito em runtime, nunca versionado, nunca sobrescrito
 *                  por deploy (banco e artes geradas por pedido)
 * - `conteudo/`  — matéria-prima de divulgação, fora do runtime do app
 */
const RAIZ = process.cwd();

export const ASSETS = path.join(RAIZ, 'src', 'assets');
export const FONTES = path.join(ASSETS, 'fonts');
export const FAMILIARES_PNG = path.join(ASSETS, 'familiares');
export const LUAS_PNG = path.join(ASSETS, 'luas');

export const DADOS = path.join(RAIZ, 'var', 'data');
export const BANCO = path.join(DADOS, 'bruxario.db');
export const PEDIDOS = path.join(RAIZ, 'var', 'storage', 'orders');

export const CONTEUDO = path.join(RAIZ, 'conteudo');
export const ENV = path.join(RAIZ, '.env');

export function pastaDoPedido(pedidoId: string) {
  return path.join(PEDIDOS, pedidoId);
}

export function familiarPng(familiarId: string) {
  return path.join(FAMILIARES_PNG, `${familiarId}.png`);
}

export function luaPng(lua: string) {
  return path.join(LUAS_PNG, `${lua}.png`);
}
