'use client';

import { useEffect, useRef, useState } from 'react';
import { tocar } from '@/lib/som';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { usePrefereMenosMovimento } from '@/lib/movimento';
import type { Item } from '@/lib/quiz/itens';

/**
 * O cliente do ritual pago.
 *
 * ── O que este componente NÃO tem ─────────────────────────────────────────
 *
 * O círculo de pontos do fluxo antigo. Vinte e seis nós apagados numa roda
 * lia como mapa do quanto falta — assustava em vez de acompanhar. Aqui o
 * progresso é uma linha fina de luz que se preenche: dá a mesma informação
 * de relance, sem convite à contagem.
 *
 * ── As paradas ────────────────────────────────────────────────────────────
 *
 * Em dois pontos do caminho o familiar fala (gerado por Gemini com as
 * respostas até ali; ver `mensagens-ritual.ts`). Na Completa, a primeira
 * fala também chega em áudio — o agradecimento por ter vindo buscá-lo. A
 * fala é pedida ANTES de a parada chegar, para a tela nunca esperar a IA.
 */
interface Fala {
  fala: string;
  audio?: string;
}

type Momento =
  | { tipo: 'cena'; indice: number }
  | { tipo: 'parada'; parada: number; fala: Fala }
  | { tipo: 'desempate'; entre: { familiar: string; nome: string; chamado: string }[] }
  | { tipo: 'selando' };

export function RitualPago({
  pedidoId,
  nome,
  itens,
  ordemDasOpcoes,
  jaRespondidas,
  total,
  comAudio,
}: {
  pedidoId: string;
  nome: string;
  itens: Item[];
  ordemDasOpcoes: Record<string, number[]>;
  jaRespondidas: number;
  total: number;
  comAudio: boolean;
}) {
  const semMovimento = usePrefereMenosMovimento();
  const [momento, setMomento] = useState<Momento>({ tipo: 'cena', indice: 0 });
  const [respondidas, setRespondidas] = useState(jaRespondidas);
  const [escolhaVisivel, setEscolhaVisivel] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  /**
   * As paradas acontecem ao cruzar estes totais. Pré-busca: a fala da
   * próxima parada é pedida uma cena antes, então quando a cortina abre o
   * texto já está aqui.
   */
  const PARADAS: Record<number, number> = { 10: 1, 18: 2 };
  const falas = useRef<Record<number, Fala | null>>({});

  useEffect(() => {
    const proxima = Object.entries(PARADAS).find(
      ([total_]) => Number(total_) > respondidas
    );
    if (!proxima) return;
    const [, parada] = proxima;
    if (falas.current[parada] !== undefined) return;
    falas.current[parada] = null; // marca "pedindo" para não duplicar
    fetch(`/api/ritual/${pedidoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fala: parada }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.fala) falas.current[parada] = d.fala;
      })
      .catch(() => {
        falas.current[parada] = { fala: '' };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respondidas, pedidoId]);

  async function responder(item: Item, indiceOriginal: number, posicao: number) {
    if (escolhaVisivel !== null) return;
    setErro('');
    setEscolhaVisivel(posicao);
    tocar('clique');

    try {
      const r = await fetch(`/api/ritual/${pedidoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: item.id, escolha: indiceOriginal }),
      });
      const d = await r.json();

      if (d.redirect && !d.completo && !d.empate) {
        window.location.assign(d.redirect);
        return;
      }

      const avancar = () => {
        setEscolhaVisivel(null);
        if (d.completo) {
          setMomento({ tipo: 'selando' });
          tocar('revelar');
          setTimeout(() => window.location.assign(d.redirect), 1400);
          return;
        }
        if (d.empate) {
          setMomento({ tipo: 'desempate', entre: d.empate.entre });
          return;
        }

        const novas = d.respondidas ?? respondidas + 1;
        setRespondidas(novas);

        const parada = PARADAS[novas];
        const fala = parada ? falas.current[parada] : undefined;
        if (parada && fala) {
          setMomento({ tipo: 'parada', parada, fala });
          tocar('avancar');
          return;
        }
        setMomento((m) =>
          m.tipo === 'cena' ? { tipo: 'cena', indice: m.indice + 1 } : m
        );
      };

      setTimeout(avancar, semMovimento ? 0 : 380);
    } catch {
      setEscolhaVisivel(null);
      setErro('A resposta não chegou do outro lado. Tente de novo.');
    }
  }

  async function desempatar(familiar: string) {
    setErro('');
    try {
      const r = await fetch(`/api/ritual/${pedidoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desempate: familiar }),
      });
      const d = await r.json();
      if (d.completo) {
        setMomento({ tipo: 'selando' });
        tocar('revelar');
        setTimeout(() => window.location.assign(d.redirect), 1400);
      }
    } catch {
      setErro('A escolha não chegou. Tente de novo.');
    }
  }

  const cenaAtual =
    momento.tipo === 'cena' && momento.indice < itens.length
      ? itens[momento.indice]
      : null;

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-5 py-8">
        <BarraDeLuz fracao={respondidas / total} />

        {momento.tipo === 'selando' ? (
          <div className="flex flex-col items-center gap-4 text-center anima-surgir">
            <h1 className="font-display italic text-3xl text-pergaminho text-balance max-w-[20ch]">
              O círculo se fechou.
            </h1>
            <p className="font-corpo font-light text-sm text-pergaminho/60">
              Ele vem até você agora.
            </p>
          </div>
        ) : momento.tipo === 'parada' ? (
          <Parada
            fala={momento.fala}
            pedidoId={pedidoId}
            comAudio={comAudio && momento.parada === 1}
            onContinuar={() => {
              setMomento({
                tipo: 'cena',
                indice: itens.findIndex(
                  (i) => i.id === itens[respondidas - jaRespondidas]?.id
                ),
              });
              // O índice certo é simplesmente "quantas deste lote já foram".
              setMomento({ tipo: 'cena', indice: respondidas - jaRespondidas });
            }}
          />
        ) : momento.tipo === 'desempate' ? (
          <FolhaPergaminho>
            <p className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
              Um último passo
            </p>
            <h2 className="font-display italic text-2xl sm:text-3xl text-escrita text-center text-balance max-w-[24ch]">
              Dois pares de olhos te encontraram ao mesmo tempo.
            </h2>
            <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[40ch]">
              Só um pode atravessar. Escolha por quem você fica.
            </p>
            <div className="flex flex-col gap-3 self-stretch mt-1">
              {momento.entre.map((op) => (
                <button
                  key={op.familiar}
                  onClick={() => desempatar(op.familiar)}
                  className="text-left border border-escrita/20 rounded-xl px-5 py-4 hover:border-ouro-velho hover:bg-ouro-velho/5 transition"
                >
                  <span className="block font-display italic text-lg text-escrita">
                    {op.nome}
                  </span>
                  <span className="block font-corpo font-light text-sm text-escrita-corpo mt-1">
                    &ldquo;{op.chamado}&rdquo;
                  </span>
                </button>
              ))}
            </div>
          </FolhaPergaminho>
        ) : cenaAtual ? (
          <FolhaPergaminho>
            <div key={cenaAtual.id} className="flex flex-col gap-6 self-stretch anima-surgir">
              <h2 className="font-display italic text-2xl sm:text-3xl leading-snug text-escrita text-center text-balance max-w-[26ch] mx-auto">
                {cenaAtual.cena}
              </h2>
              <div className="flex flex-col gap-3">
                {(ordemDasOpcoes[cenaAtual.id] ?? [0, 1, 2, 3]).map(
                  (indiceOriginal, posicao) => {
                    const marcada = escolhaVisivel === posicao;
                    return (
                      <button
                        key={indiceOriginal}
                        onClick={() => responder(cenaAtual, indiceOriginal, posicao)}
                        aria-pressed={marcada}
                        className={[
                          'relative overflow-hidden text-left font-corpo font-light rounded-xl px-5 py-4 border transition-colors duration-200',
                          marcada
                            ? 'border-ouro-velho text-escrita'
                            : 'border-escrita/20 text-escrita-corpo hover:border-ouro-velho/60 hover:bg-ouro-velho/5',
                        ].join(' ')}
                      >
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 origin-left bg-ouro-velho/12 transition-transform duration-500 ease-out"
                          style={{ transform: `scaleX(${marcada ? 1 : 0})` }}
                        />
                        <span className="relative">
                          {cenaAtual.opcoes[indiceOriginal].texto}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </FolhaPergaminho>
        ) : null}

        {erro && (
          <p className="font-corpo text-sm text-center text-red-400 max-w-[36ch]">{erro}</p>
        )}

        {momento.tipo === 'cena' && (
          <p className="font-corpo text-[11px] text-pergaminho/35 text-center max-w-[36ch] leading-relaxed">
            {`${nome}, cada resposta é guardada na hora — pode sair e voltar pelo link do seu e-mail.`}
          </p>
        )}
      </main>
    </>
  );
}

/** A linha de luz: preenche da esquerda pra direita, sem número. */
function BarraDeLuz({ fracao }: { fracao: number }) {
  return (
    <div
      className="w-full max-w-md h-[3px] rounded-full overflow-hidden"
      style={{ background: 'rgba(234,224,204,0.12)' }}
      role="progressbar"
      aria-valuenow={Math.round(fracao * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.max(4, fracao * 100)}%`,
          background:
            'linear-gradient(90deg, rgba(217,164,65,0.35), var(--vela))',
          boxShadow: '0 0 8px rgba(217,164,65,0.45)',
        }}
      />
    </div>
  );
}

/** A cortina em que o familiar fala — e, na Completa, é ouvido. */
function Parada({
  fala,
  pedidoId,
  comAudio,
  onContinuar,
}: {
  fala: Fala;
  pedidoId: string;
  comAudio: boolean;
  onContinuar: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Autoplay é tentativa: o clique da cena anterior costuma valer como
    // gesto, mas se o navegador recusar o player continua na tela.
    if (comAudio && fala.audio) audio.current?.play().catch(() => {});
  }, [comAudio, fala.audio]);

  return (
    <div className="flex flex-col items-center gap-6 text-center anima-surgir max-w-sm">
      <span className="font-corpo text-[0.65rem] tracking-[0.24em] uppercase text-violeta">
        Ele parou para falar com você
      </span>
      <p className="font-display italic text-xl sm:text-2xl leading-snug text-pergaminho text-balance">
        &ldquo;{fala.fala}&rdquo;
      </p>
      {comAudio && fala.audio && (
        <audio
          ref={audio}
          src={`/api/storage/${pedidoId}/${fala.audio}`}
          controls
          className="w-full max-w-[16rem] opacity-80"
        />
      )}
      <button
        onClick={onContinuar}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-3.5 rounded-full hover:brightness-110 transition"
      >
        Continuar
      </button>
    </div>
  );
}
