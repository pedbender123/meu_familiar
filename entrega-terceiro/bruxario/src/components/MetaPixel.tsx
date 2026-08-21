'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
/** Código do Test Events da Meta. Só existe enquanto se testa; ver .env.example. */
const CODIGO_DE_TESTE = process.env.NEXT_PUBLIC_META_PIXEL_TEST_CODE;

/**
 * Base do Pixel da Meta + `PageView` a cada troca de rota.
 *
 * ── Por que mora aqui, e não em cada funil ────────────────────────────────
 *
 * O funil que a pessoa vê (padrão, atravessar, familiar, /vendas) é decisão
 * da campanha — ver `src/app/page.tsx`. O pixel não precisa saber qual é: ele
 * só reporta que uma página carregou. Um componente só no layout, disparando
 * em toda rota, evita colar o script em cada página de venda e esquecer uma.
 *
 * ── `PIXEL_ID` vazio ───────────────────────────────────────────────────────
 *
 * Sem a variável de ambiente (dev, ou enquanto a chave não é configurada),
 * este componente não renderiza nada — nenhum script sobe, nenhum evento
 * dispara. `lib/pixel.ts` também guarda essa ausência, então nada quebra se
 * algum evento for chamado antes do script carregar.
 */
export function MetaPixel() {
  const caminho = usePathname();
  // O Horóscopo é outro produto, com pixel próprio (`MetaPixelHoroscopo`) —
  // ver AETHER_LINK.md/decisão do produto separado. Sem este guard, os dois
  // pixels disparariam juntos ali e misturariam a atribuição dos dois anúncios.
  if (!PIXEL_ID || caminho?.startsWith('/horoscopo')) return null;
  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          ${CODIGO_DE_TESTE ? `fbq('set', 'testEventCode', '${CODIGO_DE_TESTE}');` : ''}
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
      <RastreiaPageView />
    </>
  );
}

/**
 * Separado do componente de cima porque `useSearchParams` exige um limite de
 * `Suspense` acima — o mesmo motivo que já vale para `Farejador`.
 */
function RastreiaPageView() {
  const caminho = usePathname();
  const busca = useSearchParams();
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    const chave = `${caminho}?${busca.toString()}`;
    if (ultimo.current === chave) return;
    ultimo.current = chave;
    if (typeof window.fbq === 'function') window.fbq('track', 'PageView');
  }, [caminho, busca]);

  return null;
}
