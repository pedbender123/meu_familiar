import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();
import fs from 'fs';
import path from 'path';
import { gerarOgInstitucional } from '../src/lib/og';

/**
 * Gera os cards institucionais uma vez e grava em `public/og/`.
 *
 * Estáticos de propósito: eles não mudam por visitante, então gerar a cada
 * requisição seria queimar CPU para produzir sempre o mesmo arquivo.
 *
 * Uso: npm run gerar-og
 */
const CARDS = [
  {
    arquivo: 'inicio.png',
    titulo: 'O seu já te escolheu',
    linha: '26 cenas. O signo tem peso zero.',
  },
  {
    arquivo: 'mural.png',
    titulo: 'Quem já foi encontrado',
    linha: 'Leia uma inteira antes de decidir.',
  },
  {
    arquivo: 'metodo.png',
    titulo: 'Por que isto não é chute',
    linha: 'Publicamos o método. Confira.',
  },
];

async function main() {
  const destino = path.join(process.cwd(), 'public', 'og');
  fs.mkdirSync(destino, { recursive: true });

  for (const card of CARDS) {
    const png = await gerarOgInstitucional({ titulo: card.titulo, linha: card.linha });
    const caminho = path.join(destino, card.arquivo);
    fs.writeFileSync(caminho, png);
    console.log(`  ${card.arquivo.padEnd(14)} ${(png.length / 1024).toFixed(0)} KB`);
  }
}
main();
