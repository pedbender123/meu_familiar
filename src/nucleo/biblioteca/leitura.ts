import fs from 'fs';
import { buscarEbook, caminhoDoTexto, type Ebook } from './catalogo';
import { lerLivro, type LivroLido } from './formato';

/**
 * O livro pronto para ser lido — texto em disco virando estrutura.
 *
 * ── Por que tem memória ───────────────────────────────────────────────────
 *
 * O Markdown não muda entre um leitor e outro: ele só muda quando alguém
 * publica uma versão nova. Reprocessar 3.000 palavras a cada navegação entre
 * capítulos é trabalho jogado fora, e a navegação entre capítulos é
 * exatamente o que a pessoa mais faz aqui.
 *
 * A memória é invalidada pela data de modificação do arquivo, não por tempo:
 * assim o livro corrigido aparece na próxima leitura, sem reiniciar nada, e o
 * livro que ninguém tocou nunca é lido do disco duas vezes.
 */

interface NaMemoria {
  em: number;
  livro: LivroLido;
}

const memoria = new Map<string, NaMemoria>();

export interface LivroParaLer {
  ebook: Ebook;
  livro: LivroLido;
}

export function lerEbook(id: string): LivroParaLer | null {
  const ebook = buscarEbook(id);
  if (!ebook) return null;

  const caminho = caminhoDoTexto(ebook);

  let modificadoEm: number;
  try {
    modificadoEm = fs.statSync(caminho).mtimeMs;
  } catch {
    // Sem arquivo não há livro. `ebookEntregavel` já barra isso antes da
    // venda; aqui é a rede para o arquivo sumir depois.
    return null;
  }

  const guardado = memoria.get(ebook.id);
  if (guardado && guardado.em === modificadoEm) {
    return { ebook, livro: guardado.livro };
  }

  const livro = lerLivro(fs.readFileSync(caminho, 'utf8'));
  memoria.set(ebook.id, { em: modificadoEm, livro });
  return { ebook, livro };
}

export interface CapituloLocalizado {
  moduloIndice: number;
  capituloIndice: number;
  moduloTitulo: string;
}

/**
 * A lista plana de capítulos, na ordem de leitura.
 *
 * O sumário é hierárquico (módulo → capítulo), mas "próximo capítulo" é uma
 * linha reta que atravessa os módulos. Manter as duas visões a partir da
 * mesma fonte evita o clássico: o botão de avançar parar no fim do módulo
 * porque quem escreveu o botão esqueceu que existe o módulo seguinte.
 */
export function capitulosEmOrdem(livro: LivroLido): CapituloLocalizado[] {
  const plano: CapituloLocalizado[] = [];
  livro.modulos.forEach((modulo, moduloIndice) => {
    modulo.capitulos.forEach((_, capituloIndice) => {
      plano.push({ moduloIndice, capituloIndice, moduloTitulo: modulo.titulo });
    });
  });
  return plano;
}
