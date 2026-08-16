import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { Familiar, FamiliarId, LuaId, Sigilo } from './familiares';
import { FAMILIARES } from './familiares';
import type { Leitura } from './leitura';
import { FONTES, pastaDoPedido, luaPng, familiarPng } from './caminhos';
import { ANGULO_DO_FAMILIAR } from './quiz/circulo';
import { DESCRICAO_DOS_EIXOS, type Eixo } from './quiz/eixos';

/**
 * A revelação inteira, em PDF.
 *
 * ── O que este arquivo é, no produto ──────────────────────────────────────
 *
 * É a **cópia permanente**. O link da Revelação fecha para estranhos em sete
 * dias, o e-mail se perde na caixa, o site pode sair do ar um dia — o PDF
 * anexado fica. Por isso ele carrega tudo: a carta, a leitura completa, os
 * gráficos de quem comprou a Completa, e o endereço para voltar.
 *
 * ── Por que pergaminho e não fundo escuro ─────────────────────────────────
 *
 * A versão anterior era papel preto com texto claro. Funcionava na tela e era
 * péssima como documento: ninguém imprime, ninguém lê no e-reader, e gasta
 * cartucho de quem tenta. Aqui é o inverso do site — a folha clara é a coisa,
 * não o quarto. É a mesma estética vista de outro lado.
 *
 * ── O sigilo é desenhado, não colado ──────────────────────────────────────
 *
 * A mesma geometria do Canvas (N pontos no círculo, ligados de `passo` em
 * `passo`), traçada com linhas de PDF. Fica vetorial: amplia sem borrar e pesa
 * alguns bytes em vez de um PNG.
 */

const A5 = { largura: 419.53, altura: 595.28 };
const MARGEM = 46;
const LARGURA_TEXTO = A5.largura - MARGEM * 2;

const COR = {
  tinta: rgb(0x17 / 255, 0x12 / 255, 0x25 / 255),
  folha: rgb(0xe7 / 255, 0xdc / 255, 0xc4 / 255),
  escrita: rgb(0x2e / 255, 0x24 / 255, 0x38 / 255),
  escritaCorpo: rgb(0x3a / 255, 0x2f / 255, 0x44 / 255),
  escritaFraca: rgb(0x6b / 255, 0x5f / 255, 0x72 / 255),
  ouro: rgb(0x8a / 255, 0x6a / 255, 0x2f / 255),
  ouroProfundo: rgb(0x6b / 255, 0x4e / 255, 0x1e / 255),
  ouroVivo: rgb(0x9a / 255, 0x6a / 255, 0x12 / 255),
  violetaVivo: rgb(0x5b / 255, 0x4a / 255, 0x8f / 255),
  vela: rgb(0xd9 / 255, 0xa4 / 255, 0x41 / 255),
  pergaminho: rgb(0xea / 255, 0xe0 / 255, 0xcc / 255),
};

interface Fontes {
  corpo: PDFFont;
  display: PDFFont;
  displayBold: PDFFont;
  ritual: PDFFont;
}

/* ── medir e quebrar texto ─────────────────────────────────────────────── */

function quebrar(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  largura: number
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(' ')) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

function centralizar(
  pagina: PDFPage,
  texto: string,
  y: number,
  fonte: PDFFont,
  tamanho: number,
  cor = COR.escrita
) {
  const largura = fonte.widthOfTextAtSize(texto, tamanho);
  pagina.drawText(texto, {
    x: (A5.largura - largura) / 2,
    y,
    size: tamanho,
    font: fonte,
    color: cor,
  });
}

/** Filete centrado: o separador que o site faz com um `<hr>` esmaecido. */
function filete(pagina: PDFPage, y: number, meiaLargura = 34) {
  pagina.drawLine({
    start: { x: A5.largura / 2 - meiaLargura, y },
    end: { x: A5.largura / 2 + meiaLargura, y },
    thickness: 0.6,
    color: COR.escrita,
    opacity: 0.45,
  });
  pagina.drawCircle({
    x: A5.largura / 2,
    y,
    size: 1.6,
    color: COR.ouro,
    opacity: 0.9,
  });
}

/* ── a folha ───────────────────────────────────────────────────────────── */

/**
 * Fundo de pergaminho com grão, gerado uma vez e reaproveitado em todas as
 * páginas. 600px esticado é indistinguível de resolução plena num fundo
 * texturizado, e pesa uma fração.
 */
async function fundoDePergaminho(): Promise<Buffer> {
  const L = 600;
  const A = Math.round(L * (A5.altura / A5.largura));

  const ruido = Buffer.alloc(L * A * 4);
  for (let i = 0; i < L * A; i++) {
    const v = 225 + Math.floor(Math.random() * 26);
    ruido[i * 4] = v;
    ruido[i * 4 + 1] = v - 8;
    ruido[i * 4 + 2] = v - 28;
    ruido[i * 4 + 3] = 255;
  }

  // manchas de idade nas bordas, onde papel envelhece antes
  const manchas = `
<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs>
    <radialGradient id="a">
      <stop offset="0%" stop-color="#967846" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="#967846" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="${L * 0.05}" cy="${A * 0.08}" rx="${L * 0.3}" ry="${A * 0.14}" fill="url(#a)"/>
  <ellipse cx="${L * 0.97}" cy="${A * 0.32}" rx="${L * 0.26}" ry="${A * 0.12}" fill="url(#a)"/>
  <ellipse cx="${L * 0.6}"  cy="${A * 0.99}" rx="${L * 0.34}" ry="${A * 0.13}" fill="url(#a)"/>
</svg>`;

  return sharp(ruido, { raw: { width: L, height: A, channels: 4 } })
    .composite([{ input: Buffer.from(manchas) }])
    .png()
    .toBuffer();
}

/* ── o sigilo, em vetor ────────────────────────────────────────────────── */

function desenharSigilo(
  pagina: PDFPage,
  sigilo: Sigilo,
  cx: number,
  cy: number,
  raio: number
) {
  const vertices = Array.from({ length: sigilo.pontos }, (_, i) => {
    const ang = (i / sigilo.pontos) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + raio * Math.cos(ang), y: cy - raio * Math.sin(ang) };
  });

  pagina.drawCircle({
    x: cx,
    y: cy,
    size: raio + raio * 0.16,
    borderColor: COR.escritaFraca,
    borderWidth: 0.5,
    borderOpacity: 0.4,
    opacity: 0,
  });

  const ordem: { x: number; y: number }[] = [];
  let atual = 0;
  do {
    ordem.push(vertices[atual]);
    atual = (atual + sigilo.passo) % sigilo.pontos;
  } while (atual !== 0);
  ordem.push(vertices[0]);

  for (let i = 0; i < ordem.length - 1; i++) {
    pagina.drawLine({
      start: ordem[i],
      end: ordem[i + 1],
      thickness: 0.7,
      color: COR.escrita,
      opacity: 0.65,
    });
  }
  for (const v of ordem) {
    pagina.drawCircle({ x: v.x, y: v.y, size: 1.3, color: COR.ouro, opacity: 0.85 });
  }
}

/* ── o documento ───────────────────────────────────────────────────────── */

export interface ParametrosPdf {
  nome: string;
  familiar: Familiar;
  lua: LuaId;
  leitura: Leitura;
  signoSol?: string | null;
  signoLua?: string | null;
  /** Só a Completa traz os gráficos. */
  perfil?: {
    eixos: Record<Eixo, number>;
    angulo: number;
    magnitude?: number;
    afinidades: { familiar: FamiliarId; escore: number }[];
  } | null;
}

export async function gerarPdf(
  pedidoId: string,
  params: ParametrosPdf
): Promise<string> {
  const { nome, familiar, leitura, signoSol, signoLua, perfil } = params;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`O familiar de ${nome} — ${familiar.nome}`);
  pdf.setAuthor('Bruxário');
  pdf.setSubject('Revelação do Bruxário');

  const ler = (n: string) => fs.readFileSync(path.join(FONTES, n));

  // As Cormorant vão INTEIRAS, e isso custa ~700 kB do arquivo.
  //
  // O subsetter do pdf-lib não sobrevive a elas: com `subset: true` a página da
  // leitura sai com metade das letras faltando — "O Corvo · Vésper" vira
  // "O Co   o    sp". As outras duas passam pelo subsetter sem perder nada, e
  // subsetar só elas já tira uns 15% do peso final. Se um dia alguém tentar
  // ligar o subset nas Cormorant de novo: foi testado, quebra.
  const fontes: Fontes = {
    corpo: await pdf.embedFont(ler('Sora-Regular.ttf'), { subset: true }),
    display: await pdf.embedFont(ler('CormorantGaramond-Regular-nolig.ttf'), {
      subset: false,
    }),
    displayBold: await pdf.embedFont(ler('CormorantGaramond-SemiBold-nolig.ttf'), {
      subset: false,
    }),
    ritual: await pdf.embedFont(ler('PinyonScript.ttf'), { subset: true }),
  };

  const pergaminho = await pdf.embedPng(await fundoDePergaminho());

  /** Abre uma folha nova já com o fundo e devolve o cursor no topo útil. */
  function novaFolha(): { pagina: PDFPage; y: number } {
    const pagina = pdf.addPage([A5.largura, A5.altura]);
    pagina.drawImage(pergaminho, {
      x: 0,
      y: 0,
      width: A5.largura,
      height: A5.altura,
    });
    return { pagina, y: A5.altura - MARGEM - 10 };
  }

  await capa(pdf, fontes, params);

  /* ── a revelação ──────────────────────────────────────────────────── */
  let folha = novaFolha();
  let pagina = folha.pagina;
  let y = folha.y;

  desenharSigilo(pagina, familiar.sigilo, A5.largura / 2, y - 42, 30);
  y -= 96;

  centralizar(pagina, 'O FAMILIAR DE', y, fontes.corpo, 7.5, COR.escritaFraca);
  y -= 34;
  centralizar(pagina, nome, y, fontes.ritual, 34, COR.escrita);
  y -= 26;
  centralizar(
    pagina,
    `${familiar.nome} · ${leitura.nome_secreto}`,
    y,
    fontes.displayBold,
    16,
    COR.ouro
  );
  y -= 16;

  if (signoSol && signoLua) {
    centralizar(
      pagina,
      `Sol em ${signoSol} · Lua em ${signoLua}`,
      y,
      fontes.corpo,
      8,
      COR.escritaFraca
    );
    y -= 22;
  }

  filete(pagina, y, 34);
  y -= 28;

  for (const linha of quebrar(leitura.saudacao, fontes.display, 12.5, LARGURA_TEXTO - 30)) {
    centralizar(pagina, linha, y, fontes.display, 12.5, COR.escrita);
    y -= 17;
  }
  y -= 16;

  // O corpo flui por quantas folhas precisar. A leitura da Completa tem o
  // dobro de parágrafos, então isto não é hipótese remota.
  const PISO = MARGEM + 40;
  const ENTRELINHA = 15;

  for (const paragrafo of leitura.leitura) {
    const linhas = quebrar(paragrafo, fontes.corpo, 9.5, LARGURA_TEXTO);

    // Órfã: se não cabem ao menos duas linhas, o parágrafo inteiro começa na
    // folha seguinte. Sem isto, um parágrafo pode deixar uma linha solta no pé
    // de uma página e o resto na outra — que é o que estava acontecendo.
    if (linhas.length > 1 && y - ENTRELINHA < PISO) {
      folha = novaFolha();
      pagina = folha.pagina;
      y = folha.y;
    }

    for (const linha of linhas) {
      if (y < PISO) {
        folha = novaFolha();
        pagina = folha.pagina;
        y = folha.y;
      }
      pagina.drawText(linha, {
        x: MARGEM,
        y,
        size: 9.5,
        font: fontes.corpo,
        color: COR.escritaCorpo,
      });
      y -= ENTRELINHA;
    }
    y -= 10;
  }

  /* ── a invocação, sozinha na folha ────────────────────────────────── */
  folha = novaFolha();
  pagina = folha.pagina;

  const linhasInvocacao = quebrar(
    leitura.frase_de_invocacao,
    fontes.displayBold,
    20,
    LARGURA_TEXTO - 40
  );

  // Centrada de verdade na folha: a frase é a única coisa aqui, e frase única
  // ancorada no topo parece sobra de página, não peça.
  // O bloco é sigilo + rótulo + frase + filete + legenda; centrar só a frase
  // deixaria a massa toda acima da metade da folha. Daí o recuo.
  y = A5.altura / 2 + (linhasInvocacao.length * 27) / 2 - 34;

  desenharSigilo(pagina, familiar.sigilo, A5.largura / 2, y + 74, 22);
  centralizar(pagina, 'A INVOCAÇÃO', y + 34, fontes.corpo, 7.5, COR.escritaFraca);

  for (const linha of linhasInvocacao) {
    centralizar(pagina, linha, y, fontes.displayBold, 20, COR.ouroProfundo);
    y -= 27;
  }

  y -= 8;
  filete(pagina, y, 26);
  y -= 22;
  centralizar(
    pagina,
    'Diga em voz alta quando precisar.',
    y,
    fontes.corpo,
    7.5,
    COR.escritaFraca
  );

  /* ── os gráficos, só na Completa ──────────────────────────────────── */
  if (perfil?.afinidades?.length && perfil.eixos) {
    folha = novaFolha();
    paginaDeGraficos(folha.pagina, fontes, perfil, familiar.id, folha.y, novaFolha);
  }

  /* ── contracapa ───────────────────────────────────────────────────── */
  folha = novaFolha();
  pagina = folha.pagina;
  y = A5.altura / 2 + 76;

  centralizar(pagina, 'O SUSSURRO FINAL', y, fontes.corpo, 7.5, COR.escritaFraca);
  y -= 30;
  for (const linha of quebrar(
    `“${leitura.sussurro_final}”`,
    fontes.display,
    14,
    LARGURA_TEXTO - 30
  )) {
    centralizar(pagina, linha, y, fontes.display, 14, COR.escrita);
    y -= 19;
  }

  y -= 26;
  filete(pagina, y, 26);
  y -= 34;

  // O motivo de o PDF existir: o link público fecha, a conta não. Se a pessoa
  // só guardou este arquivo, é daqui que ela tem que saber como voltar.
  for (const linha of quebrar(
    'Sua revelação fica guardada na sua conta para sempre. Para reabrir, entre com o mesmo e-mail em',
    fontes.corpo,
    8,
    LARGURA_TEXTO - 40
  )) {
    centralizar(pagina, linha, y, fontes.corpo, 8, COR.escritaFraca);
    y -= 12;
  }
  y -= 8;
  centralizar(pagina, 'bruxario.com.br/entrar', y, fontes.corpo, 10, COR.ouro);
  y -= 26;
  centralizar(pagina, '@bruxario_', y, fontes.corpo, 8, COR.escritaFraca);

  y = MARGEM + 44;
  const aviso =
    'O Bruxário é entretenimento e autoconhecimento simbólico. As leituras são geradas com auxílio de inteligência artificial e não substituem orientação profissional de nenhuma natureza.';
  for (const linha of quebrar(aviso, fontes.corpo, 6.5, LARGURA_TEXTO)) {
    centralizar(pagina, linha, y, fontes.corpo, 6.5, COR.escritaFraca);
    y -= 9.5;
  }

  const dir = pastaDoPedido(pedidoId);
  fs.mkdirSync(dir, { recursive: true });
  const caminho = path.join(dir, 'revelacao.pdf');
  fs.writeFileSync(caminho, await pdf.save());
  return caminho;
}

/* ── capa ──────────────────────────────────────────────────────────────── */

/**
 * A única folha escura: a carta do familiar sangrando até a borda.
 *
 * Abrir o arquivo e ver o bicho antes de qualquer palavra é o efeito que a
 * versão anterior tentava e não conseguia, porque colava o story inteiro —
 * com o texto já impresso nele — como se fosse capa.
 */
async function capa(pdf: PDFDocument, fontes: Fontes, params: ParametrosPdf) {
  const { nome, familiar, lua, leitura } = params;
  const pagina = pdf.addPage([A5.largura, A5.altura]);

  const meta = await sharp(luaPng(lua)).metadata();
  const m = Math.round((meta.width ?? 2048) * 0.06);
  const fundo = await sharp(luaPng(lua))
    .extract({
      left: m,
      top: m,
      width: (meta.width ?? 2048) - m * 2,
      height: (meta.height ?? 2048) - m * 2,
    })
    .resize(840, 1190, { fit: 'cover' })
    .flatten({ background: '#171225' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  pagina.drawImage(await pdf.embedJpg(fundo), {
    x: 0,
    y: 0,
    width: A5.largura,
    height: A5.altura,
  });

  const tam = Math.round(A5.largura * 0.78);
  const animal = await sharp(familiarPng(familiar.id))
    .resize(tam * 2, tam * 2, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  pagina.drawImage(await pdf.embedPng(animal), {
    x: (A5.largura - tam) / 2,
    y: A5.altura - tam - 70,
    width: tam,
    height: tam,
  });

  // véu para o texto respirar sobre a arte
  pagina.drawRectangle({
    x: 0,
    y: 0,
    width: A5.largura,
    height: 190,
    color: COR.tinta,
    opacity: 0.78,
  });

  centralizar(pagina, 'O FAMILIAR DE', 138, fontes.corpo, 7.5, COR.pergaminho);
  centralizar(pagina, nome, 96, fontes.ritual, 40, COR.vela);
  centralizar(
    pagina,
    `${familiar.nome} · ${leitura.nome_secreto}`,
    70,
    fontes.displayBold,
    15,
    COR.pergaminho
  );
  centralizar(pagina, 'bruxario.com.br', 42, fontes.corpo, 7, COR.pergaminho);
}

/* ── gráficos ──────────────────────────────────────────────────────────── */

/**
 * A mesma informação da tela, em vetor: a roda com a posição e as doze barras.
 *
 * Desenhado com primitivas do PDF em vez de imagem porque assim continua
 * nítido em qualquer zoom e no papel — e é justamente esta página que alguém
 * vai querer imprimir e olhar de perto.
 */
function paginaDeGraficos(
  pagina: PDFPage,
  fontes: Fontes,
  perfil: NonNullable<ParametrosPdf['perfil']>,
  meuFamiliar: FamiliarId,
  yInicial: number,
  novaFolha: () => { pagina: PDFPage; y: number }
): void {
  let y = yInicial;

  centralizar(pagina, 'O que o teste mediu', y, fontes.displayBold, 17, COR.escrita);
  y -= 16;
  centralizar(pagina, 'Nada aqui vem do seu signo.', y, fontes.corpo, 7, COR.escritaFraca);
  y -= 26;

  // ── a roda ──────────────────────────────────────────────────────────
  const cx = A5.largura / 2;
  const raio = 70;
  const cy = y - raio - 8;

  for (const f of [0.34, 0.67, 1]) {
    pagina.drawCircle({
      x: cx,
      y: cy,
      size: raio * f,
      borderColor: COR.escrita,
      borderWidth: 0.4,
      borderOpacity: 0.16,
      opacity: 0,
    });
  }

  // os dois eixos que de fato decidem o familiar
  for (const [a, b] of [
    [{ x: cx - raio, y: cy }, { x: cx + raio, y: cy }],
    [{ x: cx, y: cy - raio }, { x: cx, y: cy + raio }],
  ]) {
    pagina.drawLine({ start: a, end: b, thickness: 0.4, color: COR.escrita, opacity: 0.16 });
  }

  for (const [id, grau] of Object.entries(ANGULO_DO_FAMILIAR)) {
    const rad = (grau * Math.PI) / 180;
    const cos = Math.cos(rad);
    const meu = id === meuFamiliar;

    pagina.drawCircle({
      x: cx + raio * cos,
      y: cy + raio * Math.sin(rad),
      size: meu ? 2.6 : 1.5,
      color: meu ? COR.ouroProfundo : COR.escritaFraca,
      opacity: meu ? 1 : 0.5,
    });

    const rotulo = FAMILIARES[id as FamiliarId].nome.replace(/^(O|A) /, '');
    const larg = fontes.corpo.widthOfTextAtSize(rotulo, 5.5);
    // Ancoragem pelo lado do círculo, como na tela: rótulo à direita empurra
    // para a direita, à esquerda para a esquerda. Centralizar todos faria os
    // de leste e oeste invadirem a roda.
    const desloca = Math.abs(cos) < 0.25 ? -larg / 2 : cos > 0 ? 0 : -larg;
    pagina.drawText(rotulo, {
      x: cx + (raio + 7) * cos + desloca,
      y: cy + (raio + 7) * Math.sin(rad) - 2,
      size: 5.5,
      font: fontes.corpo,
      color: meu ? COR.escrita : COR.escritaFraca,
      opacity: meu ? 1 : 0.7,
    });
  }

  // A magnitude é z-score; acima de ~3 já é extremo. Mesma compressão da tela,
  // senão o mesmo perfil aparece a distâncias diferentes do centro nos dois.
  const radEu = (perfil.angulo * Math.PI) / 180;
  const rEu = Math.min(1, (perfil.magnitude ?? 1.5) / 3.2) * raio;
  const eu = { x: cx + rEu * Math.cos(radEu), y: cy + rEu * Math.sin(radEu) };
  pagina.drawLine({
    start: { x: cx, y: cy },
    end: eu,
    thickness: 0.7,
    color: COR.ouroVivo,
    opacity: 0.75,
  });
  pagina.drawCircle({ x: eu.x, y: eu.y, size: 3.4, color: COR.folha });
  pagina.drawCircle({ x: eu.x, y: eu.y, size: 2.6, color: COR.ouroVivo });

  // A legenda dos eixos vai embaixo, e não colada nas pontas da cruz: nas
  // pontas ela cairia exatamente sobre os rótulos do Cervo (90°) e da Raposa
  // (0°), que ocupam esses dois lugares no círculo.
  y = cy - raio - 22;
  centralizar(
    pagina,
    'horizontal: agência   ·   vertical: comunhão',
    y,
    fontes.corpo,
    5.5,
    COR.escritaFraca
  );

  y -= 30;

  y -= 26;

  // ── os quatro eixos ─────────────────────────────────────────────────
  pagina.drawText('Onde você caiu em cada medida', {
    x: MARGEM,
    y,
    size: 8,
    font: fontes.corpo,
    color: COR.escrita,
  });
  y -= 15;

  const meio = MARGEM + LARGURA_TEXTO / 2;
  for (const eixo of ['agencia', 'comunhao', 'abertura', 'estabilidade'] as Eixo[]) {
    const z = Math.max(-3, Math.min(3, perfil.eixos[eixo] ?? 0));
    const largura = (Math.abs(z) / 3) * (LARGURA_TEXTO / 2);

    const decide = eixo === 'agencia' || eixo === 'comunhao';
    pagina.drawText(
      DESCRICAO_DOS_EIXOS[eixo].nome + (decide ? '' : ' · colore a leitura'),
      { x: MARGEM, y, size: 6.5, font: fontes.corpo, color: COR.escritaFraca }
    );

    // O número ao lado da barra: sem ele a barra é decoração, e a Completa é
    // vendida justamente como a versão que mostra a conta.
    const zTexto = `${z > 0 ? '+' : ''}${z.toFixed(1)}`;
    pagina.drawText(zTexto, {
      x: MARGEM + LARGURA_TEXTO - fontes.corpo.widthOfTextAtSize(zTexto, 6.5),
      y,
      size: 6.5,
      font: fontes.corpo,
      color: COR.escritaFraca,
    });
    y -= 9;

    pagina.drawRectangle({
      x: MARGEM,
      y: y - 1,
      width: LARGURA_TEXTO,
      height: 4.5,
      color: COR.escrita,
      opacity: 0.08,
    });
    pagina.drawRectangle({
      x: z >= 0 ? meio : meio - largura,
      y: y - 1,
      width: largura,
      height: 4.5,
      color: z >= 0 ? COR.ouroVivo : COR.violetaVivo,
    });
    pagina.drawLine({
      start: { x: meio, y: y - 3 },
      end: { x: meio, y: y + 5 },
      thickness: 0.5,
      color: COR.escrita,
      opacity: 0.35,
    });

    y -= 11;
    for (const linha of quebrar(
      DESCRICAO_DOS_EIXOS[eixo].explicacao,
      fontes.corpo,
      6,
      LARGURA_TEXTO
    )) {
      pagina.drawText(linha, {
        x: MARGEM,
        y,
        size: 6,
        font: fontes.corpo,
        color: COR.escritaFraca,
      });
      y -= 8.5;
    }
    y -= 8;
  }

  // ── as doze barras, em folha própria ────────────────────────────────
  //
  // Com a roda e os quatro eixos explicados, as doze barras não cabem na mesma
  // folha — o último eixo caía fora da página. E a quebra sai natural: a folha
  // anterior é o SEU perfil, esta é a comparação com os doze.
  const proxima = novaFolha();
  pagina = proxima.pagina;
  y = proxima.y;

  pagina.drawText('Sua afinidade com cada um dos doze', {
    x: MARGEM,
    y,
    size: 8,
    font: fontes.corpo,
    color: COR.escrita,
  });
  y -= 15;

  const larguraRotulo = 60;
  const larguraBarra = LARGURA_TEXTO - larguraRotulo - 24;

  for (const a of perfil.afinidades) {
    const meu = a.familiar === meuFamiliar;
    const rotulo = FAMILIARES[a.familiar].nome.replace(/^(O|A) /, '');
    const larg = fontes.corpo.widthOfTextAtSize(rotulo, 6.5);

    pagina.drawText(rotulo, {
      x: MARGEM + larguraRotulo - larg,
      y,
      size: 6.5,
      font: fontes.corpo,
      color: meu ? COR.escrita : COR.escritaFraca,
    });
    pagina.drawRectangle({
      x: MARGEM + larguraRotulo + 6,
      y: y - 1,
      width: larguraBarra,
      height: 4.5,
      color: COR.escrita,
      opacity: 0.08,
    });
    pagina.drawRectangle({
      x: MARGEM + larguraRotulo + 6,
      y: y - 1,
      width: (larguraBarra * a.escore) / 100,
      height: 4.5,
      color: meu ? COR.ouroProfundo : COR.ouroVivo,
      opacity: meu ? 1 : 0.55,
    });
    pagina.drawText(String(Math.round(a.escore)), {
      x: MARGEM + larguraRotulo + larguraBarra + 11,
      y,
      size: 6.5,
      font: fontes.corpo,
      color: meu ? COR.escrita : COR.escritaFraca,
    });

    y -= 11.5;
  }


  y -= 26;
  const nota =
    'Os escores acima são a proximidade entre a sua posição no círculo e a de cada familiar — 100 seria cair exatamente em cima dele. Não são probabilidades, e o segundo colocado não é um "quase". Duas medidas decidem quem te encontrou; as outras duas mudam o tom da leitura, não o resultado.';
  for (const linha of quebrar(nota, fontes.corpo, 6.5, LARGURA_TEXTO)) {
    pagina.drawText(linha, {
      x: MARGEM,
      y,
      size: 6.5,
      font: fontes.corpo,
      color: COR.escritaFraca,
    });
    y -= 9.5;
  }
}
