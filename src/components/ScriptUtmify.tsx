'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

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
 *
 * ── Por que ele não roda no painel ────────────────────────────────────────
 *
 * O componente mora no layout raiz, que embrulha o site INTEIRO — inclusive
 * a área administrativa. Sem esta guarda, cada vez que o dono abre a Central
 * para conferir as vendas do dia, a UTMify registra uma visita.
 *
 * O estrago é sutil e cumulativo: são dezenas de visitas por dia, todas sem
 * UTM, e todas arquivadas como tráfego direto no painel de quem compra a
 * mídia. Isso derruba a taxa de conversão que a agência mede — o
 * denominador cresce com gente que nunca foi cliente — e some com o rastro
 * dentro da própria ferramenta que deveria mostrá-lo.
 *
 * `/conta` entra pelo mesmo motivo: é a área de quem JÁ comprou, e visita de
 * cliente voltando não é aquisição.
 */
const FORA_DO_FUNIL = ['/painel', '/conta'];

export function ScriptUtmify() {
  const caminho = usePathname();
  const pixel = process.env.NEXT_PUBLIC_UTMIFY_PIXEL_ID?.trim();
  if (!pixel) return null;
  if (caminho && FORA_DO_FUNIL.some((p) => caminho === p || caminho.startsWith(`${p}/`))) {
    return null;
  }

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
