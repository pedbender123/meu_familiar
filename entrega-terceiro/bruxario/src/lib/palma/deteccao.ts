'use client';

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * Detecção da mão na foto, com o modelo de 21 pontos do MediaPipe.
 *
 * A primeira versão disto usava regra de cor de pele (YCbCr) e quebrava feio em
 * foto real: parede bege, madeira e rosto caem todos dentro da faixa de "pele",
 * então a máscara virava um borrão só e a palma ia parar no canto da imagem.
 * O modelo resolve isso de vez — ele acha a mão, não uma cor.
 *
 * O que é medido de verdade: os 21 pontos da mão (pulso, base e ponta de cada
 * dedo) e os vincos escuros dentro da palma.
 * O que é canônico: o desenho das quatro linhas, que parte de um traçado
 * anatômico padrão colocado no sistema de coordenadas da SUA palma (posição,
 * tamanho, rotação e lado) e depois encosta nos vincos reais que passam perto.
 */

const RES = 320;

export interface PontoXY {
  x: number;
  y: number;
}

export interface LinhaDetectada {
  key: 'coracao' | 'cabeca' | 'vida' | 'destino';
  label: string;
  cor: string;
  /** Vértices da linha. Cada um é um vinco escuro achado na foto. */
  pontos: PontoXY[];
  /** Quantos vértices vieram de vinco real vs. quantos foram procurados. */
  achados: number;
  total: number;
  rotulo: PontoXY;
}

/** Pontas dos cinco dedos, na numeração do modelo. */
export const PONTAS_DEDOS = [4, 8, 12, 16, 20];

export interface PalmAnalysis {
  res: number;
  /** Os 21 pontos, em pixels do recorte analisado. Nulo se nenhuma mão. */
  landmarks: PontoXY[] | null;
  centro: PontoXY;
  linhas: LinhaDetectada[];
  confianca: 'boa' | 'fraca';
  /** Por que a confiança caiu — os dois casos pedem mensagens diferentes. */
  motivo: 'ok' | 'servidor' | 'sem-mao' | 'indisponivel';
  /** Detalhe técnico da falha, mostrado na tela para dar o que reportar. */
  erro?: string;
}

/** Índices do modelo: pulso, bases e pontas. */
const PULSO = 0, POLEGAR_BASE = 1;
const INDIC_BASE = 5, MEDIO_BASE = 9, ANEL_BASE = 13, MINIMO_BASE = 17;

/** Esqueleto para desenhar a mão detectada na tela. */
export const CONEXOES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

/* ── Modelo ───────────────────────────────────────────────────────────────── */

let detectorPromise: Promise<HandLandmarker> | null = null;

/** Carrega uma vez só; o modelo tem ~8 MB e é servido da própria aplicação. */
function obterDetector(): Promise<HandLandmarker> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe');
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/mediapipe/hand_landmarker.task' },
        numHands: 1,
        runningMode: 'IMAGE',
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
      });
    })();
  }
  return detectorPromise;
}

/* ── Plano B: detecção no servidor ────────────────────────────────────────────
   Só entra quando o navegador não tem WebGL. É a minoria, então o servidor
   nunca vira gargalo: quem tem aceleração continua resolvendo sozinho, de
   graça e sem a foto sair do aparelho. */
/**
 * O endereço do plano B.
 *
 * `NEXT_PUBLIC_` porque isto roda no navegador — a variável precisa estar no
 * bundle. Vazia em produção desliga o plano B por completo, e isso é uma
 * escolha consciente: sem servidor configurado, quem não tem WebGL recebe a
 * mensagem de que não deu, em vez de um traçado genérico apresentado como se
 * fosse a mão dela.
 */
const API_PALMA: string =
  process.env.NEXT_PUBLIC_PALMA_API ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8077' : '');

export function servidorConfigurado(): boolean {
  return API_PALMA !== '';
}

async function pedirAoServidor(canvas: HTMLCanvasElement): Promise<PontoXY[] | null> {
  const resposta = await fetch(`${API_PALMA}/palma`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagem: canvas.toDataURL('image/jpeg', 0.85) }),
  });
  if (!resposta.ok) throw new Error(`servidor respondeu ${resposta.status}`);
  const dados = (await resposta.json()) as { achou: boolean; landmarks: PontoXY[] };
  return dados.achou ? dados.landmarks : null;
}

/* ── Traçado anatômico ────────────────────────────────────────────────────────
   Coordenadas da palma: `a` vai do pulso (0) até a base do dedo médio (1);
   `b` atravessa a palma, negativo no lado do mínimo e positivo no lado do
   polegar. Assim o mesmo traçado serve para mão esquerda, direita, torta ou
   de qualquer tamanho. */
const TRACADO: { key: LinhaDetectada['key']; label: string; cor: string; ctrl: [number, number][] }[] = [
  { key: 'coracao', label: 'Coração', cor: '#C97A92', ctrl: [[0.70, -0.52], [0.80, -0.20], [0.86, 0.10], [0.84, 0.34]] },
  { key: 'cabeca', label: 'Cabeça', cor: '#9B85BC', ctrl: [[0.58, 0.40], [0.56, 0.10], [0.52, -0.20], [0.46, -0.50]] },
  { key: 'vida', label: 'Vida', cor: '#D9A441', ctrl: [[0.64, 0.40], [0.44, 0.56], [0.24, 0.48], [0.08, 0.20]] },
  { key: 'destino', label: 'Destino', cor: '#6E9478', ctrl: [[0.06, 0.02], [0.32, 0.04], [0.58, 0.03], [0.80, 0.00]] },
];

/* ── Utilidades de curva ──────────────────────────────────────────────────── */

function suavizarCurva(ctrl: PontoXY[], porSegmento = 12): PontoXY[] {
  const pts: PontoXY[] = [];
  const ext = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
    for (let t = 0; t < porSegmento; t++) {
      const s = t / porSegmento, s2 = s * s, s3 = s2 * s;
      pts.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
      });
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  return pts;
}

/** Luminância suavizada — o borrão leve tira o ruído de pele sem apagar vinco. */
function luminancia(d: Uint8ClampedArray, w: number, h: number): Float32Array {
  const bruta = new Float32Array(w * h);
  for (let i = 0, p = 0; i < bruta.length; i++, p += 4) {
    bruta[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  }
  const suave = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      suave[i] = (bruta[i] * 4 + bruta[i - 1] + bruta[i + 1] + bruta[i - w] + bruta[i + w]) / 8;
    }
  }
  return suave;
}

function amostrar(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= w || yi >= h) return NaN;
  return lum[yi * w + xi];
}

function dentroDoPoligono(p: PontoXY, poly: PontoXY[]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/**
 * Força de "vale escuro" atravessando a linha: o ponto é um vinco se for mais
 * escuro que a pele dos dois lados. É um detector de sulco de 1 dimensão,
 * orientado perpendicular ao traço — barato e específico o bastante.
 */
function forcaDoVinco(
  lum: Float32Array, w: number, h: number,
  x: number, y: number, nx: number, ny: number, k: number
): number {
  const centro = amostrar(lum, w, h, x, y);
  const lado1 = amostrar(lum, w, h, x + nx * k, y + ny * k);
  const lado2 = amostrar(lum, w, h, x - nx * k, y - ny * k);
  if (Number.isNaN(centro) || Number.isNaN(lado1) || Number.isNaN(lado2)) return 0;
  // Exige os DOIS lados mais claros; senão é só uma sombra ou a borda da mão.
  return Math.min(lado1 - centro, lado2 - centro);
}

const LIMIAR_VINCO = 3.2;
/** Poucos vértices lêem melhor que muitos: a linha fica firme, não trêmula. */
const MAX_VERTICES = 6;

function distanciaAteReta(p: PontoXY, a: PontoXY, b: PontoXY): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/** Ramer–Douglas–Peucker: guarda só os vértices que mudam o formato. */
function simplificar(pts: PontoXY[], eps: number): PontoXY[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let maiorD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distanciaAteReta(pts[i], a, b);
    if (d > maiorD) { maiorD = d; idx = i; }
  }
  if (maiorD <= eps) return [a, b];
  const esq = simplificar(pts.slice(0, idx + 1), eps);
  const dir = simplificar(pts.slice(idx), eps);
  return [...esq.slice(0, -1), ...dir];
}

/** Simplifica até caber no limite de vértices, afrouxando a tolerância. */
function poucosVertices(pts: PontoXY[], eps: number): PontoXY[] {
  let atual = simplificar(pts, eps);
  let tentativa = 0;
  while (atual.length > MAX_VERTICES && tentativa < 8) {
    eps *= 1.6;
    atual = simplificar(pts, eps);
    tentativa++;
  }
  return atual;
}

/**
 * Segue o corredor da linha procurando o vinco a cada passo, e devolve os
 * pontos REALMENTE achados. Nada é forçado: onde a pele não tem sulco, o passo
 * é pulado. É por isso que o traço final é uma sequência de pontos tortos em
 * vez de uma curva lisa — como no funil de referência.
 */
function seguirVinco(
  canonico: PontoXY[], lum: Float32Array, palma: PontoXY[],
  w: number, h: number, alcance: number, passos = 26
): { pontos: PontoXY[]; achados: number; total: number } {
  const k = Math.max(2, Math.round(alcance * 0.55));
  const achadosPts: PontoXY[] = [];
  let total = 0;

  /* Continuidade: um vinco é uma linha contínua, não uma nuvem de pontos. Sem
     limitar o quanto o traço pode se deslocar de um passo para o outro, cada
     ponto gruda num sulco diferente — a palma tem dezenas — e o resultado
     ziguezagueia. O primeiro passo procura no corredor inteiro; a partir daí,
     só perto de onde o vinco estava. */
  const saltoMax = Math.max(2, Math.round(alcance * 0.28));
  let desvioAtual: number | null = null;

  for (let s = 0; s < passos; s++) {
    const t = (s / (passos - 1)) * (canonico.length - 1);
    const i = Math.min(canonico.length - 2, Math.floor(t));
    const f = t - i;
    const p = {
      x: canonico[i].x + (canonico[i + 1].x - canonico[i].x) * f,
      y: canonico[i].y + (canonico[i + 1].y - canonico[i].y) * f,
    };
    const tx = canonico[i + 1].x - canonico[i].x;
    const ty = canonico[i + 1].y - canonico[i].y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len;

    if (!dentroDoPoligono(p, palma)) continue;
    total++;

    const centroBusca: number = desvioAtual ?? 0;
    const janela = desvioAtual === null ? alcance : saltoMax;
    const de = Math.max(-alcance, centroBusca - janela);
    const ate = Math.min(alcance, centroBusca + janela);

    let melhor = 0;
    let melhorD: number = centroBusca;
    for (let d = de; d <= ate; d++) {
      const cx = p.x + nx * d, cy = p.y + ny * d;
      if (!dentroDoPoligono({ x: cx, y: cy }, palma)) continue;
      const v = forcaDoVinco(lum, w, h, cx, cy, nx, ny, k);
      if (v > melhor) { melhor = v; melhorD = d; }
    }
    if (melhor >= LIMIAR_VINCO) {
      desvioAtual = melhorD;
      achadosPts.push({ x: p.x + nx * melhorD, y: p.y + ny * melhorD });
    }
  }

  const achados = achadosPts.length;

  // Poucos vincos: devolve o corredor canônico, e quem chamou avisa na tela.
  if (achados < Math.max(4, total * 0.3)) {
    const canon = poucosVertices(canonico, alcance * 0.18);
    return { pontos: canon, achados, total };
  }

  // Suavização mínima: tira o zigue-zague de 1 px, preserva o formato achado.
  const suave = achadosPts.map((_, i) => {
    const j0 = Math.max(0, i - 1), j1 = Math.min(achadosPts.length - 1, i + 1);
    let sx = 0, sy = 0, n = 0;
    for (let j = j0; j <= j1; j++) { sx += achadosPts[j].x; sy += achadosPts[j].y; n++; }
    return { x: sx / n, y: sy / n };
  });

  /* A busca é densa de propósito (acha melhor), mas o traço mostrado é
     simplificado: poucos vértices, segmentos retos entre eles. Fica firme na
     tela em vez de trêmulo, sem perder o formato que foi medido. */
  return { pontos: poucosVertices(suave, alcance * 0.18), achados, total };
}

/* ── Análise ──────────────────────────────────────────────────────────────── */

export async function analisarPalma(dataUrl: string): Promise<PalmAnalysis> {
  const img = await carregarImagem(dataUrl);

  // Recorte central quadrado, igual ao `object-cover` mostrado na tela.
  const lado = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, RES, RES);

  let landmarks: PontoXY[] | null = null;
  let motivo: PalmAnalysis['motivo'] = 'sem-mao';
  let erro: string | undefined;

  try {
    const detector = await obterDetector();

    /* Várias tentativas, da mais barata para a mais folgada. O caso que mais
       falha é a mão preenchendo o quadro inteiro: o detector precisa de margem
       em volta para reconhecer a silhueta. Então, se o recorte quadrado não
       der, tentamos a imagem inteira com borda e depois em dobro de resolução. */
    const tentativas = [
      { nome: 'recorte', canvas, mapear: (x: number, y: number) => ({ x: x * RES, y: y * RES }) },
      montarComMargem(img, lado, 512, 0.22),
      montarComMargem(img, lado, 768, 0.12),
    ];

    for (const t of tentativas) {
      const res = detector.detect(t.canvas);
      if (res.landmarks?.length) {
        landmarks = res.landmarks[0].map((p) => t.mapear(p.x, p.y));
        motivo = 'ok';
        break;
      }
    }
    if (!landmarks) erro = 'modelo carregou, mas não viu mão em nenhuma das 3 escalas';
  } catch (e) {
    /* O detector do navegador exige WebGL. Sem ele, tentamos o servidor —
       é exatamente o caso que este plano B existe para cobrir. */
    console.warn('[palma] detector local indisponível, tentando servidor:', e);
    motivo = 'indisponivel';
    erro = String((e as Error)?.message ?? e).slice(0, 200);

    if (servidorConfigurado()) {
      try {
        const tentativas = [
          { canvas: recorteQuadrado(img, lado, 640), mapear: (x: number, y: number) => ({ x: x * RES, y: y * RES }) },
          montarComMargem(img, lado, 768, 0.18),
        ];
        for (const t of tentativas) {
          const pontos = await pedirAoServidor(t.canvas);
          if (pontos?.length) {
            landmarks = pontos.map((p) => t.mapear(p.x, p.y));
            motivo = 'servidor';
            erro = undefined;
            break;
          }
        }
        if (!landmarks) erro = 'nem o navegador nem o servidor viram uma mão nesta foto';
      } catch (e2) {
        erro = `sem WebGL, e o servidor falhou: ${String((e2 as Error)?.message ?? e2).slice(0, 120)}`;
      }
    }
  }

  const { data } = ctx.getImageData(0, 0, RES, RES);

  if (!landmarks) return semMao(motivo, erro);
  return comMao(landmarks, data, motivo === 'servidor' ? 'servidor' : 'ok');
}

/** Recorte quadrado central, na resolução pedida. */
function recorteQuadrado(img: HTMLImageElement, lado: number, S: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, S, S);
  return c;
}

/**
 * Desenha a imagem INTEIRA dentro de um quadrado, com margem em volta, e
 * devolve como converter um ponto normalizado desse quadrado de volta para o
 * recorte quadrado que aparece na tela.
 */
function montarComMargem(img: HTMLImageElement, lado: number, S: number, margem: number) {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  // Fundo neutro: dá contorno à mão sem inventar uma cor que confunda o modelo.
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);

  const util = S * (1 - margem * 2);
  const esc = util / Math.max(img.width, img.height);
  const lw = img.width * esc, lh = img.height * esc;
  const dx = (S - lw) / 2, dy = (S - lh) / 2;
  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, lw, lh);

  // Origem do recorte quadrado que a tela mostra, em pixels da imagem original.
  const ox = (img.width - lado) / 2, oy = (img.height - lado) / 2;

  return {
    nome: `margem${S}`,
    canvas: c,
    mapear: (nx: number, ny: number): PontoXY => {
      const ix = (nx * S - dx) / esc;
      const iy = (ny * S - dy) / esc;
      return { x: ((ix - ox) / lado) * RES, y: ((iy - oy) / lado) * RES };
    },
  };
}

/** Sem mão reconhecida: marca no centro e avisa que está aproximado. */
function semMao(motivo: PalmAnalysis['motivo'], erro?: string): PalmAnalysis {
  const c = { x: RES / 2, y: RES / 2 };
  const L = RES * 0.34, W = RES * 0.42;
  const base = { x: c.x, y: c.y + L / 2 };
  const u = { x: 0, y: -1 }, v = { x: 1, y: 0 };
  const linhas = TRACADO.map(({ key, label, cor, ctrl }) => {
    const pts = suavizarCurva(ctrl.map(([a, b]) => ({
      x: base.x + u.x * a * L + v.x * b * W,
      y: base.y + u.y * a * L + v.y * b * W,
    })));
    return { key, label, cor, pontos: pts, achados: 0, total: 0, rotulo: rotuloDe(pts, c) };
  });
  return { res: RES, landmarks: null, centro: c, linhas, confianca: 'fraca', motivo, erro };
}

function comMao(lm: PontoXY[], data: Uint8ClampedArray, motivo: PalmAnalysis['motivo'] = 'ok'): PalmAnalysis {
  const pulso = lm[PULSO];
  const medioBase = lm[MEDIO_BASE];
  const indicBase = lm[INDIC_BASE];
  const minimoBase = lm[MINIMO_BASE];

  // Eixo da palma: do pulso para a base do dedo médio.
  const ux = medioBase.x - pulso.x, uy = medioBase.y - pulso.y;
  const L = Math.hypot(ux, uy) || 1;
  const u = { x: ux / L, y: uy / L };

  // Largura: da base do mínimo para a base do indicador. O sinal já resolve
  // sozinho mão esquerda vs. direita — `b` positivo é sempre o lado do polegar.
  const vx = indicBase.x - minimoBase.x, vy = indicBase.y - minimoBase.y;
  const W = Math.hypot(vx, vy) || 1;
  const v = { x: vx / W, y: vy / W };

  const emImagem = (a: number, b: number): PontoXY => ({
    x: pulso.x + u.x * a * L + v.x * b * W,
    y: pulso.y + u.y * a * L + v.y * b * W,
  });

  // Região da palma: o miolo entre pulso, base do polegar e bases dos dedos.
  const palma = [lm[PULSO], lm[POLEGAR_BASE], lm[INDIC_BASE], lm[MEDIO_BASE], lm[ANEL_BASE], lm[MINIMO_BASE]];
  const centro = emImagem(0.45, 0.0);

  const lum = luminancia(data, RES, RES);
  // Corredor de busca largo: o vinco real costuma estar longe do lugar "de
  // livro", e é justamente esse desvio que faz a linha parecer detectada.
  const alcance = Math.max(4, Math.round(W * 0.22));

  const linhas = TRACADO.map(({ key, label, cor, ctrl }) => {
    const corredor = suavizarCurva(ctrl.map(([a, b]) => emImagem(a, b)));
    const { pontos, achados, total } = seguirVinco(corredor, lum, palma, RES, RES, alcance);
    return { key, label, cor, pontos, achados, total, rotulo: rotuloDe(pontos, centro) };
  });

  separarRotulos(linhas);
  return { res: RES, landmarks: lm, centro, linhas, confianca: 'boa', motivo };
}

/** Empurra rótulos que se sobrepõem, para nenhum ficar ilegível. */
function separarRotulos(linhas: LinhaDetectada[]): void {
  const ALTURA = 13;
  for (let i = 1; i < linhas.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = linhas[i].rotulo, b = linhas[j].rotulo;
      if (Math.abs(a.x - b.x) < 42 && Math.abs(a.y - b.y) < ALTURA) {
        a.y = b.y + (a.y >= b.y ? ALTURA : -ALTURA);
      }
    }
    linhas[i].rotulo.y = Math.min(RES - 6, Math.max(12, linhas[i].rotulo.y));
  }
}

/** Rótulo na extremidade mais afastada do centro, empurrado para fora do traço. */
function rotuloDe(pontos: PontoXY[], centro: PontoXY): PontoXY {
  const pa = pontos[0], pb = pontos[pontos.length - 1];
  const dist = (p: PontoXY) => Math.hypot(p.x - centro.x, p.y - centro.y);
  const ponta = dist(pa) >= dist(pb) ? pa : pb;
  const dx = ponta.x - centro.x, dy = ponta.y - centro.y;
  const n = Math.hypot(dx, dy) || 1;
  return {
    x: Math.min(RES - 26, Math.max(26, ponta.x + (dx / n) * 15)),
    y: Math.min(RES - 10, Math.max(14, ponta.y + (dy / n) * 15)),
  };
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem'));
    img.src = src;
  });
}

export function paraPath(pontos: PontoXY[]): string {
  if (!pontos.length) return '';
  return pontos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}
