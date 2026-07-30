import Image from 'next/image';

/**
 * A carta do familiar, apoiada na folha de pergaminho.
 *
 * Ela é um **segundo objeto físico**, não uma imagem dentro do texto. Três
 * detalhes produzem essa leitura, e nenhum deles é decorativo:
 *
 *  - **Contra-rotação.** A folha inclina para a esquerda, a carta para a
 *    direita. Objetos separados nunca se alinham perfeitamente; alinhar
 *    denunciaria que é a mesma div.
 *  - **Cantoneiras nas quinas**, como se prende foto em álbum antigo. É o
 *    detalhe mais barato que faz algo parecer colado numa página.
 *  - **Duas sombras**, uma curta e dura embaixo e uma difusa longa. É como
 *    papel se comporta sobre papel; uma sombra só daria aparência de card
 *    flutuante de web.
 *
 * A arte é `carta.webp` — lua + animal, sem texto. Story e feed trazem o nome e
 * a invocação impressos porque saem do site; a carta não precisa, porque o
 * pergaminho já diz tudo isso em texto de verdade.
 */
export function CartaFamiliar({
  pedidoId,
  alt,
  legenda,
}: {
  pedidoId: string;
  alt: string;
  /** Anotação manuscrita sob a gravura. Ex.: a fase da lua. */
  legenda?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <figure
        className="relative w-[74%] max-w-[19rem] group"
        style={{ aspectRatio: '600 / 900' }}
      >
        <div
          className="relative w-full h-full transition-transform duration-700 ease-out group-hover:rotate-0 group-hover:scale-[1.02]"
          style={{
            transform: 'rotate(1.1deg)',
            filter:
              'drop-shadow(0 2px 1px rgba(46,36,56,0.28)) drop-shadow(0 14px 26px rgba(46,36,56,0.3))',
          }}
        >
          <Image
            src={`/api/storage/${pedidoId}/carta.webp`}
            alt={alt}
            width={600}
            height={900}
            className="w-full h-full object-cover"
            style={{
              // moldura de ouro fina, com respiro claro entre ela e a arte —
              // passe-partout de gravura
              border: '1px solid rgba(217,164,65,0.55)',
              outline: '5px solid var(--folha)',
              outlineOffset: '-6px',
            }}
          />

          {(['no', 'ne', 'se', 'so'] as const).map((canto) => (
            <Cantoneira key={canto} canto={canto} />
          ))}
        </div>
      </figure>

      {legenda && (
        <p className="font-display italic text-sm tracking-wide text-escrita-fraca text-center">
          {legenda}
        </p>
      )}
    </div>
  );
}

const ROTACAO: Record<string, string> = {
  no: '0deg',
  ne: '90deg',
  se: '180deg',
  so: '270deg',
};

const POSICAO: Record<string, string> = {
  no: 'top-[-0.3rem] left-[-0.3rem]',
  ne: 'top-[-0.3rem] right-[-0.3rem]',
  se: 'bottom-[-0.3rem] right-[-0.3rem]',
  so: 'bottom-[-0.3rem] left-[-0.3rem]',
};

function Cantoneira({ canto }: { canto: 'no' | 'ne' | 'se' | 'so' }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute w-[1.35rem] h-[1.35rem] pointer-events-none ${POSICAO[canto]}`}
      style={{ transform: `rotate(${ROTACAO[canto]})` }}
    >
      <span
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(46,36,56,0.34), rgba(46,36,56,0.13))',
          clipPath: 'polygon(0 0, 100% 0, 0 100%)',
        }}
      />
    </span>
  );
}
