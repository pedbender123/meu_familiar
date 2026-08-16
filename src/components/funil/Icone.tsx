'use client';

/**
 * Os ícones da interface, em traço.
 *
 * ── Por que não emoji ─────────────────────────────────────────────────────
 *
 * Emoji é renderizado pela fonte do sistema. O ♀ vira um desenho colorido no
 * Android, um contorno fino no iPhone e uma letra no Linux — três aparências
 * diferentes para o mesmo elemento, nenhuma delas combinando com o resto da
 * tela, e nenhuma aceitando a cor do tema. Numa tela que vende clima, isso é
 * o detalhe que denuncia que o resto foi montado às pressas.
 *
 * Aqui é `currentColor` e `stroke`: herda a cor de quem contém, escala sem
 * borrar, e fica igual em todo aparelho.
 */
export type NomeDoIcone =
  | 'feminino'
  | 'masculino'
  | 'neutro'
  | 'lua'
  | 'relogio'
  | 'ponto'
  | 'olho'
  | 'fogo'
  | 'terra'
  | 'ar'
  | 'agua'
  | 'aspas';

const TRACOS: Record<NomeDoIcone, React.ReactNode> = {
  feminino: (
    <>
      <circle cx="12" cy="9" r="5.2" />
      <path d="M12 14.2V21M9 18h6" />
    </>
  ),
  masculino: (
    <>
      <circle cx="10" cy="14" r="5.2" />
      <path d="M14.2 9.8 20 4m0 0h-5m5 0v5" />
    </>
  ),
  neutro: (
    <>
      <circle cx="12" cy="13.5" r="5" />
      <path d="M12 8.5V3m-2.5 2.5h5M9.5 20h5" />
    </>
  ),
  lua: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  ponto: <circle cx="12" cy="12" r="2.2" />,
  olho: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  // Os quatro sigilos alquímicos: fogo △, terra △ com risco, ar ▽ com risco,
  // água ▽. É o sistema real, e é o que faz os quatro lerem como um conjunto
  // em vez de quatro desenhos avulsos.
  fogo: <path d="M12 5 21 19H3Z" />,
  terra: (
    <>
      <path d="M12 4 21 19H3Z" />
      <path d="M7 14h10" />
    </>
  ),
  ar: (
    <>
      <path d="M12 5 3 19h18Z" />
      <path d="M7 14h10" />
    </>
  ),
  agua: <path d="M12 19 3 5h18Z" />,
  aspas: (
    <path d="M8.5 6.5C6 8 5 10 5 12.5c0 2 1.2 3.5 3 3.5s3-1.3 3-3.2c0-1.8-1.2-3-2.8-3M18 6.5c-2.5 1.5-3.5 3.5-3.5 6 0 2 1.2 3.5 3 3.5s3-1.3 3-3.2c0-1.8-1.2-3-2.8-3" />
  ),
};

export function Icone({
  nome,
  tamanho = 22,
  espessura = 1.5,
  className,
}: {
  nome: NomeDoIcone;
  tamanho?: number;
  espessura?: number;
  className?: string;
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {TRACOS[nome]}
    </svg>
  );
}
