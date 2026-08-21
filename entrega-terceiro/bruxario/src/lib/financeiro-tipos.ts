/**
 * Os tipos e constantes do financeiro que a TELA precisa.
 *
 * Separado de `financeiro.ts` de propósito: aquele abre o banco no topo do
 * arquivo, e um componente de cliente que importasse qualquer coisa de lá
 * arrastaria o `better-sqlite3` para o bundle do navegador — o build quebra,
 * e com uma mensagem que não diz a causa. Mesma armadilha documentada em
 * `HeroComCena.tsx`.
 *
 * Aqui só moram valores puros, que os dois lados podem ler.
 */

export const CATEGORIAS = [
  'anuncio',
  'infraestrutura',
  'ferramenta',
  'arte',
  'imposto',
  'outro',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export function ehCategoria(v: unknown): v is Categoria {
  return typeof v === 'string' && (CATEGORIAS as readonly string[]).includes(v);
}

export interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor_centavos: number;
  campanha_id: string | null;
  ocorrido_em: string;
  nota: string | null;
  criado_em: string;
}
