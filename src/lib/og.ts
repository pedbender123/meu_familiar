import sharp from 'sharp';
import path from 'path';
import { ASSETS, familiarPng, luaPng } from './caminhos';
import type { Familiar, LuaId } from './familiares';

/**
 * Os cards de compartilhamento (Open Graph).
 *
 * ── Por que arte própria e não reaproveitar o story ───────────────────────
 *
 * O card é **1200×630, horizontal**. As artes do produto são 1080×1920,
 * verticais. Cortar uma no meio decapitaria o animal ou perderia o nome — não
 * é questão de gosto, é de proporção incompatível.
 *
 * ── Duas famílias de card ─────────────────────────────────────────────────
 *
 * **Institucional** (landing, mural, método): a cena do grimório à luz de
 * vela, com o texto composto por cima. A cena tem o vazio à direita de
 * propósito; é ali que o texto cabe sem cobrir a vela.
 *
 * **Por revelação**: lua + animal + o nome da pessoa. Este é o que importa
 * para crescer — quando alguém compartilha o próprio link, o card mostra o
 * familiar DELA, não um genérico. É a diferença entre "olha esse site" e
 * "olha o que me encontrou".
 */
export const OG_LARGURA = 1200;
export const OG_ALTURA = 630;

const CORES = {
  tinta: '#171225',
  pergaminho: '#EAE0CC',
  vela: '#D9A441',
  violeta: '#7B6394',
};

/**
 * Quebra em no máximo duas linhas, sem passar de `max` caracteres cada.
 *
 * Sem isto a linha de apoio invadia o livro e a vela — a área cheia da imagem
 * —, e texto claro sobre detalhe some. O card é lido em miniatura: o que não
 * couber no vazio da direita não deve existir.
 */
function quebrar(texto: string, max: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (tentativa.length > max && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 2);
}

function escapar(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Card institucional: a cena real, com texto no vazio da direita.
 *
 * O texto fica alinhado à direita e ocupa pouco mais de um terço da largura —
 * o card é lido em miniatura no WhatsApp, então título curto e grande vence
 * frase comprida e pequena.
 */
export async function gerarOgInstitucional(params: {
  titulo: string;
  linha?: string;
}): Promise<Buffer> {
  const { titulo, linha } = params;

  const cena = await sharp(path.join(ASSETS, 'og', 'cena-base.jpeg'))
    .resize(OG_LARGURA, OG_ALTURA, { fit: 'cover', position: 'left top' })
    .toBuffer();

  // Véu escuro só do meio para a direita: garante contraste do texto sem
  // apagar a vela, que é o que dá identidade à imagem.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_LARGURA}" height="${OG_ALTURA}">
  <defs>
    <linearGradient id="veu" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${CORES.tinta}" stop-opacity="0"/>
      <stop offset="42%" stop-color="${CORES.tinta}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${CORES.tinta}" stop-opacity="0.86"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${OG_LARGURA}" height="${OG_ALTURA}" fill="url(#veu)"/>

  <text x="${OG_LARGURA - 70}" y="248" text-anchor="end"
        font-family="Sora" font-weight="300" font-size="21"
        letter-spacing="7" fill="${CORES.violeta}">BRUXÁRIO</text>

  <text x="${OG_LARGURA - 70}" y="332" text-anchor="end"
        font-family="Cormorant Garamond" font-style="italic" font-weight="600"
        font-size="62" fill="${CORES.pergaminho}">${escapar(titulo)}</text>

  ${
    linha
      ? quebrar(linha, 34)
          .map(
            (l, i) =>
              `<text x="${OG_LARGURA - 70}" y="${384 + i * 34}" text-anchor="end"
                 font-family="Sora" font-weight="300" font-size="24"
                 fill="${CORES.pergaminho}" opacity="0.72">${escapar(l)}</text>`
          )
          .join('\n  ')
      : ''
  }
</svg>`;

  return sharp(cena)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/**
 * Card de uma revelação: o familiar da pessoa.
 *
 * A lua entra como fundo recortado (mesma lógica do resto: a borda irregular
 * dela é papel rasgado, não parte da arte), o animal à esquerda, o texto à
 * direita. Espelha a composição do card institucional de propósito — quem vir
 * os dois reconhece que são o mesmo produto.
 */
export async function gerarOgDaRevelacao(params: {
  nome: string;
  familiar: Familiar;
  lua: LuaId;
  nomeSecreto: string;
}): Promise<Buffer> {
  const { nome, familiar, lua, nomeSecreto } = params;

  const meta = await sharp(luaPng(lua)).metadata();
  const margem = Math.round((meta.width ?? 2048) * 0.06);
  const fundo = await sharp(luaPng(lua))
    .extract({
      left: margem,
      top: margem,
      width: (meta.width ?? 2048) - margem * 2,
      height: (meta.height ?? 2048) - margem * 2,
    })
    .resize(OG_LARGURA, OG_ALTURA, { fit: 'cover' })
    .toBuffer();

  const tamanho = Math.round(OG_ALTURA * 0.82);
  const animal = await sharp(familiarPng(familiar.id))
    .resize(tamanho, tamanho, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_LARGURA}" height="${OG_ALTURA}">
  <defs>
    <linearGradient id="veu" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${CORES.tinta}" stop-opacity="0.15"/>
      <stop offset="38%" stop-color="${CORES.tinta}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${CORES.tinta}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${OG_LARGURA}" height="${OG_ALTURA}" fill="url(#veu)"/>

  <text x="${OG_LARGURA - 64}" y="228" text-anchor="end"
        font-family="Sora" font-weight="300" font-size="19"
        letter-spacing="6" fill="${CORES.violeta}">O FAMILIAR DE</text>

  <text x="${OG_LARGURA - 64}" y="308" text-anchor="end"
        font-family="Pinyon Script" font-size="72"
        fill="${CORES.vela}">${escapar(nome)}</text>

  <text x="${OG_LARGURA - 64}" y="372" text-anchor="end"
        font-family="Cormorant Garamond" font-style="italic" font-weight="600"
        font-size="40" fill="${CORES.pergaminho}">${escapar(familiar.nome)} · ${escapar(nomeSecreto)}</text>

  <text x="${OG_LARGURA - 64}" y="424" text-anchor="end"
        font-family="Sora" font-weight="300" font-size="20"
        letter-spacing="3" fill="${CORES.pergaminho}" opacity="0.6">bruxario.com.br</text>
</svg>`;

  return sharp({
    create: {
      width: OG_LARGURA,
      height: OG_ALTURA,
      channels: 4,
      background: CORES.tinta,
    },
  })
    .composite([
      { input: fundo, top: 0, left: 0 },
      {
        input: animal,
        top: Math.round((OG_ALTURA - tamanho) / 2),
        left: Math.round(OG_LARGURA * 0.04),
      },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}
