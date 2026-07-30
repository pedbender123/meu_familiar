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
      <Link
        href="/termos"
        className="font-corpo text-xs text-pergaminho/45 underline underline-offset-4 hover:text-violeta transition-colors"
      >
        Termos de uso e privacidade
      </Link>
    </footer>
  );
}
