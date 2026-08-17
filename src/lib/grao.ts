/**
 * Grão do papel gerado em Canvas e reaproveitado por toda a aplicação.
 *
 * Ruído concentrado no claro, não no escuro: papel tem fibra, não sujeira. Um
 * tile de 128px repetido custa alguns kB de data URL em vez de uma imagem que
 * o CSP do navegador teria que buscar.
 *
 * Extraído de `FolhaPergaminho` quando o livro da plataforma passou a
 * precisar da mesma textura — duas cópias do mesmo ruído dariam duas fibras
 * levemente diferentes na mesma tela, que é o tipo de coisa que ninguém
 * aponta mas todo mundo sente.
 */
let graoEmCache: string | null = null;

export function gerarGrao(): string {
  if (graoEmCache) return graoEmCache;

  const lado = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = lado;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(lado, lado);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 26 + Math.random() * 26;
  }
  ctx.putImageData(img, 0, 0);
  graoEmCache = canvas.toDataURL();
  return graoEmCache;
}
