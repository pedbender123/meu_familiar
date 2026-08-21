import Script from 'next/script';

/**
 * O script da Utmify no navegador.
 *
 * ── O que ele faz, e por que é preciso ────────────────────────────────────
 *
 * Ele captura os UTMs da URL do anúncio e os mantém enquanto a pessoa navega
 * pelo site. Sem ele, quem clica no anúncio, atravessa 26 cenas e só então
 * compra teria perdido a origem no caminho — e a venda apareceria como
 * "direta" no relatório.
 *
 * Quem **reporta a venda** é o servidor (`lib/utmify.ts`), no momento em que
 * o pagamento confirma. Este script cuida só da metade de cá: guardar de onde
 * a pessoa veio até a compra acontecer.
 *
 * ── Sem o pixel configurado, nada é carregado ─────────────────────────────
 *
 * Retorna `null`. Não há script morto na página nem erro no console de quem
 * ainda não conectou a conta.
 */
export function ScriptUtmify() {
  const pixel = process.env.NEXT_PUBLIC_UTMIFY_PIXEL_ID?.trim();
  if (!pixel) return null;

  return (
    <>
      <Script id="utmify-pixel" strategy="afterInteractive">
        {`window.pixelId = ${JSON.stringify(pixel)};`}
      </Script>
      <Script
        src="https://cdn.utmify.com.br/scripts/pixel/pixel.js"
        strategy="afterInteractive"
      />
      {/*
        O captador de UTM é um script separado do pixel, e os dois são
        necessários: um mede, o outro guarda a origem entre páginas.

        `data-utmify-prevent-*-ads` desliga a captação de clique de Google e
        TikTok — aqui só se anuncia na Meta, e ligar o resto só sujaria o
        relatório com parâmetro de plataforma que ninguém usa.
      */}
      <Script
        src="https://cdn.utmify.com.br/scripts/utms/latest.js"
        strategy="afterInteractive"
        data-utmify-prevent-xcod-sck
        data-utmify-prevent-subids
      />
    </>
  );
}
