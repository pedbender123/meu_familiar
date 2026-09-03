import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { BIBLIOTECA_PDFS, BIBLIOTECA } from '../src/lib/caminhos';

/**
 * PDF → texto limpo, dividido em capítulos.
 *
 * ── Por que o texto, e não o PDF ──────────────────────────────────────────
 *
 * "Fica mais leve" é o argumento fraco: um ebook tem 2–5 MB e mora em disco,
 * o texto tem 200 KB. Numa base pequena isso não se sente.
 *
 * O motivo real é que **PDF não é lugar de ler no celular**. É zoom, pinça e
 * rolagem lateral, num visualizador cinza do navegador — a pessoa sai do
 * mundo do produto (pergaminho, vela, tipografia) e o livro vira anexo.
 *
 * Com o texto aqui dentro, três coisas passam a existir e nenhuma delas é
 * possível com PDF: continuar de onde parou, som de fundo acompanhando a
 * leitura, e saber quem realmente leu — que é o indicador de churn mais forte
 * que um acervo tem.
 *
 * ── Por que `pdftotext`, e não uma biblioteca de Node ─────────────────────
 *
 * Ele é o extrator do Poppler, o mesmo que o Linux inteiro usa, e resolve
 * ligaduras, encoding e ordem de leitura melhor que qualquer coisa em JS. O
 * custo medido: 0,2 s e 17 MB no maior dos livros. A escolha "local ou VPS"
 * não chega a existir — isto roda uma vez por livro, na máquina de quem
 * estiver revisando.
 *
 * ── O que ele NÃO faz ─────────────────────────────────────────────────────
 *
 * OCR. Um PDF escaneado não tem camada de texto, e o que sai dele é ruído —
 * `22-regras-de-ouro-para-adivinhos.pdf` devolve 3.513 caracteres de lixo
 * para 342 KB de arquivo. O script detecta isso e **recusa**, em vez de
 * gravar ruído no banco e alguém descobrir lendo.
 *
 * Uso:
 *   npx tsx scripts/extrair-ebook.ts                  # todos os PDFs da pasta
 *   npx tsx scripts/extrair-ebook.ts plano_astral     # só um
 */

const PASTA_TEXTO = path.join(BIBLIOTECA, 'texto');

/**
 * Abaixo disto, o PDF é imagem.
 *
 * Um livro de verdade tem uns 1.500 caracteres por página. Duzentos é o chão
 * de "tem texto de verdade aqui" com folga para livro ilustrado — abaixo
 * disso é camada de texto ausente ou quebrada, e o certo é recusar.
 */
const MINIMO_DE_CARACTERES_POR_PAGINA = 200;

interface Capitulo {
  titulo: string;
  paragrafos: string[];
}

/** Roda o `pdftotext` numa página só, para poder comparar páginas entre si. */
function textoDaPagina(pdf: string, pagina: number): string {
  try {
    return execFileSync(
      'pdftotext',
      ['-f', String(pagina), '-l', String(pagina), '-enc', 'UTF-8', pdf, '-'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
  } catch {
    return '';
  }
}

function contarPaginas(pdf: string): number {
  try {
    const saida = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
    const achado = saida.match(/^Pages:\s+(\d+)/m);
    return achado ? Number(achado[1]) : 0;
  } catch {
    // Sem `pdfinfo`, extrai tudo de uma vez e perde a detecção de cabeçalho.
    return 0;
  }
}

/**
 * As linhas que se repetem página após página: cabeçalho, rodapé, marca d'água.
 *
 * ── Por que por repetição, e não por posição ──────────────────────────────
 *
 * A tentação é cortar "a primeira e a última linha de cada página". Isso come
 * o começo de um capítulo que abre no topo e a última frase de um parágrafo
 * que fecha embaixo — e o estrago só aparece quando alguém lê.
 *
 * Repetição é a evidência de verdade: "Biblioteca Esotérica Virtual" aparece
 * em 200 páginas; nenhuma frase do livro aparece em mais de uma.
 */
function linhasRepetidas(paginas: string[]): Set<string> {
  const contagem = new Map<string, number>();

  for (const pagina of paginas) {
    // Só as bordas: uma frase repetida no MIOLO é do texto, não moldura.
    const linhas = pagina.split('\n').map((l) => l.trim()).filter(Boolean);
    const bordas = [...linhas.slice(0, 2), ...linhas.slice(-2)];
    for (const linha of new Set(bordas)) {
      contagem.set(linha, (contagem.get(linha) ?? 0) + 1);
    }
  }

  const limite = Math.max(3, Math.floor(paginas.length * 0.3));
  const repetidas = new Set<string>();
  for (const [linha, n] of contagem) {
    if (n < limite) continue;
    // Linha longa que se repete é mais provável ser epígrafe que cabeçalho.
    if (linha.length > 90) continue;
    /*
      ── O piso de tamanho, e o estrago que ele evita ──────────────────────

      Sem ele, este filtro comia PALAVRAS. Em texto justificado o PDF quebra
      linha no meio da frase, então "de", "e", "que" caem sozinhos na borda de
      dezenas de páginas — e passavam no teste de repetição como se fossem
      cabeçalho.

      O resultado apareceu no texto extraído como parágrafos de uma palavra
      só: "quase", "sempre", "de", "aparência". Cabeçalho de livro tem título
      ou fonte; oito caracteres é o chão com folga.
    */
    if (linha.length < 8) continue;
    repetidas.add(linha);
  }
  return repetidas;
}

/** `1`, `- 12 -`, `Página 3`: numeração de página sozinha numa linha. */
function ehNumeroDePagina(linha: string): boolean {
  return /^[-–—\s]*(p[áa]g(ina)?\.?\s*)?\d{1,4}[-–—\s]*$/i.test(linha.trim());
}

/**
 * Junta as linhas em parágrafos.
 *
 * O PDF quebra linha onde a MARGEM acabou, não onde o parágrafo acabou. Sem
 * isto, o texto chega no leitor com uma quebra a cada dez palavras e a leitura
 * fica picotada — que é exatamente o defeito do PDF que estamos fugindo.
 */
function juntarParagrafos(linhas: string[]): string[] {
  const paragrafos: string[] = [];
  let atual = '';

  const fechar = () => {
    const limpo = atual.replace(/\s+/g, ' ').trim();
    if (limpo) paragrafos.push(limpo);
    atual = '';
  };

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) {
      fechar();
      continue;
    }

    /*
      Hifenização de fim de linha: `pala-` + `vra` = `palavra`.

      Só quando a próxima começa em minúscula — `bem-` seguido de `Estar` no
      começo de uma frase nova não é a mesma palavra partida.
    */
    if (/[a-zà-ú]-$/.test(atual)) {
      atual = atual.slice(0, -1) + linha;
      continue;
    }

    atual = atual ? `${atual} ${linha}` : linha;
  }
  fechar();

  return costurar(paragrafos);
}

/**
 * Junta o que ficou partido no meio da frase.
 *
 * ── Por que uma segunda passada ───────────────────────────────────────────
 *
 * A primeira usa a linha em branco como fim de parágrafo, que é a convenção
 * certa — e o PDF não a respeita. Quebra de página, espaçamento justificado e
 * uma linha removida por engano produzem cortes onde a frase continua.
 *
 * A evidência de que o corte é falso está no próprio texto: **parágrafo não
 * termina no meio da frase.** Se o pedaço anterior não fecha com pontuação de
 * fim e o seguinte começa em minúscula, os dois são um só.
 *
 * Conservadora de propósito: emendar dois parágrafos que eram dois é um
 * defeito de leitura; partir uma frase ao meio é o texto parecendo quebrado,
 * que é o que faz alguém achar que o produto é mal feito.
 */
function costurar(paragrafos: string[]): string[] {
  const costurados: string[] = [];

  for (const p of paragrafos) {
    const anterior = costurados[costurados.length - 1];
    const continua =
      anterior &&
      !/[.!?:;»"”')\]]$/.test(anterior) &&
      /^[a-zà-ÿ(]/.test(p);

    if (continua) costurados[costurados.length - 1] = `${anterior} ${p}`;
    else costurados.push(p);
  }

  return costurados;
}

/**
 * Onde um capítulo começa.
 *
 * Três formas, todas vistas nos livros reais desta pasta:
 * `CAPÍTULO IV`, `2 − A ORDEM NATURAL`, e o título em caixa alta sozinho.
 *
 * Erra para menos de propósito: um capítulo não detectado vira texto corrido
 * dentro do anterior, que é feio. Uma linha do meio do texto detectada como
 * capítulo parte um parágrafo ao meio e cria um índice com entradas que não
 * são nada — muito pior de revisar.
 */
function ehTituloDeCapitulo(linha: string): boolean {
  const l = linha.trim();
  if (l.length < 3 || l.length > 80) return false;

  /*
    ── O numeral precisa ser um numeral inteiro ────────────────────────────

    A primeira versão usava `\s+[ivxlcdm\d]` — uma classe de caracteres, que
    casa com a PRIMEIRA LETRA da palavra seguinte. "capítulo veremos uma
    lista" virou um capítulo porque `v` está em `[ivxlcdm]`, e "parte daquilo
    que naquele sistema" porque `d` está.

    O estrago não é cosmético: cada falso positivo PARTE UM PARÁGRAFO AO MEIO
    e cria uma entrada de índice que não é nada — o leitor abre "capítulo
    veremos uma lista" e cai no meio de uma frase.

    `(?:[IVXLCDM]{1,7}|\d{1,3})(?=[\s.:−–—-]|$)` exige o numeral inteiro,
    seguido de fim de linha ou pontuação. E em MAIÚSCULA: `capítulo v` no meio
    de uma frase é conversa, `CAPÍTULO V` é título.
  */
  if (/^(cap[ií]tulo|parte|m[óo]dulo|livro)\s+(?:[IVXLCDM]{1,7}|\d{1,3})(?=[\s.:−–—-]|$)/i.test(l)) {
    return true;
  }
  if (/^[IVXLCDM]{1,7}\s*[−–—-]\s*\p{Lu}/u.test(l)) return true;
  if (/^\d{1,2}\s*[−–—-]\s*\p{Lu}/u.test(l)) return true;

  /*
    Título em caixa alta sozinho na linha.

    Exige duas letras maiúsculas seguidas e nenhuma minúscula — o que aceita
    "ÁRIES" e "MAGIA ELEMENTAL" e recusa qualquer linha de texto corrido, que
    sempre tem minúscula. Terminar em ponto final também derruba: título não
    termina em ponto, frase termina.
  */
  if (/^[\p{Lu}\d\s−–—:'"()]+$/u.test(l) && /\p{Lu}{2}/u.test(l) && !/[.!?]$/.test(l)) {
    return true;
  }
  return false;
}

function extrair(pdf: string): { capitulos: Capitulo[]; paginas: number; caracteres: number } {
  const paginas = contarPaginas(pdf);
  const textos: string[] = [];

  if (paginas > 0) {
    for (let p = 1; p <= paginas; p++) textos.push(textoDaPagina(pdf, p));
  } else {
    textos.push(
      execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
    );
  }

  const moldura = linhasRepetidas(textos);

  const linhasLimpas: string[] = [];
  for (const pagina of textos) {
    for (const bruta of pagina.split('\n')) {
      const linha = bruta.replace(/ /g, ' ').trimEnd();
      const cortada = linha.trim();
      if (moldura.has(cortada)) continue;
      if (ehNumeroDePagina(cortada)) continue;
      /*
        Linha de sumário: `Cores................ 11`. O modo de leitura monta o
        próprio índice a partir dos capítulos, então o sumário do PDF é ruído
        que apareceria como um capítulo de pontinhos.
      */
      if (/\.{4,}\s*\d+\s*$/.test(cortada)) continue;
      linhasLimpas.push(linha);
    }
    // A quebra de página vale como quebra de parágrafo — o parágrafo que
    // atravessa a página é raro, e emendar dois é pior que separar um.
    linhasLimpas.push('');
  }

  const capitulos: Capitulo[] = [];
  let atual: { titulo: string; linhas: string[] } = { titulo: 'Início', linhas: [] };

  for (const linha of linhasLimpas) {
    if (ehTituloDeCapitulo(linha)) {
      if (atual.linhas.some((l) => l.trim())) {
        capitulos.push({ titulo: atual.titulo, paragrafos: juntarParagrafos(atual.linhas) });
      }
      atual = { titulo: linha.trim(), linhas: [] };
      continue;
    }
    atual.linhas.push(linha);
  }
  if (atual.linhas.some((l) => l.trim())) {
    capitulos.push({ titulo: atual.titulo, paragrafos: juntarParagrafos(atual.linhas) });
  }

  const caracteres = capitulos.reduce(
    (s, c) => s + c.paragrafos.reduce((t, p) => t + p.length, 0),
    0
  );

  return { capitulos, paginas: paginas || 1, caracteres };
}

function principal() {
  const filtro = process.argv[2];
  const pdfs = fs
    .readdirSync(BIBLIOTECA_PDFS)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .filter((f) => !filtro || f.toLowerCase().includes(filtro.toLowerCase()));

  if (pdfs.length === 0) {
    console.log('Nenhum PDF em biblioteca/pdfs/.');
    return;
  }

  fs.mkdirSync(PASTA_TEXTO, { recursive: true });

  for (const nome of pdfs) {
    const pdf = path.join(BIBLIOTECA_PDFS, nome);
    const { capitulos, paginas, caracteres } = extrair(pdf);

    const porPagina = Math.round(caracteres / paginas);
    console.log(`\n── ${nome}`);
    console.log(`   ${paginas} páginas · ${caracteres.toLocaleString('pt-BR')} caracteres · ${porPagina}/página`);

    if (porPagina < MINIMO_DE_CARACTERES_POR_PAGINA) {
      console.log(
        `   RECUSADO: ${porPagina} caracteres por página é camada de texto ausente.\n` +
          '   Este PDF é imagem escaneada e precisa de OCR — o que sairia daqui\n' +
          '   seria ruído, e ruído gravado no banco alguém descobre lendo.'
      );
      continue;
    }

    const saida = path.join(PASTA_TEXTO, nome.replace(/\.pdf$/i, '.txt'));
    const corpo = capitulos
      .map((c) => `\n\n## ${c.titulo}\n\n${c.paragrafos.join('\n\n')}`)
      .join('');

    fs.writeFileSync(saida, corpo.trim() + '\n', 'utf8');
    console.log(`   ${capitulos.length} capítulos → ${saida}`);
    for (const c of capitulos.slice(0, 12)) {
      console.log(`     · ${c.titulo.slice(0, 60)} (${c.paragrafos.length} parágrafos)`);
    }
    if (capitulos.length > 12) console.log(`     … e mais ${capitulos.length - 12}`);
  }
  console.log('');
}

principal();
