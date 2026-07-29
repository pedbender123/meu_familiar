import { PDFDocument, rgb, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import type { Familiar } from './familiares';
import type { Leitura } from './leitura';
import { FONTES, pastaDoPedido } from './caminhos';

const A5_LARGURA = 419.53;
const A5_ALTURA = 595.28;

const COR_TINTA = rgb(0x17 / 255, 0x12 / 255, 0x25 / 255);
const COR_PERGAMINHO = rgb(0xea / 255, 0xe0 / 255, 0xcc / 255);
const COR_VELA = rgb(0xd9 / 255, 0xa4 / 255, 0x41 / 255);
const COR_VIOLETA = rgb(0x7b / 255, 0x63 / 255, 0x94 / 255);

function quebrarTexto(texto: string, fonte: PDFFont, tamanho: number, larguraMax: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) > larguraMax && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

interface ParametrosPdf {
  nome: string;
  familiar: Familiar;
  leitura: Leitura;
  storyPngPath: string;
}

export async function gerarPdf(pedidoId: string, params: ParametrosPdf): Promise<string> {
  const { nome, familiar, leitura, storyPngPath } = params;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const ler = (nome: string) => fs.readFileSync(path.join(FONTES, nome));

  // subset: false — o subsetter do pdf-lib descarta glifos indevidamente nessas fontes
  const cormorant = await pdf.embedFont(ler('CormorantGaramond-Regular-nolig.ttf'), { subset: false });
  const cormorantSemiBold = await pdf.embedFont(ler('CormorantGaramond-SemiBold-nolig.ttf'), { subset: false });
  const sora = await pdf.embedFont(ler('Sora-Regular.ttf'), { subset: false });
  const pinyon = await pdf.embedFont(ler('PinyonScript.ttf'), { subset: false });

  const margem = 40;
  const larguraTexto = A5_LARGURA - margem * 2;

  // Página 1 — capa com a arte
  const capa = pdf.addPage([A5_LARGURA, A5_ALTURA]);
  capa.drawRectangle({ x: 0, y: 0, width: A5_LARGURA, height: A5_ALTURA, color: COR_TINTA });
  const storyBytes = fs.readFileSync(storyPngPath);
  const storyImg = await pdf.embedPng(storyBytes);
  const escala = Math.max(A5_LARGURA / storyImg.width, A5_ALTURA / storyImg.height);
  const wImg = storyImg.width * escala;
  const hImg = storyImg.height * escala;
  capa.drawImage(storyImg, {
    x: (A5_LARGURA - wImg) / 2,
    y: (A5_ALTURA - hImg) / 2,
    width: wImg,
    height: hImg,
  });

  // Página 2 — a leitura em 3 atos
  const pagLeitura = pdf.addPage([A5_LARGURA, A5_ALTURA]);
  pagLeitura.drawRectangle({ x: 0, y: 0, width: A5_LARGURA, height: A5_ALTURA, color: COR_TINTA });
  pagLeitura.drawText('A leitura', {
    x: margem,
    y: A5_ALTURA - 60,
    size: 26,
    font: cormorantSemiBold,
    color: COR_VELA,
  });
  let cursorY = A5_ALTURA - 100;
  for (const paragrafo of leitura.leitura) {
    const linhas = quebrarTexto(paragrafo, sora, 11, larguraTexto);
    for (const linha of linhas) {
      if (cursorY < margem) break;
      pagLeitura.drawText(linha, {
        x: margem,
        y: cursorY,
        size: 11,
        font: sora,
        color: COR_PERGAMINHO,
        lineHeight: 16,
      });
      cursorY -= 16;
    }
    cursorY -= 14;
  }

  // Página 3 — nome secreto + invocação
  const pagNome = pdf.addPage([A5_LARGURA, A5_ALTURA]);
  pagNome.drawRectangle({ x: 0, y: 0, width: A5_LARGURA, height: A5_ALTURA, color: COR_TINTA });
  pagNome.drawText('O familiar de', {
    x: margem,
    y: A5_ALTURA - 90,
    size: 13,
    font: sora,
    color: COR_VIOLETA,
  });
  pagNome.drawText(nome, {
    x: margem,
    y: A5_ALTURA - 140,
    size: 40,
    font: pinyon,
    color: COR_VELA,
  });
  pagNome.drawText(`${familiar.nome} — ${leitura.nome_secreto}`, {
    x: margem,
    y: A5_ALTURA - 175,
    size: 16,
    font: cormorant,
    color: COR_PERGAMINHO,
  });
  const linhasInvocacao = quebrarTexto(leitura.frase_de_invocacao, cormorant, 18, larguraTexto);
  let yInvocacao = A5_ALTURA - 260;
  for (const linha of linhasInvocacao) {
    pagNome.drawText(linha, {
      x: margem,
      y: yInvocacao,
      size: 18,
      font: cormorant,
      color: COR_PERGAMINHO,
    });
    yInvocacao -= 24;
  }

  // Página 4 — contracapa: Oráculo + disclaimer
  const contracapa = pdf.addPage([A5_LARGURA, A5_ALTURA]);
  contracapa.drawRectangle({ x: 0, y: 0, width: A5_LARGURA, height: A5_ALTURA, color: COR_TINTA });
  contracapa.drawText('O Oráculo do Bruxário', {
    x: margem,
    y: A5_ALTURA - 70,
    size: 18,
    font: cormorant,
    color: COR_VELA,
  });
  const sussurro = `"${leitura.sussurro_final}"`;
  const linhasSussurro = quebrarTexto(sussurro, cormorant, 13, larguraTexto);
  let yS = A5_ALTURA - 110;
  for (const linha of linhasSussurro) {
    contracapa.drawText(linha, { x: margem, y: yS, size: 13, font: cormorant, color: COR_PERGAMINHO });
    yS -= 18;
  }
  contracapa.drawText('Em breve, o Oráculo abre as portas para responder.', {
    x: margem,
    y: yS - 20,
    size: 11,
    font: sora,
    color: COR_PERGAMINHO,
  });
  contracapa.drawText(process.env.BASE_URL ?? 'bruxario.com.br', {
    x: margem,
    y: yS - 42,
    size: 11,
    font: sora,
    color: COR_VIOLETA,
  });

  const disclaimer = quebrarTexto(
    'O Bruxário é entretenimento e autoconhecimento simbólico. As leituras são geradas com auxílio de inteligência artificial e não substituem orientação profissional de nenhuma natureza.',
    sora,
    8,
    larguraTexto
  );
  let yD = 70;
  for (const linha of disclaimer) {
    contracapa.drawText(linha, { x: margem, y: yD, size: 8, font: sora, color: COR_PERGAMINHO, opacity: 0.6 });
    yD -= 11;
  }

  const bytes = await pdf.save();
  const dir = pastaDoPedido(pedidoId);
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, 'revelacao.pdf');
  fs.writeFileSync(pdfPath, bytes);
  return pdfPath;
}
