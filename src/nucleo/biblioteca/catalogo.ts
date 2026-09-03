import fs from 'fs';
import path from 'path';
import { BIBLIOTECA_TEXTO, BIBLIOTECA_CAPAS, BIBLIOTECA_PDFS } from '../../lib/caminhos';

/**
 * A biblioteca: os ebooks que o Bruxário vende e entrega.
 *
 * ── Três portas para o mesmo livro ────────────────────────────────────────
 *
 * 1. **Order bump no checkout** — marcado junto da Revelação ou da Completa,
 *    pelo preço de impulso. É o foco de hoje: quem está com o cartão na mão
 *    já decidiu comprar, e a decisão de somar R$ 9,90 é muito mais barata que
 *    a decisão de comprar do zero.
 * 2. **Avulso dentro do app** — quem não marcou no checkout pode desbloquear
 *    depois, pelo mesmo preço.
 * 3. **Incluído na assinatura** — assinante ativo vê todos, sem comprar.
 *
 * A terceira é a que muda o produto. A assinatura hoje vende Oráculo e
 * Calendário, que são consumo; a biblioteca é acervo, e acervo é o que faz a
 * pessoa achar que perderia algo ao cancelar.
 *
 * ── Por que o catálogo é código, e não tabela ─────────────────────────────
 *
 * São três livros, com preço que entra em cobrança. Preço em tabela editável
 * é preço que alguém muda por engano numa terça-feira, e o único jeito de
 * descobrir é uma venda cobrada errado. Aqui um preço novo passa por revisão
 * e deploy, como todo preço deste projeto (ver `modelo-de-venda.ts`).
 *
 * Quando forem trinta livros isto vira tabela. Com três, não é.
 *
 * ── Onde ficam os arquivos ────────────────────────────────────────────────
 *
 *     biblioteca/texto/    O LIVRO — Markdown, e é ele que a pessoa lê
 *     biblioteca/capas/    a imagem da capa
 *     biblioteca/pdfs/     a fonte de pesquisa, quando houve uma
 *
 * O PDF deixou de ser o produto. Ele não sabe carregar trilha de fundo, nem
 * bloco de prática, nem onde a pessoa parou — e no celular é zoom e rolagem
 * lateral num visualizador cinza, fora do mundo do produto. Ver `formato.ts`.
 *
 * Na raiz porque é uma pasta de largar arquivo: quem põe um livro novo ali
 * não está mexendo em código. Ver `BIBLIOTECA` em `caminhos.ts`.
 *
 * O nome do arquivo é o que liga um ao outro — `arquivo` e `capa` abaixo.
 * Nome errado não quebra nada: o livro simplesmente não aparece, porque
 * `ebookEntregavel` não acha o PDF.
 */

export interface Ebook {
  id: string;
  /** O nome na capa e no recibo. */
  titulo: string;
  /** A promessa em uma linha — é o que decide o bump no checkout. */
  promessa: string;
  precoCentavos: number;
  /**
   * O nome do Markdown em `biblioteca/texto/`. **É ele o produto.**
   *
   * O PDF de origem, quando existe, é matéria-prima de pesquisa e fica em
   * `biblioteca/pdfs/` — não é o que a pessoa recebe.
   */
  arquivo: string;
  /** Nome da capa dentro de `src/assets/biblioteca/capas/`. */
  capa: string;
  /** A ordem na vitrine e no checkout. Menor primeiro. */
  ordem: number;
}

/**
 * Os três primeiros.
 *
 * A ordem é do mais barato para o mais caro de propósito: no checkout, o
 * primeiro item ancora o preço dos outros dois, e âncora baixa faz R$ 17,90
 * parecer o degrau natural em vez do salto.
 */
export const EBOOKS: readonly Ebook[] = [
  {
    id: 'magia-elemental',
    titulo: 'Aprenda Magia Elemental em 7 Dias',
    promessa: 'Um elemento por dia, com o ritual de cada um.',
    precoCentavos: 990,
    arquivo: 'magia-elemental.md',
    capa: 'magia-elemental.jpg',
    ordem: 1,
  },
  {
    id: 'ler-o-futuro',
    titulo: 'Aprenda Como Ler seu Futuro com Cartas',
    promessa: 'As tiragens que respondem pergunta de verdade.',
    precoCentavos: 1490,
    arquivo: 'ler-o-futuro.md',
    capa: 'ler-o-futuro.jpg',
    ordem: 2,
  },
  {
    id: 'terceiro-olho',
    titulo: 'Aprenda a Despertar seu Terceiro Olho',
    promessa: 'O treino de percepção, sem misticismo vazio.',
    precoCentavos: 1790,
    arquivo: 'terceiro-olho.md',
    capa: 'terceiro-olho.jpg',
    ordem: 3,
  },
] as const;

export const IDS_DE_EBOOK = new Set(EBOOKS.map((e) => e.id));

export function buscarEbook(id: string | null | undefined): Ebook | undefined {
  return EBOOKS.find((e) => e.id === id);
}

/** Exportada para o teste conferir o que existe em disco. */
export const PASTA_DA_BIBLIOTECA = BIBLIOTECA_TEXTO;

/** O Markdown do livro — o que a pessoa lê. */
export function caminhoDoTexto(ebook: Ebook): string {
  return path.join(BIBLIOTECA_TEXTO, ebook.arquivo);
}

/**
 * O PDF de origem, se existir. Só pesquisa: nem todo livro tem um, e nenhum
 * leitor recebe este arquivo.
 */
export function caminhoDoPdfDeOrigem(ebook: Ebook): string {
  return path.join(BIBLIOTECA_PDFS, ebook.arquivo.replace(/\.md$/, '.pdf'));
}

export function caminhoDaCapa(ebook: Ebook): string {
  return path.join(BIBLIOTECA_CAPAS, ebook.capa);
}

/**
 * O livro está pronto para ser vendido?
 *
 * ── Por que isto existe, e por que é checado em runtime ───────────────────
 *
 * O catálogo nasce antes dos arquivos: o texto e as capas chegam depois. Um
 * livro anunciado no checkout cujo Markdown não está em disco é a pior falha
 * possível deste fluxo — a pessoa paga a mais, o pagamento confirma, e a
 * leitura abre vazia. Ela pagou por um livro que não existe.
 *
 * Então o checkout só oferece o que ele consegue entregar, conferindo o
 * disco. Enquanto o PDF não chegar, o livro simplesmente não aparece — e
 * ninguém paga por ele.
 */
export function ebookEntregavel(ebook: Ebook): boolean {
  try {
    return fs.existsSync(caminhoDoTexto(ebook));
  } catch {
    return false;
  }
}

/**
 * O que pode ser oferecido AGORA — no checkout e na vitrine da biblioteca.
 *
 * Vazio enquanto nenhum PDF tiver chegado, e é assim que tem que ser: sem
 * arquivo não há oferta.
 */
export function ebooksAVenda(): Ebook[] {
  return EBOOKS.filter(ebookEntregavel).sort((a, b) => a.ordem - b.ordem);
}

/**
 * O que o checkout precisa saber para desenhar os bumps.
 *
 * O preço vai junto **para desenhar**, não para cobrar: o navegador mostra
 * este número e devolve só o id. Quem soma o que será debitado é
 * `somaDosBumps`, aqui no servidor.
 *
 * `capa: null` quando o arquivo não chegou — o livro vende sem imagem.
 */
export function ebooksParaCheckout(): {
  id: string;
  titulo: string;
  promessa: string;
  precoCentavos: number;
  capa: string | null;
}[] {
  return ebooksAVenda().map((e) => ({
    id: e.id,
    titulo: e.titulo,
    promessa: e.promessa,
    precoCentavos: e.precoCentavos,
    capa: fs.existsSync(caminhoDaCapa(e)) ? `/api/biblioteca/${e.id}/capa` : null,
  }));
}

/**
 * O preço de uma lista de ids, ignorando o que não existe ou não é entregável.
 *
 * É a única função que soma dinheiro de bump, e ela é usada tanto pela tela
 * quanto pela cobrança — o que impede a tela mostrar um total e o cartão ser
 * debitado por outro.
 *
 * Ids repetidos contam uma vez: marcar o mesmo livro duas vezes é erro de
 * cliente, não pedido de dois exemplares de um PDF.
 */
export function somaDosBumps(ids: readonly string[]): number {
  const unicos = new Set(ids);
  let total = 0;
  for (const id of unicos) {
    const ebook = buscarEbook(id);
    if (ebook && ebookEntregavel(ebook)) total += ebook.precoCentavos;
  }
  return total;
}

/**
 * A lista limpa, do jeito que ela pode ser gravada no pedido.
 *
 * O navegador manda o que quiser; daqui só sai id que existe no catálogo e
 * tem arquivo em disco. Sem isto, um POST à mão com `["gratis"]` viraria uma
 * linha de desbloqueio para um livro inventado.
 */
export function bumpsValidos(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  const limpos = bruto
    .filter((v): v is string => typeof v === 'string')
    .filter((id) => {
      const ebook = buscarEbook(id);
      return !!ebook && ebookEntregavel(ebook);
    });
  return [...new Set(limpos)].sort();
}
