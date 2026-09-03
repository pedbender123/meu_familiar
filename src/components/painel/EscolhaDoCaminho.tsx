'use client';

import { FUNIS, caminhoDoFunil, type FunilId } from '@/lib/funis';

/**
 * Por onde esta campanha entra — e, por consequência, qual é o link dela.
 *
 * ── Escolha única, e não uma lista ────────────────────────────────────────
 *
 * A versão anterior deixava marcar várias e sorteava entre elas: um teste A/B
 * dentro do mesmo link. Parecia mais poderoso e era pior de usar — quem cria a
 * campanha não vê qual página vai aparecer, o resultado sai misturado, e a
 * pergunta "esse anúncio está mandando para onde?" deixa de ter resposta.
 *
 * Uma campanha, um caminho, um link. Quem quer comparar duas apostas cria duas
 * campanhas e olha os dois números lado a lado — que é o que se queria fazer
 * de qualquer jeito.
 *
 * ── O caminho aparece na tela ─────────────────────────────────────────────
 *
 * Debaixo de cada opção vai o endereço de verdade. É o que transforma isto de
 * "configuração" em "escolha do link", e é a diferença entre criar a campanha
 * confiante e criar torcendo.
 */

/** O que cada aposta afirma, em uma linha, para quem está criando o anúncio. */
const RESUMO: Record<FunilId, string> = {
  padrao:
    'O teste inteiro é a página. Quem atravessa as 26 cenas já quer o resultado — é o funil que vende hoje.',
  atravessar:
    'Três perguntas, a revelação do grupo, e só então o preço. Aposta em curiosidade rápida.',
  familiar:
    'O funil comprido: nascimento, mapa, leitura da palma, medidor de energia. Aposta em investimento acumulado.',
};

export function EscolhaDoCaminho({
  valor,
  onChange,
}: {
  valor: FunilId;
  onChange: (v: FunilId) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        Por onde esta campanha entra
      </span>

      {Object.values(FUNIS).map((f) => {
        const ativo = valor === f.id;
        const caminho = caminhoDoFunil(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            aria-pressed={ativo}
            className={[
              'flex items-start gap-3 text-left rounded-lg px-3 py-2.5 border transition',
              ativo
                ? 'border-vela/50 bg-vela/10'
                : 'border-pergaminho/15 hover:border-pergaminho/30',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'flex items-center justify-center size-4 rounded-full shrink-0 border mt-0.5 transition',
                ativo ? 'border-vela' : 'border-pergaminho/30',
              ].join(' ')}
            >
              {ativo && <span className="size-2 rounded-full bg-vela" />}
            </span>

            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="font-corpo text-[13px] text-pergaminho/85">
                {f.nome}
                <span className="text-pergaminho/35 font-normal">
                  {' '}· bruxario.com.br{caminho === '/' ? '' : caminho}
                </span>
              </span>
              <span className="font-corpo text-[11px] leading-snug text-pergaminho/45">
                {RESUMO[f.id]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
