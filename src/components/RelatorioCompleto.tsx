import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { ANGULO_DO_FAMILIAR } from '@/lib/quiz/circulo';
import { DESCRICAO_DOS_EIXOS, type Eixo } from '@/lib/quiz/eixos';

/**
 * O relatório da Completa: os gráficos do que o teste realmente mediu.
 *
 * ── Por que estas formas, e não uma teia ──────────────────────────────────
 *
 * Gráfico de radar é quase sempre erro — ele deforma magnitude conforme o
 * ângulo e convida a comparar áreas que não significam nada. A exceção é
 * quando o círculo **é** o modelo, e aqui é: os 12 arquétipos ocupam posições
 * angulares reais no circumplexo, a 30° um do outro. Então:
 *
 *  - **A roda** mostra POSIÇÃO, não valores. Onde as suas respostas caíram no
 *    círculo, e quais bichos estão perto. É geometria honesta.
 *  - **As barras** mostram os 12 escores, ordenados. Barra é a forma que se lê
 *    sem esforço, e é onde os números moram.
 *  - **Os eixos** são divergentes em torno de zero, porque z-score negativo e
 *    positivo são coisas diferentes — não é magnitude, é polaridade.
 *
 * ── Cor ───────────────────────────────────────────────────────────────────
 *
 * A paleta da marca é dessaturada demais para dado (reprovou no piso de
 * croma). Estes dois tons são a mesma família com croma suficiente, e passam
 * em contraste, separação para daltonismo (ΔE 22,5 protan) e visão normal
 * (23,4): ouro `#9A6A12` e violeta `#5B4A8F`.
 *
 * Só existe versão clara porque os gráficos vivem SOBRE o pergaminho, que é um
 * objeto claro dentro do quarto escuro. Não é omissão de tema escuro — é
 * consequência do conceito.
 */

const OURO = '#9A6A12';
const OURO_FORTE = '#6B4E1E';
const VIOLETA = '#5B4A8F';
const TINTA = '#2E2438';
const TINTA_FRACA = '#6B5F72';
const LINHA = 'rgba(46,36,56,0.14)';

export interface Perfil {
  eixos: Record<Eixo, number>;
  angulo: number;
  magnitude: number;
  afinidades: { familiar: FamiliarId; escore: number; distancia: number }[];
}

export function RelatorioCompleto({
  perfil,
  familiar,
}: {
  perfil: Perfil;
  familiar: FamiliarId;
}) {
  // Perfil incompleto (formato antigo, gravação parcial) esconde a seção em
  // vez de derrubar a revelação inteira. A leitura é o que a pessoa comprou;
  // o gráfico é o extra, e extra não pode levar o principal junto.
  if (!perfil?.eixos || !Array.isArray(perfil.afinidades) || !perfil.afinidades.length) {
    return null;
  }

  return (
    <section className="flex flex-col gap-10 self-stretch w-full">
      <Cabecalho />
      <RodaDoCircumplexo perfil={perfil} familiar={familiar} />
      <BarrasDeAfinidade perfil={perfil} familiar={familiar} />
      <EixosDoPerfil perfil={perfil} />
      <TabelaDeDados perfil={perfil} />
    </section>
  );
}

function Cabecalho() {
  return (
    <div className="flex flex-col items-center gap-3">
      <hr className="w-24 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />
      <h2 className="font-display italic text-2xl sm:text-3xl text-escrita text-center">
        O que o teste mediu
      </h2>
      <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[46ch] leading-relaxed">
        Duas medidas decidiram o seu familiar, e as outras duas colorem a
        leitura. Nada aqui vem do seu signo.
      </p>
    </div>
  );
}

/* ── a roda: posição, não valores ──────────────────────────────────────── */

function RodaDoCircumplexo({
  perfil,
  familiar,
}: {
  perfil: Perfil;
  familiar: FamiliarId;
}) {
  const L = 340;
  const centro = L / 2;
  const raio = L * 0.34;

  const rad = (g: number) => (g * Math.PI) / 180;
  // y invertido: no SVG cresce para baixo, no círculo trigonométrico para cima
  const ponto = (grau: number, r: number) => ({
    x: centro + r * Math.cos(rad(grau)),
    y: centro - r * Math.sin(rad(grau)),
  });

  // A magnitude é um z-score; acima de ~3 já é extremo. Comprime para caber
  // sem que um perfil forte estoure a moldura.
  const rPessoa = Math.min(1, perfil.magnitude / 3.2) * raio;
  const eu = ponto(perfil.angulo, rPessoa);

  return (
    <figure className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${L} ${L}`}
        className="w-full max-w-[340px] h-auto"
        role="img"
        aria-label={`Sua posição no círculo dos doze, mais próxima de ${FAMILIARES[familiar].nome}`}
      >
        {/* anéis de referência, recessivos */}
        {[0.34, 0.67, 1].map((f) => (
          <circle
            key={f}
            cx={centro}
            cy={centro}
            r={raio * f}
            fill="none"
            stroke={LINHA}
            strokeWidth="1"
          />
        ))}

        {/* os dois eixos que decidem */}
        <line x1={centro - raio} y1={centro} x2={centro + raio} y2={centro} stroke={LINHA} strokeWidth="1" />
        <line x1={centro} y1={centro - raio} x2={centro} y2={centro + raio} stroke={LINHA} strokeWidth="1" />
        <text x={centro + raio + 6} y={centro + 4} fontSize="10" fill={TINTA_FRACA} textAnchor="start">
          + agência
        </text>
        <text x={centro} y={centro - raio - 8} fontSize="10" fill={TINTA_FRACA} textAnchor="middle">
          + comunhão
        </text>

        {/* os 12 arquétipos nas suas posições reais */}
        {(Object.keys(ANGULO_DO_FAMILIAR) as FamiliarId[]).map((id) => {
          const g = ANGULO_DO_FAMILIAR[id];
          const p = ponto(g, raio);
          const rotulo = ponto(g, raio + 22);
          const ehOSeu = id === familiar;
          return (
            <g key={id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={ehOSeu ? 5 : 3}
                fill={ehOSeu ? OURO_FORTE : TINTA_FRACA}
                opacity={ehOSeu ? 1 : 0.45}
              />
              <text
                x={rotulo.x}
                y={rotulo.y + 3}
                fontSize={ehOSeu ? 11 : 9.5}
                fontWeight={ehOSeu ? 600 : 400}
                fill={ehOSeu ? TINTA : TINTA_FRACA}
                opacity={ehOSeu ? 1 : 0.65}
                textAnchor={
                  Math.abs(Math.cos(rad(g))) < 0.25
                    ? 'middle'
                    : Math.cos(rad(g)) > 0
                      ? 'start'
                      : 'end'
                }
              >
                {FAMILIARES[id].nome.replace(/^(O|A) /, '')}
              </text>
            </g>
          );
        })}

        {/* a linha do centro até você, e você */}
        <line
          x1={centro}
          y1={centro}
          x2={eu.x}
          y2={eu.y}
          stroke={OURO}
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.7"
        />
        {/* anel da superfície separando a marca do que está atrás */}
        <circle cx={eu.x} cy={eu.y} r="7.5" fill="var(--folha)" />
        <circle cx={eu.x} cy={eu.y} r="5.5" fill={OURO} />
      </svg>

      <figcaption className="font-corpo font-light text-xs text-escrita-fraca text-center max-w-[42ch] leading-relaxed">
        O ponto dourado é onde as suas respostas caíram. Quanto mais longe do
        centro, mais nítido o retrato — perto do centro significa que o teste
        não distinguiu bem, não que você seja meio de cada.
      </figcaption>
    </figure>
  );
}

/* ── os 12 escores, ordenados ──────────────────────────────────────────── */

function BarrasDeAfinidade({
  perfil,
  familiar,
}: {
  perfil: Perfil;
  familiar: FamiliarId;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="font-corpo font-medium text-sm tracking-wide text-escrita">
        Sua afinidade com cada um dos doze
      </figcaption>

      <ul className="flex flex-col gap-1.5">
        {perfil.afinidades.map((a) => {
          const ehOSeu = a.familiar === familiar;
          return (
            <li key={a.familiar} className="flex items-center gap-3">
              <span
                className={`font-corpo text-xs w-[6.5rem] shrink-0 text-right ${
                  ehOSeu ? 'text-escrita font-medium' : 'text-escrita-fraca'
                }`}
              >
                {FAMILIARES[a.familiar].nome.replace(/^(O|A) /, '')}
              </span>

              <span className="flex-1 h-2.5 rounded-full bg-escrita/8 overflow-hidden">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${a.escore}%`,
                    background: ehOSeu ? OURO_FORTE : OURO,
                    opacity: ehOSeu ? 1 : 0.5,
                  }}
                />
              </span>

              <span
                className={`font-corpo text-xs tabular-nums w-9 shrink-0 ${
                  ehOSeu ? 'text-escrita font-medium' : 'text-escrita-fraca'
                }`}
              >
                {Math.round(a.escore)}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/* ── os quatro eixos, divergentes em torno de zero ─────────────────────── */

const ORDEM_DOS_EIXOS: Eixo[] = ['agencia', 'comunhao', 'abertura', 'estabilidade'];

function EixosDoPerfil({ perfil }: { perfil: Perfil }) {
  // z-scores raramente passam de ±3; a escala fixa mantém os quatro
  // comparáveis entre si e entre pessoas.
  const LIMITE = 3;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="font-corpo font-medium text-sm tracking-wide text-escrita">
        Onde você caiu em cada medida
      </figcaption>

      <ul className="flex flex-col gap-4">
        {ORDEM_DOS_EIXOS.map((eixo) => {
          const z = Math.max(-LIMITE, Math.min(LIMITE, perfil.eixos[eixo] ?? 0));
          const largura = (Math.abs(z) / LIMITE) * 50;
          const positivo = z >= 0;
          const decide = eixo === 'agencia' || eixo === 'comunhao';

          return (
            <li key={eixo} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-corpo text-sm text-escrita">
                  {DESCRICAO_DOS_EIXOS[eixo].nome}
                  {!decide && (
                    <span className="text-escrita-fraca font-light">
                      {' '}
                      · colore a leitura
                    </span>
                  )}
                </span>
                <span className="font-corpo text-xs tabular-nums text-escrita-fraca">
                  {z > 0 ? '+' : ''}
                  {z.toFixed(1)}
                </span>
              </div>

              <div className="relative h-2.5 rounded-full bg-escrita/8">
                {/* linha do zero: o ponto de referência de tudo */}
                <span
                  aria-hidden="true"
                  className="absolute top-[-3px] bottom-[-3px] left-1/2 w-px bg-escrita/30"
                />
                <span
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    width: `${largura}%`,
                    [positivo ? 'left' : 'right']: '50%',
                    background: positivo ? OURO : VIOLETA,
                  }}
                />
              </div>

              <p className="font-corpo font-light text-xs text-escrita-fraca leading-relaxed">
                {DESCRICAO_DOS_EIXOS[eixo].explicacao}
              </p>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/* ── os números, para quem quiser conferir ─────────────────────────────── */

function TabelaDeDados({ perfil }: { perfil: Perfil }) {
  return (
    <details className="self-stretch">
      <summary className="font-corpo text-sm text-escrita-fraca cursor-pointer hover:text-escrita transition">
        Ver os números
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse font-corpo text-xs">
          <caption className="sr-only">
            Escores de afinidade com cada familiar e posição nos eixos
          </caption>
          <thead>
            <tr className="text-escrita-fraca">
              <th scope="col" className="text-left font-medium py-1.5 pr-3">
                Familiar
              </th>
              <th scope="col" className="text-right font-medium py-1.5 px-2">
                Afinidade
              </th>
              <th scope="col" className="text-right font-medium py-1.5 pl-2">
                Distância
              </th>
            </tr>
          </thead>
          <tbody className="text-escrita-corpo">
            {perfil.afinidades.map((a) => (
              <tr key={a.familiar} className="border-t border-escrita/10">
                <td className="py-1.5 pr-3">{FAMILIARES[a.familiar].nome}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {a.escore.toFixed(1)}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums">
                  {a.distancia.toFixed(0)}°
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="font-corpo text-xs text-escrita-fraca mt-3 leading-relaxed">
          Ângulo do seu perfil: {perfil.angulo.toFixed(1)}° · nitidez:{' '}
          {perfil.magnitude.toFixed(2)}
        </p>
      </div>
    </details>
  );
}
