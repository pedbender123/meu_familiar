/**
 * O formato de um livro da biblioteca: **Markdown**.
 *
 * ── Por que Markdown, e não o texto cru do PDF ────────────────────────────
 *
 * Porque o texto extraído é matéria-prima, não produto. Ele vem com
 * hifenização remendada, capítulo detectado por heurística e a voz de outro
 * autor. O livro que a pessoa lê no app é escrito — e o que se escreve é
 * Markdown, que qualquer editor abre e qualquer modelo de linguagem produz
 * sem inventar sintaxe.
 *
 * ── O que o formato precisa carregar além do texto ────────────────────────
 *
 * Um ebook em PDF é só texto. Este aqui vive dentro de um app que tem som,
 * ritual e um vocabulário próprio, então o formato tem três coisas a mais:
 *
 *   `# Módulo`      a divisão grande — as fitinhas do sumário
 *   `## Capítulo`   a divisão de leitura, o que cabe numa sentada
 *   `:::pratica`    o bloco que PEDE algo da pessoa, e para a leitura
 *
 * E a trilha: `som: <id>` logo abaixo do título do capítulo. É o que liga o
 * texto ao som de fundo — a razão de o livro morar aqui e não num PDF.
 *
 * ── Por que o `som` é opcional e nunca quebra ─────────────────────────────
 *
 * As trilhas de meditação ainda não existem. Um capítulo que pede um som
 * ausente é lido em silêncio, e ponto — o texto nunca depende do som para
 * fazer sentido. O contrário (o livro esperar por um arquivo que não chegou)
 * seria um produto que quebra sozinho no dia do lançamento.
 */

export interface BlocoDePratica {
  tipo: 'pratica';
  paragrafos: string[];
}

export interface BlocoDeTexto {
  tipo: 'texto';
  paragrafos: string[];
}

export type Bloco = BlocoDeTexto | BlocoDePratica;

export interface CapituloDoLivro {
  titulo: string;
  /** O id da trilha de fundo. `null` = lido em silêncio. */
  som: string | null;
  blocos: Bloco[];
  /** Para o "faltam 4 min" — 200 palavras por minuto, leitura tranquila. */
  minutos: number;
}

export interface ModuloDoLivro {
  titulo: string;
  capitulos: CapituloDoLivro[];
}

export interface LivroLido {
  meta: Record<string, string>;
  modulos: ModuloDoLivro[];
  palavras: number;
  minutos: number;
}

/** Leitura tranquila em voz interior. Não é velocidade de estudo. */
const PALAVRAS_POR_MINUTO = 200;

function minutosDe(palavras: number): number {
  return Math.max(1, Math.round(palavras / PALAVRAS_POR_MINUTO));
}

function contarPalavras(paragrafos: string[]): number {
  return paragrafos.reduce((s, p) => s + p.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * Lê o Markdown de um livro.
 *
 * ── Tolerante de propósito ────────────────────────────────────────────────
 *
 * Um livro pode chegar sem frontmatter, sem módulo, com capítulo antes de
 * qualquer `#`, ou com um `:::pratica` que ninguém fechou. Nada disso lança:
 * o texto vira um módulo "Livro" e a prática aberta fecha no fim do capítulo.
 *
 * O motivo é prático. Quem escreve este arquivo é uma pessoa, ou um modelo de
 * linguagem seguindo instruções — e as duas coisas erram sintaxe. Um parser
 * que explode transforma um erro de formatação num livro que não abre.
 */
export function lerLivro(markdown: string): LivroLido {
  const meta: Record<string, string> = {};
  let corpo = markdown.replace(/\r\n/g, '\n');

  const frontmatter = corpo.match(/^---\n([\s\S]*?)\n---\n?/);
  if (frontmatter) {
    for (const linha of frontmatter[1].split('\n')) {
      const par = linha.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (par) meta[par[1].trim()] = par[2].trim();
    }
    corpo = corpo.slice(frontmatter[0].length);
  }

  const modulos: ModuloDoLivro[] = [];
  let moduloAtual: ModuloDoLivro | null = null;
  let capituloAtual: CapituloDoLivro | null = null;
  let blocoAtual: Bloco | null = null;
  let dentroDePratica = false;
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    const texto = paragrafo.join(' ').replace(/\s+/g, ' ').trim();
    paragrafo = [];
    if (!texto || !capituloAtual) return;
    if (!blocoAtual) {
      const novo: Bloco = { tipo: dentroDePratica ? 'pratica' : 'texto', paragrafos: [] };
      capituloAtual.blocos.push(novo);
      blocoAtual = novo;
    }
    blocoAtual.paragrafos.push(texto);
  };

  const fecharBloco = () => {
    fecharParagrafo();
    blocoAtual = null;
  };

  const fecharCapitulo = () => {
    fecharBloco();
    dentroDePratica = false;
    if (!capituloAtual) return;
    capituloAtual.minutos = minutosDe(
      capituloAtual.blocos.reduce((s, b) => s + contarPalavras(b.paragrafos), 0)
    );
    capituloAtual = null;
  };

  /** Um capítulo sem `#` antes dele ainda precisa de um módulo para morar. */
  const garantirModulo = () => {
    if (!moduloAtual) {
      moduloAtual = { titulo: meta.titulo ?? 'Livro', capitulos: [] };
      modulos.push(moduloAtual);
    }
    return moduloAtual;
  };

  for (const bruta of corpo.split('\n')) {
    const linha = bruta.trim();

    if (linha.startsWith('# ')) {
      fecharCapitulo();
      moduloAtual = { titulo: linha.slice(2).trim(), capitulos: [] };
      modulos.push(moduloAtual);
      continue;
    }

    if (linha.startsWith('## ')) {
      fecharCapitulo();
      capituloAtual = {
        titulo: linha.slice(3).trim(),
        som: null,
        blocos: [],
        minutos: 0,
      };
      garantirModulo().capitulos.push(capituloAtual);
      continue;
    }

    /*
      `som:` só vale antes de o capítulo ter texto. Depois disso é uma linha
      que por acaso começa com "som:" no meio de um parágrafo — e trocar a
      trilha no meio da leitura por causa disso seria um susto.
    */
    const trilha = linha.match(/^som:\s*([a-z0-9-]+)$/i);
    if (trilha && capituloAtual && capituloAtual.blocos.length === 0 && !paragrafo.length) {
      capituloAtual.som = trilha[1].toLowerCase();
      continue;
    }

    if (linha === ':::pratica') {
      fecharBloco();
      dentroDePratica = true;
      continue;
    }
    if (linha === ':::') {
      fecharBloco();
      dentroDePratica = false;
      continue;
    }

    if (!linha) {
      fecharParagrafo();
      continue;
    }

    if (!capituloAtual) {
      /*
        Texto antes de qualquer `##`: é a abertura do livro. Vira um capítulo
        sem título em vez de ser descartado — perder o prefácio porque o autor
        não pôs cabeçalho seria o parser decidindo o que é conteúdo.
      */
      capituloAtual = { titulo: 'Abertura', som: null, blocos: [], minutos: 0 };
      garantirModulo().capitulos.push(capituloAtual);
    }

    paragrafo.push(linha);
  }
  fecharCapitulo();

  const palavras = modulos.reduce(
    (s, m) =>
      s +
      m.capitulos.reduce(
        (t, c) => t + c.blocos.reduce((u, b) => u + contarPalavras(b.paragrafos), 0),
        0
      ),
    0
  );

  return { meta, modulos, palavras, minutos: minutosDe(palavras) };
}
