/**
 * Gera as miniaturas veladas dos doze, para a vitrine da página de vendas.
 *
 *   npx tsx scripts/gerar-vitrine.ts
 *
 * ── Por que miniatura e não a arte original ───────────────────────────────
 *
 * As ilustrações têm de 1,6 a 4,5 MB cada. Doze delas numa landing são 30 MB
 * que ninguém no 4G espera carregar — a pessoa fecha antes da primeira
 * aparecer. Aqui saem em 420px webp, uns 30 kB cada.
 *
 * ── Por que veladas ──────────────────────────────────────────────────────
 *
 * Mostrar as doze artes inteiras entrega o produto de graça e, pior, faz a
 * pessoa escolher um favorito ANTES de responder — que é a forma mais rápida
 * de estragar um teste de personalidade. O véu deixa ver que existem doze
 * criaturas distintas e bonitas, sem deixar ler qual é qual.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { FAMILIARES, type FamiliarId } from '../src/lib/familiares';
import { familiarPng } from '../src/lib/caminhos';

const SAIDA = path.join(process.cwd(), 'public', 'vitrine');
const L = 420;

async function principal() {
  fs.mkdirSync(SAIDA, { recursive: true });

  const veu = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}">
  <defs>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#171225" stop-opacity="0.20"/>
      <stop offset="55%" stop-color="#171225" stop-opacity="0.52"/>
      <stop offset="100%" stop-color="#171225" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="${L}" height="${L}" fill="url(#v)"/>
</svg>`);

  for (const id of Object.keys(FAMILIARES) as FamiliarId[]) {
    const buf = await sharp(familiarPng(id))
      .resize(L, L, { fit: 'contain', background: '#171225' })
      .flatten({ background: '#171225' })
      .composite([{ input: veu }])
      .webp({ quality: 78 })
      .toBuffer();

    const destino = path.join(SAIDA, `${id}.webp`);
    fs.writeFileSync(destino, buf);
    console.log(`${id}.webp — ${Math.round(buf.length / 1024)} kB`);
  }
}

principal();
