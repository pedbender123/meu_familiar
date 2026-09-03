import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { Farejador } from "@/components/Farejador";
import { AudioAmbiente } from "@/components/AudioAmbiente";
import { MetaPixel } from "@/components/MetaPixel";
import { ScriptUtmify } from "@/components/ScriptUtmify";

const cormorant = localFont({
  src: "../assets/fonts/CormorantGaramond.woff2",
  variable: "--font-cormorant",
  display: "swap",
});

const sora = localFont({
  src: [
    { path: "../assets/fonts/Sora.woff2", weight: "300 700", style: "normal" },
  ],
  variable: "--font-sora",
  display: "swap",
});

const pinyon = localFont({
  src: "../assets/fonts/PinyonScript.woff2",
  variable: "--font-pinyon",
  display: "swap",
});

const SITE = process.env.BASE_URL || 'https://bruxario.com.br';

/**
 * Metadados padrão de todo o site.
 *
 * `metadataBase` é o que faz as URLs relativas das imagens virarem absolutas —
 * sem ele, o robô do WhatsApp recebe "/og/inicio.png" e não sabe de onde
 * baixar, e o card aparece como retângulo cinza.
 *
 * Cada página sobrescreve o que precisa; o que não sobrescrever herda daqui.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Bruxário — O familiar de bruxa que te escolheu',
  description:
    'Toda bruxa tem um familiar. O seu já te escolheu. Você só ainda não sabe qual é.',
  openGraph: {
    type: 'website',
    siteName: 'Bruxário',
    locale: 'pt_BR',
    title: 'Bruxário — O familiar de bruxa que te escolheu',
    description:
      'Cenas revelam qual dos doze caminha ao seu lado, com o seu Sol e a sua Lua na leitura.',
    images: [{ url: '/og/inicio.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${cormorant.variable} ${sora.variable} ${pinyon.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          Suspense obrigatório: Farejador e MetaPixel usam useSearchParams, e
          sem a fronteira o Next força a página inteira a renderizar no
          cliente — o que derrubaria a geração estática de /termos e
          /privacidade.
        */}
        <Suspense fallback={null}>
          <Farejador />
          <MetaPixel />
          {/*
            O captador de UTM da Utmify, e hoje o ÚNICO tracker do navegador.

            O `MetaPixel` acima está desligado desde 24/08 pela variável vazia,
            e é decisão, não esquecimento: com os dois ligados, o mesmo
            `Purchase` ia para o mesmo destino por dois caminhos e a Meta
            contava duas vezes — foi assim que 5 vendas viraram 17 no
            gerenciador. Quem fala com a Meta agora é a Utmify.

            Ele fica desligado, e não apagado, porque é o único caminho que
            resta se a Utmify falhar. A tela de Saúde acende se algum dia os
            dois voltarem a ficar ligados juntos.
          */}
          <ScriptUtmify />
        </Suspense>
        <AudioAmbiente />
        {children}
      </body>
    </html>
  );
}
