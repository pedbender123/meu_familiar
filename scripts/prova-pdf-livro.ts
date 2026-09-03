import fs from 'fs';
import { lerEbook } from '../src/nucleo/biblioteca/leitura';
import { gerarPdfDoLivro } from '../src/lib/pdf-livro';

/** Prova de fogo do PDF do livro. Uso: npx tsx scripts/prova-pdf-livro.ts <id> */
async function main() {
  const id = process.argv[2] ?? 'magia-elemental';
  const lido = lerEbook(id);
  if (!lido) throw new Error(`livro ${id} não encontrado`);
  const pdf = await gerarPdfDoLivro(lido.livro, lido.ebook.titulo, 'Pedro');
  const destino = `/tmp/${id}.pdf`;
  fs.writeFileSync(destino, pdf);
  console.log(`${destino} · ${(pdf.length / 1024).toFixed(0)} kB · ${lido.livro.palavras} palavras`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
