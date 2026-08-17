'use client';

import { useState, useEffect, useRef } from 'react';
import { tocar } from '@/lib/som';
import { CartaDesenhada } from './CartaDesenhada';
import { CeuTracado } from './CeuTracado';
import type { ResultadoDoEspetaculo } from '@/modulos/oraculo/espetaculos';

/**
 * O ritual — o teatro que cobre a espera.
 *
 * ── O problema que ele resolve ────────────────────────────────────────────
 *
 * A geração leva de 8 a 20 segundos. Com um spinner, isso é tempo morto e a
 * pessoa recarrega a página achando que travou. Com o ritual, é o produto: as
 * cartas caem uma a uma, o céu se traça, e quando acaba a resposta está lá.
 *
 * **Os símbolos já existem antes da IA responder** — foram sorteados no
 * servidor e vieram junto. Então o teatro não espera nada para começar: ele
 * roda enquanto o modelo escreve. Se a resposta chega antes, segura; se
 * demora, ainda há teatro pra gastar.
 *
 * `aoTerminar` é chamado quando o show acaba, e quem chama só mostra o texto
 * depois disso — senão a resposta apareceria no meio das cartas virando e
 * estragaria os dois.
 */
export function Ritual({
  espetaculos,
  diaDeOuro,
  aoTerminar,
}: {
  espetaculos: ResultadoDoEspetaculo[];
  diaDeOuro: boolean;
  aoTerminar: () => void;
}) {
  const [ato, setAto] = useState(0);
  const [reveladosNoAto, setReveladosNoAto] = useState(0);
  const terminou = useRef(false);

  const atual = espetaculos[ato];
  const totalDoAto = atual?.simbolos.length ?? 0;

  useEffect(() => {
    if (!atual) return;

    // Um símbolo a cada 1,6s. Rápido o bastante pra não entediar, lento o
    // bastante pra cada carta ser vista — e é isso que dá o tempo de espera.
    if (reveladosNoAto < totalDoAto) {
      const t = setTimeout(() => {
        const proximo = reveladosNoAto + 1;
        const simbolo = atual.simbolos[reveladosNoAto];
        tocar(simbolo?.dourado ? 'ouro' : atual.espetaculo === 'ceu' ? 'ceu' : 'carta');
        setReveladosNoAto(proximo);
      }, reveladosNoAto === 0 ? 700 : 1600);
      return () => clearTimeout(t);
    }

    // Ato terminado: ou vai pro próximo, ou acaba o ritual.
    const t = setTimeout(() => {
      if (ato < espetaculos.length - 1) {
        setAto(ato + 1);
        setReveladosNoAto(0);
      } else if (!terminou.current) {
        terminou.current = true;
        tocar('revelar');
        aoTerminar();
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [ato, reveladosNoAto, totalDoAto, atual, espetaculos.length, aoTerminar]);

  if (!atual) return null;

  return (
    <div
      className="w-full flex flex-col items-center gap-6 py-8 rounded-2xl border transition-colors duration-1000"
      style={{
        borderColor: diaDeOuro ? 'rgba(217,164,65,0.35)' : 'rgba(234,224,204,0.1)',
        background: diaDeOuro
          ? 'linear-gradient(160deg, rgba(217,164,65,0.09), transparent)'
          : 'rgba(234,224,204,0.02)',
      }}
    >
      <p className="font-corpo text-[0.58rem] tracking-[0.26em] uppercase text-pergaminho/40">
        {atual.nome}
      </p>

      {atual.espetaculo === 'ceu' ? (
        <CeuTracado
          simbolos={atual.simbolos}
          revelados={reveladosNoAto}
          posicoes={(atual.cena.posicoes as { planeta: string; signo: string }[]) ?? []}
        />
      ) : (
        <div className="flex items-start justify-center gap-3 sm:gap-4 flex-wrap px-3">
          {atual.simbolos.map((simbolo, i) => (
            <div
              key={simbolo.nome}
              className="transition-all duration-700"
              style={{
                opacity: i < reveladosNoAto ? 1 : 0.25,
                transform:
                  i < reveladosNoAto
                    ? 'translateY(0) scale(1)'
                    : 'translateY(10px) scale(0.94)',
              }}
            >
              <CartaDesenhada
                nome={simbolo.nome}
                posicao={simbolo.posicao}
                dourada={simbolo.dourado}
                virada={i < reveladosNoAto}
                largura={92}
              />
            </div>
          ))}
        </div>
      )}

      {/* Os pontos que mostram em que ato o ritual está. */}
      <div className="flex items-center gap-1.5">
        {espetaculos.map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-all duration-500"
            style={{
              background: i <= ato ? 'var(--vela)' : 'rgb(234 224 204 / 0.2)',
              transform: i === ato ? 'scale(1.4)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
