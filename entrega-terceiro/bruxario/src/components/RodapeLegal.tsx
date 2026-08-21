import { MARCA } from '@/lib/marca';
import Link from 'next/link';

/**
 * O rodapé permanente exigido pelo SPEC 7.4, em todas as páginas.
 *
 * O texto é o do próprio SPEC, palavra por palavra. Duas regras de forma que a
 * seção trata como jurídicas, não estéticas:
 *
 *  - **Legível de verdade.** Cinza-claro de 10px sobre fundo escuro é dark
 *    pattern: enfraquece o valor legal do aviso e lê como má-fé se alguém
 *    reclamar. Por isso o contraste aqui é baixo mas suficiente, e o tamanho
 *    não desce de 12px.
 *  - **Tom da marca, não juridiquês.** Aviso que assusta espanta cliente e não
 *    protege mais que aviso claro.
 */
export function RodapeLegal() {
  return (
    <footer className="w-full max-w-xl px-6 pt-10 pb-6 flex flex-col items-center gap-4 text-center border-t border-pergaminho/10">
      <p className="font-corpo font-light text-xs leading-relaxed text-pergaminho/50 max-w-[52ch]">
        O Bruxário é entretenimento e autoconhecimento simbólico. As leituras
        são geradas com auxílio de inteligência artificial e não substituem
        orientação profissional de nenhuma natureza — psicológica, médica,
        jurídica ou financeira.
      </p>
      <div className="flex items-center gap-5">
        <a
          href="https://instagram.com/bruxario_"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Bruxário no Instagram"
          className="text-pergaminho/45 hover:text-vela transition-colors"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
          </svg>
        </a>
        <a
          href={`https://tiktok.com/@${MARCA.arroba}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Bruxário no TikTok"
          className="text-pergaminho/45 hover:text-vela transition-colors"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
            <path d="M14 4c.4 2.2 2 3.7 4.5 4" />
          </svg>
        </a>
        <span className="font-corpo text-xs text-pergaminho/35">{`@${MARCA.arroba}`}</span>
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-center">
        <Link
          href="/termos"
          className="font-corpo text-xs text-pergaminho/45 underline underline-offset-4 hover:text-violeta transition-colors"
        >
          Termos de uso
        </Link>
        <Link
          href="/privacidade"
          className="font-corpo text-xs text-pergaminho/45 underline underline-offset-4 hover:text-violeta transition-colors"
        >
          Privacidade
        </Link>
        <Link
          href="/contato"
          className="font-corpo text-xs text-pergaminho/45 underline underline-offset-4 hover:text-violeta transition-colors"
        >
          Falar com a gente
        </Link>
      </div>
    </footer>
  );
}
