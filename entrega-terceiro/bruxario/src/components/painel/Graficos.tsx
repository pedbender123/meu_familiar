import type { DegrauDoFunil, PontoDoDia } from '@/lib/analitica';

/**
 * Os gráficos do painel, em SVG puro.
 *
 * ── Por que sem biblioteca ────────────────────────────────────────────────
 *
 * Recharts e companhia são componentes de cliente: entrariam uns 100 kB de
 * JavaScript no bundle para desenhar seis formas que não têm interação
 * nenhuma. Aqui tudo é server component — o navegador recebe SVG pronto, que
 * já é o formato final, e o painel carrega instantâneo.
 *
 * ── A paleta ──────────────────────────────────────────────────────────────
 *
 * Duas cores, medidas contra o fundo #171225 do painel: ouro `#D9A441` e
 * violeta `#9B87D4`. Separação ΔE 95 em visão normal e 90 em protanopia, e
 * contraste 8,1 e 5,9 com o fundo — acima do mínimo tanto para linha quanto
 * para texto. Não são as cores da marca por acaso: o pergaminho e o violeta
 * originais são dessaturados demais para dado, e reprovaram no piso de croma.
 */
export const OURO = '#D9A441';
export const VIOLETA = '#9B87D4';
const LINHA = 'rgba(234,224,204,0.12)';
const FRACO = 'rgba(234,224,204,0.42)';

const brl = (centavos: number) =>
  `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;

const diaCurto = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

/* ── série no tempo ────────────────────────────────────────────────────── */

/**
 * Visitantes e receita no mesmo desenho, em escalas próprias.
 *
 * Duas escalas num gráfico só é normalmente um erro — dá para fazer duas
 * curvas se cruzarem onde você quiser e "provar" qualquer relação. Aqui é
 * aceitável porque a pergunta é literalmente "o movimento virou dinheiro?", os
 * eixos estão rotulados com os máximos de cada um, e a receita é área sólida
 * enquanto o movimento é linha: ninguém lê as duas como a mesma unidade.
 */
export function SerieDiaria({ serie }: { serie: PontoDoDia[] }) {
  const L = 720;
  const A = 200;
  const pad = { esq: 8, dir: 8, topo: 16, baixo: 26 };
  const larg = L - pad.esq - pad.dir;
  const alt = A - pad.topo - pad.baixo;

  const maxV = Math.max(1, ...serie.map((p) => p.visitantes));
  const maxR = Math.max(1, ...serie.map((p) => p.receitaCentavos));

  const x = (i: number) =>
    pad.esq + (serie.length === 1 ? larg / 2 : (i / (serie.length - 1)) * larg);
  const yV = (v: number) => pad.topo + alt - (v / maxV) * alt;
  const yR = (v: number) => pad.topo + alt - (v / maxR) * alt;

  const linhaV = serie.map((p, i) => `${x(i)},${yV(p.visitantes)}`).join(' ');
  const areaR =
    `${pad.esq},${pad.topo + alt} ` +
    serie.map((p, i) => `${x(i)},${yR(p.receitaCentavos)}`).join(' ') +
    ` ${pad.esq + larg},${pad.topo + alt}`;

  // Rótulos só nas pontas e no meio: com 30 dias, uma data por ponto vira
  // borrão ilegível em qualquer largura de tela.
  const marcos = [0, Math.floor((serie.length - 1) / 2), serie.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i && serie[v]
  );

  return (
    <figure className="w-full flex flex-col gap-2">
      <div className="flex items-center gap-4 font-corpo text-[11px] text-pergaminho/50">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-px" style={{ background: OURO }} />
          {`visitantes · pico ${maxV}`}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-2 rounded-sm"
            style={{ background: VIOLETA, opacity: 0.45 }}
          />
          {`receita · pico ${brl(maxR)}`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Visitantes e receita nos últimos ${serie.length} dias`}
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={pad.esq}
            x2={pad.esq + larg}
            y1={pad.topo + alt * f}
            y2={pad.topo + alt * f}
            stroke={LINHA}
            strokeWidth="1"
          />
        ))}

        <polygon points={areaR} fill={VIOLETA} opacity="0.28" />
        <polyline
          points={linhaV}
          fill="none"
          stroke={OURO}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {serie.length <= 31 &&
          serie.map((p, i) =>
            p.entregues > 0 ? (
              <circle key={p.dia} cx={x(i)} cy={yV(p.visitantes)} r="3" fill={OURO} />
            ) : null
          )}

        {marcos.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={A - 8}
            fontSize="10"
            fill={FRACO}
            textAnchor={i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle'}
          >
            {diaCurto(serie[i].dia)}
          </text>
        ))}
      </svg>
    </figure>
  );
}

/* ── funil ─────────────────────────────────────────────────────────────── */

/**
 * Onde as pessoas somem.
 *
 * A porcentagem grande é sempre **em relação ao degrau anterior**, não ao
 * topo. "3% compram" é verdadeiro e inútil; "80% que chegam no pagamento não
 * terminam" diz onde mexer.
 */
export function Funil({ degraus }: { degraus: DegrauDoFunil[] }) {
  const topo = Math.max(1, degraus[0]?.n ?? 1);

  return (
    <ol className="flex flex-col gap-2">
      {degraus.map((d, i) => {
        const largura = Math.max(1.5, (d.n / topo) * 100);
        const perdeu = i > 0 && d.doAnterior < 50;
        return (
          <li key={d.rotulo} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 font-corpo text-xs">
              <span className="text-pergaminho/75">{d.rotulo}</span>
              <span className="flex items-baseline gap-2 shrink-0">
                <span className="text-pergaminho tabular-nums">{d.n}</span>
                {i > 0 && (
                  <span
                    className="tabular-nums text-[11px]"
                    style={{ color: perdeu ? '#E08A7A' : FRACO }}
                  >
                    {`${d.doAnterior.toFixed(0)}%`}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-pergaminho/8 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${largura}%`,
                  background: OURO,
                  opacity: 1 - i * 0.13,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── horas do dia ──────────────────────────────────────────────────────── */

/** Quando o site tem movimento. Serve para escolher a hora de postar. */
export function Horas({ horas }: { horas: number[] }) {
  const max = Math.max(1, ...horas);
  const pico = horas.indexOf(max);

  return (
    <figure className="flex flex-col gap-2">
      <div
        className="grid gap-[3px] items-end h-24"
        style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}
      >
        {horas.map((n, h) => (
          <div
            key={h}
            title={`${h}h — ${n} visita${n === 1 ? '' : 's'}`}
            className="rounded-sm w-full"
            style={{
              height: `${Math.max(3, (n / max) * 100)}%`,
              background: h === pico ? OURO : VIOLETA,
              opacity: h === pico ? 1 : 0.3 + (n / max) * 0.5,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between font-corpo text-[10px] text-pergaminho/40">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
      {max > 1 && (
        <p className="font-corpo text-[11px] text-pergaminho/50">
          {`Pico às ${pico}h, horário de Brasília.`}
        </p>
      )}
    </figure>
  );
}

/* ── barras horizontais ────────────────────────────────────────────────── */

export function Barras({
  itens,
  cor = OURO,
  sufixo = '',
}: {
  itens: { rotulo: string; valor: number; secundario?: string }[];
  cor?: string;
  sufixo?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));

  if (!itens.length) {
    return (
      <p className="font-corpo text-xs text-pergaminho/35">Nada ainda.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 font-corpo text-xs">
            <span className="text-pergaminho/75 truncate">{i.rotulo}</span>
            <span className="text-pergaminho/60 tabular-nums shrink-0">
              {i.secundario ?? `${i.valor}${sufixo}`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-pergaminho/8 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(i.valor / max) * 100}%`, background: cor }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── a curva de desistência ────────────────────────────────────────────── */

/**
 * Quantas pessoas chegaram a cada uma das 26 cenas.
 *
 * ── Como se lê ────────────────────────────────────────────────────────────
 *
 * O que importa não é a altura das barras — é **onde a altura cai de repente**.
 * Uma descida suave é o abandono normal de qualquer questionário. Um degrau
 * entre duas cenas vizinhas aponta a cena seguinte como problema: texto
 * confuso, opção que ninguém quer marcar, ou pergunta que soa invasiva.
 *
 * A barra destacada é a maior queda encontrada, para não depender de você
 * comparar 26 alturas a olho.
 */
export function CurvaDasCenas({
  curva,
}: {
  curva: { cena: number; pessoas: number }[];
}) {
  const max = Math.max(1, ...curva.map((c) => c.pessoas));

  // A maior queda entre cenas vizinhas, em pessoas absolutas.
  let piorIndice = -1;
  let piorQueda = 0;
  for (let i = 1; i < curva.length; i++) {
    const queda = curva[i - 1].pessoas - curva[i].pessoas;
    if (queda > piorQueda) {
      piorQueda = queda;
      piorIndice = i;
    }
  }

  const comecaram = curva[0]?.pessoas ?? 0;
  const terminaram = curva[curva.length - 1]?.pessoas ?? 0;

  return (
    <figure className="flex flex-col gap-3">
      <div
        className="grid gap-[2px] items-end h-28"
        style={{ gridTemplateColumns: `repeat(${curva.length}, 1fr)` }}
      >
        {curva.map((c, i) => (
          <div
            key={c.cena}
            title={`Cena ${c.cena} — ${c.pessoas} pessoa${c.pessoas === 1 ? '' : 's'}`}
            className="rounded-sm w-full"
            style={{
              height: `${Math.max(2, (c.pessoas / max) * 100)}%`,
              background: i === piorIndice ? '#E08A7A' : OURO,
              opacity: i === piorIndice ? 1 : 0.4 + (c.pessoas / max) * 0.6,
            }}
          />
        ))}
      </div>

      <div className="flex justify-between font-corpo text-[10px] text-pergaminho/40">
        <span>cena 1</span>
        <span>{`cena ${curva.length}`}</span>
      </div>

      <p className="font-corpo text-[11px] text-pergaminho/55 leading-relaxed">
        {comecaram === 0
          ? 'Ninguém começou o ritual neste período.'
          : piorQueda > 0
            ? `${comecaram} começaram, ${terminaram} chegaram na última. A maior perda foi entre a cena ${piorIndice} e a ${piorIndice + 1}: −${piorQueda} pessoas.`
            : `${comecaram} começaram, ${terminaram} chegaram na última.`}
      </p>
    </figure>
  );
}
