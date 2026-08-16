import { dataHoraBr, horaMinuto } from '@/lib/periodo';

/**
 * Gráficos do painel novo, em SVG puro — mesma decisão do `Graficos.tsx`:
 * nenhuma biblioteca de cliente, o navegador recebe o desenho pronto.
 *
 * A diferença é que estes falam a língua do PERÍODO livre (baldes de minuto,
 * não dias fechados), então recebem a série já agrupada por `campanhas.ts`.
 */

export const OURO = '#D9A441';
export const VIOLETA = '#9B87D4';
export const VERDE = '#6FBF8B';
export const VERMELHO = '#D97A7A';
/* Seguem o tema: no claro o "pergaminho" é escuro, então cor fixa clara
   sumiria no branco. `color-mix` resolve sem precisar de dois conjuntos. */
const LINHA = 'color-mix(in srgb, var(--pergaminho) 14%, transparent)';
const FRACO = 'color-mix(in srgb, var(--pergaminho) 55%, transparent)';

export const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

/* ── série de visitantes × vendas ─────────────────────────────────────── */

export function SerieDoPeriodo({
  serie,
  rotuloGranularidade,
}: {
  serie: { hora: string; visitantes: number; vendas: number }[];
  rotuloGranularidade: string;
}) {
  if (serie.length === 0) return <Vazio />;

  const L = 760;
  const A = 190;
  const pad = { esq: 34, dir: 34, topo: 14, baixo: 26 };
  const larg = L - pad.esq - pad.dir;
  const alt = A - pad.topo - pad.baixo;

  const maxV = Math.max(1, ...serie.map((p) => p.visitantes));
  const maxVenda = Math.max(1, ...serie.map((p) => p.vendas));

  const x = (i: number) =>
    pad.esq + (serie.length === 1 ? larg / 2 : (i / (serie.length - 1)) * larg);
  const yV = (v: number) => pad.topo + alt - (v / maxV) * alt;

  const caminho = serie
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yV(p.visitantes).toFixed(1)}`)
    .join(' ');

  const larguraBarra = Math.max(2, Math.min(14, larg / serie.length - 2));

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img"
        aria-label={`Visitantes e vendas ao longo do período, ${rotuloGranularidade}`}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={pad.esq} x2={L - pad.dir}
            y1={pad.topo + alt * f} y2={pad.topo + alt * f}
            stroke={LINHA} strokeWidth="1" />
        ))}

        {/* vendas: barras, porque venda é evento contável e não fluxo */}
        {serie.map((p, i) =>
          p.vendas > 0 ? (
            <rect key={i} x={x(i) - larguraBarra / 2}
              y={pad.topo + alt - (p.vendas / maxVenda) * alt * 0.55}
              width={larguraBarra}
              height={(p.vendas / maxVenda) * alt * 0.55}
              fill={OURO} opacity="0.55" rx="1" />
          ) : null
        )}

        <path d={caminho} fill="none" stroke={VIOLETA} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />

        <text x={pad.esq} y={pad.topo - 3} fill={FRACO} fontSize="10">{maxV}</text>
        <text x={pad.esq} y={A - 8} fill={FRACO} fontSize="10">
          {dataHoraBr(serie[0].hora)}
        </text>
        <text x={L - pad.dir} y={A - 8} fill={FRACO} fontSize="10" textAnchor="end">
          {dataHoraBr(serie[serie.length - 1].hora)}
        </text>
      </svg>
      <figcaption className="flex gap-4 justify-center mt-1 font-corpo text-[11px] text-pergaminho/45">
        <Legenda cor={VIOLETA}>visitantes</Legenda>
        <Legenda cor={OURO}>vendas</Legenda>
        <span className="text-pergaminho/30">{rotuloGranularidade}</span>
      </figcaption>
    </figure>
  );
}

/* ── funil do período ─────────────────────────────────────────────────── */

export function FunilDoPeriodo({
  degraus,
}: {
  degraus: { rotulo: string; pessoas: number }[];
}) {
  const topo = Math.max(1, degraus[0]?.pessoas ?? 1);

  return (
    <ul className="flex flex-col gap-1.5">
      {degraus.map((d, i) => {
        const largura = (d.pessoas / topo) * 100;
        const anterior = i > 0 ? degraus[i - 1].pessoas : d.pessoas;
        const queda = anterior > 0 ? 1 - d.pessoas / anterior : 0;
        return (
          <li key={d.rotulo} className="flex items-center gap-3">
            <span className="font-corpo text-[11px] text-pergaminho/55 w-36 shrink-0 text-right">
              {d.rotulo}
            </span>
            <span className="flex-1 h-6 bg-pergaminho/5 rounded-sm relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${largura}%`, background: OURO, opacity: 0.65 }} />
              {/* Escuro fixo: o número fica SOBRE a barra dourada, que é a
                  mesma cor nos dois temas — herdar `--tinta` deixaria branco
                  sobre ouro no modo claro. */}
              <span className="absolute inset-y-0 left-2 flex items-center font-corpo text-[11px] font-medium"
                style={{ color: '#241E2E' }}>
                {d.pessoas}
              </span>
            </span>
            {/*
              O degrau pode CRESCER: "viram a oferta" conta visitante com
              marco, "criaram pedido" conta pedido — e quem abriu em duas abas
              ou voltou depois aparece uma vez num e duas no outro. Mostrar
              "−-12%" nesse caso seria erro na cara do usuário.
            */}
            <span className="font-corpo text-[11px] w-14 shrink-0 tabular-nums"
              style={{ color: queda > 0.5 ? VERMELHO : FRACO }}>
              {i === 0
                ? ''
                : queda >= 0
                  ? `−${Math.round(queda * 100)}%`
                  : `+${Math.round(-queda * 100)}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── curva das cenas ──────────────────────────────────────────────────── */

export function CurvaDoRitual({
  curva,
  total,
}: {
  curva: { cena: number; pessoas: number }[];
  total: number;
}) {
  const mapa = new Map(curva.map((c) => [c.cena, c.pessoas]));
  const cheia = Array.from({ length: total }, (_, i) => ({
    cena: i + 1,
    pessoas: mapa.get(i + 1) ?? 0,
  }));
  const max = Math.max(1, ...cheia.map((c) => c.pessoas));
  if (max === 1 && cheia.every((c) => c.pessoas === 0)) return <Vazio />;

  const L = 760;
  const A = 150;
  const pad = { esq: 28, dir: 12, topo: 12, baixo: 22 };
  const larg = L - pad.esq - pad.dir;
  const alt = A - pad.topo - pad.baixo;
  const w = larg / cheia.length;

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img"
        aria-label="Quantas pessoas chegaram a cada cena do ritual">
        {cheia.map((c, i) => {
          const anterior = i > 0 ? cheia[i - 1].pessoas : c.pessoas;
          const despencou = anterior > 0 && c.pessoas / anterior < 0.6;
          const h = (c.pessoas / max) * alt;
          return (
            <rect key={c.cena} x={pad.esq + i * w + 1} y={pad.topo + alt - h}
              width={Math.max(1, w - 2)} height={h}
              fill={despencou ? VERMELHO : OURO} opacity={despencou ? 0.85 : 0.55} rx="1" />
          );
        })}
        <text x={pad.esq} y={pad.topo - 2} fill={FRACO} fontSize="10">{max}</text>
        <text x={pad.esq} y={A - 6} fill={FRACO} fontSize="10">cena 1</text>
        <text x={L - pad.dir} y={A - 6} fill={FRACO} fontSize="10" textAnchor="end">
          cena {total}
        </text>
      </svg>
      <figcaption className="font-corpo text-[11px] text-pergaminho/40 text-center mt-1">
        Barra vermelha = perdeu mais de 40% em relação à cena anterior
      </figcaption>
    </figure>
  );
}

/* ── barras horizontais genéricas ─────────────────────────────────────── */

export function BarrasRotuladas({
  linhas,
  sufixo,
}: {
  linhas: { rotulo: string; valor: number; secundario?: string }[];
  sufixo?: string;
}) {
  if (linhas.length === 0) return <Vazio />;
  const max = Math.max(1, ...linhas.map((l) => l.valor));

  return (
    <ul className="flex flex-col gap-1.5">
      {linhas.map((l) => (
        <li key={l.rotulo} className="flex items-center gap-3">
          <span className="font-corpo text-[11px] text-pergaminho/60 w-32 shrink-0 truncate text-right">
            {l.rotulo}
          </span>
          <span className="flex-1 h-5 bg-pergaminho/5 rounded-sm relative overflow-hidden">
            <span className="absolute inset-y-0 left-0 rounded-sm"
              style={{ width: `${(l.valor / max) * 100}%`, background: VIOLETA, opacity: 0.6 }} />
          </span>
          <span className="font-corpo text-[11px] text-pergaminho/70 w-24 shrink-0 tabular-nums">
            {l.valor}
            {sufixo ?? ''}
            {l.secundario && (
              <span className="text-pergaminho/35"> · {l.secundario}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── peças ────────────────────────────────────────────────────────────── */

function Legenda({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: cor }} />
      {children}
    </span>
  );
}

export function Vazio({ children }: { children?: React.ReactNode }) {
  return (
    <p className="font-corpo text-xs text-pergaminho/30 py-6 text-center">
      {children ?? 'Nada neste período.'}
    </p>
  );
}

export function Cartao({
  rotulo,
  valor,
  nota,
  cor,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  cor?: string;
}) {
  return (
    <div className="superficie rounded-xl border px-4 py-3 flex flex-col gap-0.5"
      style={{ borderColor: 'var(--admin-borda)' }}>
      <span className="font-corpo text-[10px] tracking-[0.14em] uppercase text-pergaminho/40">
        {rotulo}
      </span>
      <span className="font-corpo text-xl tabular-nums" style={{ color: cor ?? 'var(--pergaminho)' }}>
        {valor}
      </span>
      {nota && (
        <span className="font-corpo text-[11px] text-pergaminho/35 leading-snug">{nota}</span>
      )}
    </div>
  );
}

export function Bloco({
  titulo,
  nota,
  children,
  largo,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <section
      className={`superficie rounded-xl border px-5 py-4 flex flex-col gap-3 ${largo ? 'col-span-full' : ''}`}
      style={{ borderColor: 'var(--admin-borda)' }}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="font-corpo font-medium text-sm text-pergaminho/85">{titulo}</h2>
        {nota && (
          <p className="font-corpo font-light text-[11px] text-pergaminho/40 leading-snug max-w-[70ch]">
            {nota}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export { horaMinuto };
