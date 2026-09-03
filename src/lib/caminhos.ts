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
 * - `biblioteca/`— os ebooks vendidos: PDF e capa, largados à mão
 */
const RAIZ = process.cwd();

export const ASSETS = path.join(RAIZ, 'src', 'assets');
export const FONTES = path.join(ASSETS, 'fonts');
export const FAMILIARES_PNG = path.join(ASSETS, 'familiares');
export const LUAS_PNG = path.join(ASSETS, 'luas');

/**
 * `BRUXARIO_DIR_DADOS` deixa apontar `var/data` para uma cópia isolada — é o
 * que faz `npm run ensaio` (docs/reestruturacao.md, Fase 0) funcionar: sobe
 * o mesmo código, mesmas migrações, lendo de um banco que é uma cópia, nunca
 * o de produção. Ausente, cai no caminho de sempre.
 */
export const DADOS = process.env.BRUXARIO_DIR_DADOS
  ? path.resolve(process.env.BRUXARIO_DIR_DADOS)
  : path.join(RAIZ, 'var', 'data');
export const BANCO = path.join(DADOS, 'bruxario.db');
export const PEDIDOS = path.join(RAIZ, 'var', 'storage', 'orders');
export const BACKUPS = path.join(RAIZ, 'var', 'backups');

export const CONTEUDO = path.join(RAIZ, 'conteudo');

/**
 * Os ebooks da biblioteca — PDF e capa.
 *
 * ── Por que na raiz, e não em `src/assets` ────────────────────────────────
 *
 * Porque é uma pasta de LARGAR ARQUIVO. Quem põe um livro novo ali não está
 * mexendo em código, e enterrar isso três níveis dentro de `src/` transforma
 * uma tarefa de dois segundos numa caça ao diretório certo.
 *
 * A convenção continua valendo: é lido em runtime e nunca escrito pelo app,
 * como `src/assets`. A diferença é só quem mexe.
 *
 * Vai no repositório de propósito. O `rsync` do deploy leva a raiz inteira
 * menos o que está excluído — então o livro chega em produção junto do
 * código. Em `var/` cada livro novo viraria um upload manual esquecível, e
 * esquecer significa vender um PDF que não existe do outro lado.
 */
export const BIBLIOTECA = path.join(RAIZ, 'biblioteca');
export const BIBLIOTECA_PDFS = path.join(BIBLIOTECA, 'pdfs');
export const BIBLIOTECA_CAPAS = path.join(BIBLIOTECA, 'capas');
export const ENV = path.join(RAIZ, '.env');

export function pastaDoPedido(pedidoId: string) {
  return path.join(PEDIDOS, pedidoId);
}

/**
 * A arte do familiar já fundida com a fase da lua da pessoa.
 *
 * São 48 arquivos prontos (12 familiares × 4 luas), gerados uma vez por
 * `npm run gerar-fusoes`. **Custo zero por pessoa** — é o que torna possível
 * mostrar a aparência do familiar a quem ainda não comprou: a leitura, que
 * custa uma chamada de IA, continua trancada.
 */
export function familiarFundidaPng(familiarId: string, lua: string) {
  return path.join(RAIZ, 'conteudo', 'fundidas', lua, `${familiarId}.png`);
}

export function familiarPng(familiarId: string) {
  return path.join(FAMILIARES_PNG, `${familiarId}.png`);
}

export function luaPng(lua: string) {
  return path.join(LUAS_PNG, `${lua}.png`);
}
