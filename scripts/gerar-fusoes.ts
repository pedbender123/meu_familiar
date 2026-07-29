import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { FAMILIARES, type FamiliarId, type LuaId } from '../lib/familiares';

const CORES = {
  tinta: '#171225',
  pergaminho: '#EAE0CC',
  vela: '#D9A441',
};

const ASSETS = path.join(process.cwd(), 'assets');
const SAIDA = path.join(process.cwd(), 'imagens', 'fundidas');

const LARGURA = 1080;
const ALTURA = 1920;

const LUAS: LuaId[] = ['nova', 'crescente', 'cheia', 'minguante'];

function escapeXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fundirLuaFundo(lua: LuaId): Promise<Buffer> {
  const caminho = path.join(ASSETS, 'luas', `${lua}.png`);
  const meta = await sharp(caminho).metadata();
  const luaLargura = meta.width ?? 2048;
  const luaAltura = meta.height ?? 2048;
  const margem = Math.round(luaLargura * 0.06);

  return sharp(caminho)
    .extract({
      left: margem,
      top: margem,
      width: luaLargura - margem * 2,
      height: luaAltura - margem * 2,
    })
    .resize(LARGURA, ALTURA, { fit: 'cover' })
    .toBuffer();
}

async function fundirAnimal(familiarId: FamiliarId): Promise<{ buffer: Buffer; tamanho: number; y: number; x: number }> {
  const tamanho = Math.round(LARGURA * 0.8);
  const y = Math.round(ALTURA * 0.32);
  const x = Math.round((LARGURA - tamanho) / 2);
  const buffer = await sharp(path.join(ASSETS, 'familiares', `${familiarId}.png`))
    .resize(tamanho, tamanho, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return { buffer, tamanho, y, x };
}

async function gerarUma(lua: LuaId, familiarId: FamiliarId) {
  const familiar = FAMILIARES[familiarId];
  const [fundo, animal] = await Promise.all([fundirLuaFundo(lua), fundirAnimal(familiarId)]);

  const yNome = Math.round(ALTURA * 0.88);
  const overlaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
  <defs>
    <linearGradient id="sombra" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${CORES.tinta}" stop-opacity="0" />
      <stop offset="100%" stop-color="${CORES.tinta}" stop-opacity="0.85" />
    </linearGradient>
  </defs>
  <rect x="0" y="${Math.round(ALTURA * 0.62)}" width="${LARGURA}" height="${Math.round(ALTURA * 0.38)}" fill="url(#sombra)" />
  <text x="${LARGURA / 2}" y="${yNome}" font-family="Cormorant Garamond" font-style="italic" font-weight="600"
        font-size="${LARGURA * 0.06}" fill="${CORES.vela}" text-anchor="middle">${escapeXml(familiar.nome)}</text>
</svg>`;

  const resultado = await sharp({
    create: { width: LARGURA, height: ALTURA, channels: 4, background: CORES.tinta },
  })
    .composite([
      { input: fundo, top: 0, left: 0 },
      { input: animal.buffer, top: animal.y, left: animal.x },
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  const dir = path.join(SAIDA, lua);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${familiarId}.png`), resultado);
}

async function main() {
  const familiarIds = Object.keys(FAMILIARES) as FamiliarId[];
  for (const lua of LUAS) {
    for (const familiarId of familiarIds) {
      await gerarUma(lua, familiarId);
      console.log(`- ${lua}/${familiarId}.png`);
    }
  }
  console.log(`Concluído: ${LUAS.length * familiarIds.length} imagens em imagens/fundidas/`);
}

main();
