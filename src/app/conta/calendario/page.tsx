import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';

/**
 * O Calendário Astrológico — a porta, antes do motor (Fase 7).
 *
 * A tela existe desde já porque é ela que dá endereço ao item do menu; o
 * cálculo de trânsitos (`astronomy-engine`, offline e determinístico) é a
 * Fase 7. Mesmo padrão do Oráculo: nada de cadeado, a espera é dita dentro
 * da ficção.
 */
export default async function Calendario() {
  const sessao = await sessaoAtual();
  const conta = buscarConta(sessao!.email);
  const temAcesso = conta
    ? direitosEfetivos(conta.id, sessao!.email).tiragemDiaria
    : false;

  return (
    <section className="w-full max-w-lg flex flex-col items-center gap-6 pt-6 text-center">
      <p className="font-corpo text-[0.62rem] tracking-[0.26em] uppercase text-escrita-fraca">
        Capítulo IV · Calendário
      </p>

      <p className="font-display italic text-xl sm:text-2xl leading-relaxed text-escrita max-w-[30ch]">
        &ldquo;O céu se move devagar. Estou anotando cada passo dele para
        você — ainda não terminei a primeira página.&rdquo;
      </p>

      <hr className="w-24 h-px border-0 bg-gradient-to-r from-transparent via-escrita/30 to-transparent" />

      <p className="font-corpo font-light text-sm text-escrita-fraca max-w-[34ch] leading-relaxed">
        {temAcesso
          ? 'Seus dias de amor, carreira, viagem e fortuna vão aparecer aqui, marcados um a um a partir do seu mapa.'
          : 'Aqui vão ficar seus dias marcados — amor, carreira, viagem e fortuna — lidos do seu próprio mapa.'}
      </p>
    </section>
  );
}
