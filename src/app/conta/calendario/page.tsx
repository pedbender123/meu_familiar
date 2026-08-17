import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';

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
    <section className="w-full max-w-2xl flex flex-col items-center pt-4">
      <FolhaPergaminho>
        <p className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
          Calendário
        </p>

        <p className="font-display italic text-xl sm:text-2xl leading-relaxed text-escrita text-center max-w-[32ch]">
          &ldquo;O céu se move devagar. Estou anotando cada passo dele para
          você — ainda não terminei a primeira página.&rdquo;
        </p>

        <hr className="w-20 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

        <p className="font-corpo font-light text-sm text-escrita-fraca text-center max-w-[38ch] leading-relaxed">
          {temAcesso
            ? 'Seus dias de amor, carreira, viagem e fortuna vão aparecer aqui, marcados um a um a partir do seu mapa.'
            : 'Aqui vão ficar seus dias marcados — amor, carreira, viagem e fortuna — lidos do seu próprio mapa.'}
        </p>
      </FolhaPergaminho>
    </section>
  );
}
