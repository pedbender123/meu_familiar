import fs from 'fs';
import path from 'path';
import { TRILHAS, type Trilha } from './catalogo';

/**
 * As faixas que existem em disco, de verdade.
 *
 * Roda só no servidor (a lista chega pronta ao navegador, no layout da
 * conta). É a mesma guarda de `ebookEntregavel`: o catálogo é a intenção, o
 * disco é a verdade.
 *
 * `public/` porque é o Next que serve o arquivo direto, sem passar por rota
 * nossa — som de fundo é streaming, e cada faixa saindo por uma rota de
 * aplicação seria pagar processo por byte de mp3.
 */
export function trilhasNoAr(): Trilha[] {
  return TRILHAS.filter((trilha) => {
    try {
      return fs.existsSync(path.join(process.cwd(), 'public', trilha.arquivo));
    } catch {
      return false;
    }
  });
}
