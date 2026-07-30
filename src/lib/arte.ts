import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import type { Familiar, LuaId } from './familiares';
import type { Signo } from './astro';
import { glifoSvg } from './zodiaco';
import type { Leitura } from './leitura';
import { familiarPng, luaPng, pastaDoPedido } from './caminhos';

const CORES = {
  tinta: '#171225',
  pergaminho: '#EAE0CC',
  vela: '#D9A441',
  violeta: '#7B6394',
  musgo: '#4A5D4E',
};

function escapeXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function quebrarLinhas(texto: string, maxCharsPorLinha: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (tentativa.length > maxCharsPorLinha && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

interface ParametrosArte {
  nome: string;
  familiar: Familiar;
  lua: LuaId;
  signoSol: Signo;
  signoLua: Signo;
  leitura: Leitura;
}

async function compor(
  largura: number,
  altura: number,
  params: ParametrosArte
): Promise<Buffer> {
  const { nome, familiar, lua, signoSol, signoLua, leitura } = params;

  // as luas têm uma borda irregular tipo papel rasgado nas bordas — recortamos antes de cobrir
  const luaMeta = await sharp(luaPng(lua)).metadata();
  const luaLargura = luaMeta.width ?? 2048;
  const luaAltura = luaMeta.height ?? 2048;
  const margemLua = Math.round(luaLargura * 0.06);
  const fundoLua = await sharp(luaPng(lua))
    .extract({
      left: margemLua,
      top: margemLua,
      width: luaLargura - margemLua * 2,
      height: luaAltura - margemLua * 2,
    })
    .resize(largura, altura, { fit: 'cover' })
    .toBuffer();

  const glifoTamanho = Math.round(largura * 0.045);
  const solSvg = Buffer.from(glifoSvg(signoSol, { tamanho: glifoTamanho, cor: CORES.pergaminho }));
  const luaSvg = Buffer.from(glifoSvg(signoLua, { tamanho: glifoTamanho, cor: CORES.pergaminho }));

  const centroX = largura / 2;

  // bloco de texto ancorado no rodapé com espaçamentos em função da LARGURA (não da
  // altura) — assim story (1080×1920) e feed (1080×1350) ficam com a mesma
  // tipografia e o mesmo respiro entre linhas, só mudando o espaço disponível
  // para a lua/animal acima.
  const maxCharsInvocacao = Math.round(largura / 22);
  const linhasInvocacao = quebrarLinhas(leitura.frase_de_invocacao, maxCharsInvocacao);
  const alturaLinhaInvocacao = largura * 0.036;

  const gap = {
    margemInferior: largura * 0.05,
    invocacaoRodape: largura * 0.11,
    regenciaInvocacao: largura * 0.065,
    glifosRegencia: largura * 0.05,
    familiarGlifos: largura * 0.06,
    nomeFamiliar: largura * 0.05,
    eyebrowNome: largura * 0.095,
    respiroTopo: largura * 0.06,
  };

  const yRodape = altura - gap.margemInferior;
  const yInvocacaoUltimaLinha = yRodape - gap.invocacaoRodape;
  const yInvocacaoPrimeiraLinha =
    yInvocacaoUltimaLinha - alturaLinhaInvocacao * (linhasInvocacao.length - 1);
  const yRegenciaTexto = yInvocacaoPrimeiraLinha - gap.regenciaInvocacao;
  const yGlifos = yRegenciaTexto - gap.glifosRegencia;
  const yFamiliar = yGlifos - gap.familiarGlifos;
  const yNome = yFamiliar - gap.nomeFamiliar;
  const yEyebrow = yNome - gap.eyebrowNome;

  const topoBlocoTexto = yEyebrow - largura * 0.05;
  const areaTopoDisponivel = Math.max(largura * 0.5, topoBlocoTexto - gap.respiroTopo);
  const tamanhoAnimal = Math.round(Math.min(largura * 0.72, areaTopoDisponivel));
  const yAnimal = Math.round(gap.respiroTopo * 0.5);
  const xAnimal = Math.round((largura - tamanhoAnimal) / 2);

  const animal = await sharp(familiarPng(familiar.id))
    .resize(tamanhoAnimal, tamanhoAnimal, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const sombraTopo = Math.max(0, yEyebrow - largura * 0.16);
  const alturaSombra = altura - sombraTopo;

  const overlaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">
  <defs>
    <linearGradient id="sombra" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${CORES.tinta}" stop-opacity="0" />
      <stop offset="35%" stop-color="${CORES.tinta}" stop-opacity="0.82" />
      <stop offset="100%" stop-color="${CORES.tinta}" stop-opacity="0.94" />
    </linearGradient>
  </defs>
  <rect x="0" y="${sombraTopo}" width="${largura}" height="${alturaSombra}" fill="url(#sombra)" />

  <text x="${centroX}" y="${yEyebrow}" font-family="Sora" font-weight="300" font-size="${largura * 0.032}"
        letter-spacing="${largura * 0.012}" fill="${CORES.violeta}" text-anchor="middle">O FAMILIAR DE</text>

  <text x="${centroX}" y="${yNome}" font-family="Pinyon Script" font-size="${largura * 0.11}"
        fill="${CORES.vela}" text-anchor="middle">${escapeXml(nome)}</text>

  <text x="${centroX}" y="${yFamiliar}" font-family="Cormorant Garamond" font-style="italic" font-weight="600"
        font-size="${largura * 0.052}" letter-spacing="${largura * 0.0015}" fill="${CORES.pergaminho}" text-anchor="middle">${escapeXml(familiar.nome)} · ${escapeXml(leitura.nome_secreto)}</text>

  <text x="${centroX}" y="${yRegenciaTexto}" font-family="Sora" font-weight="300" font-size="${largura * 0.026}"
        letter-spacing="${largura * 0.001}" fill="${CORES.pergaminho}" text-anchor="middle" opacity="0.85">${escapeXml(leitura.regencia)}</text>

  ${linhasInvocacao
    .map(
      (linha, i) =>
        `<text x="${centroX}" y="${yInvocacaoPrimeiraLinha + i * alturaLinhaInvocacao}" font-family="Cormorant Garamond" font-style="italic"
        font-size="${largura * 0.03}" fill="${CORES.pergaminho}" opacity="0.9" text-anchor="middle">${escapeXml(linha)}</text>`
    )
    .join('\n')}

  <text x="${centroX}" y="${yRodape}" font-family="Sora" font-weight="300" font-size="${largura * 0.02}"
        letter-spacing="${largura * 0.006}" fill="${CORES.pergaminho}" opacity="0.55" text-anchor="middle">@bruxario_ · bruxario.com.br</text>
</svg>`;

  const glifoY = Math.round(yGlifos - glifoTamanho / 2);
  const glifoSolX = Math.round(centroX - largura * 0.075 - glifoTamanho);
  const glifoLuaX = Math.round(centroX + largura * 0.075);

  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: 4,
      background: CORES.tinta,
    },
  })
    .composite([
      { input: fundoLua, top: 0, left: 0 },
      { input: animal, top: yAnimal, left: xAnimal },
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
      { input: solSvg, top: glifoY, left: glifoSolX },
      { input: luaSvg, top: glifoY, left: glifoLuaX },
    ])
    .png()
    .toBuffer();
}

/**
 * A carta do familiar: lua + animal, **sem texto nenhum**.
 *
 * Story e feed existem para sair do site — vão pro Instagram, onde ninguém tem
 * o contexto, então precisam trazer nome, regência e invocação impressos. A
 * carta é o oposto: ela é exibida na tela de revelação, apoiada numa folha de
 * pergaminho que já diz tudo isso em texto de verdade. Repetir ali seria dizer
 * a mesma coisa duas vezes, uma delas em pixel que não dá pra selecionar.
 *
 * Proporção 2:3, de baralho — é o que faz a moldura ler como carta e não como
 * print recortado.
 *
 * Sai em **webp**, diferente de story e feed. Aqueles são PNG porque a pessoa
 * baixa e reposta, e PNG é o que qualquer app aceita sem reclamar. A carta só é
 * exibida na nossa tela, então o formato é escolha nossa: em PNG ela pesava
 * 4,4 MB por pedido, contra cerca de 150 kB aqui.
 */
async function comporCarta(
  largura: number,
  altura: number,
  familiar: Familiar,
  lua: LuaId
): Promise<Buffer> {
  const luaMeta = await sharp(luaPng(lua)).metadata();
  const luaLargura = luaMeta.width ?? 2048;
  const luaAltura = luaMeta.height ?? 2048;
  const margemLua = Math.round(luaLargura * 0.06);

  const fundoLua = await sharp(luaPng(lua))
    .extract({
      left: margemLua,
      top: margemLua,
      width: luaLargura - margemLua * 2,
      height: luaAltura - margemLua * 2,
    })
    .resize(largura, altura, { fit: 'cover' })
    .toBuffer();

  const tamanhoAnimal = Math.round(largura * 0.84);
  const animal = await sharp(familiarPng(familiar.id))
    .resize(tamanhoAnimal, tamanhoAnimal, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp({
    create: { width: largura, height: altura, channels: 4, background: CORES.tinta },
  })
    .composite([
      { input: fundoLua, top: 0, left: 0 },
      {
        input: animal,
        top: Math.round(altura * 0.1),
        left: Math.round((largura - tamanhoAnimal) / 2),
      },
    ])
    .webp({ quality: 86 })
    .toBuffer();
}

export async function gerarArtes(pedidoId: string, params: ParametrosArte) {
  const dir = pastaDoPedido(pedidoId);
  fs.mkdirSync(dir, { recursive: true });

  const story = await compor(1080, 1920, params);
  const feed = await compor(1080, 1350, params);
  // 2x o tamanho exibido, para tela retina
  const carta = await comporCarta(1200, 1800, params.familiar, params.lua);

  const storyPath = path.join(dir, 'story.png');
  const feedPath = path.join(dir, 'feed.png');
  const cartaPath = path.join(dir, 'carta.webp');
  fs.writeFileSync(storyPath, story);
  fs.writeFileSync(feedPath, feed);
  fs.writeFileSync(cartaPath, carta);

  return { storyPath, feedPath, cartaPath };
}
