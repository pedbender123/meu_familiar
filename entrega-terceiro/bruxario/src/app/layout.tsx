import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { Farejador } from "@/components/Farejador";
import { AudioAmbiente } from "@/components/AudioAmbiente";
import { MetaPixel } from "@/components/MetaPixel";
import { estadoDaLicenca } from '@/lib/licenca';
import { FaixaDaLicenca } from '@/components/FaixaDaLicenca';

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
    description: 'Cenas revelam qual dos doze caminha ao seu lado. O signo tem peso zero.',
    images: [{ url: '/og/inicio.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

/**
 * A licença é conferida AQUI, e não no proxy.
 *
 * O proxy roda no runtime Edge e é atravessado por toda requisição, inclusive
 * imagem e arquivo estático — pendurar uma checagem de rede ali custaria
 * latência em tudo. O layout roda uma vez por página, no Node, e é onde o
 * resultado pode ser guardado em memória entre requisições.
 *
 * Ver `lib/licenca.ts` e `LICENCA.md`.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const licenca = await estadoDaLicenca();

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
        </Suspense>
        <AudioAmbiente />
        {licenca.estado === 'avisando' && (
          <FaixaDaLicenca mensagem={licenca.mensagem} />
        )}
        {licenca.estado === 'suspensa' ? <Suspensa mensagem={licenca.mensagem} /> : children}
      </body>
    </html>
  );
}

/**
 * A tela de suspensão, embutida no layout.
 *
 * Não é um `redirect`: redirecionar deixaria a rota original acessível para
 * quem soubesse chamá-la direto, e o painel administrativo precisa continuar
 * abrindo — quem assumiu a operação tem que conseguir ver os pedidos e falar
 * com quem comprou mesmo com a licença suspensa.
 */
function Suspensa({ mensagem }: { mensagem?: string }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 gap-4 text-center">
      <h1 className="font-display italic text-3xl text-pergaminho max-w-[24ch] text-balance">
        Este site está temporariamente indisponível.
      </h1>
      <p className="font-corpo font-light text-sm text-pergaminho/55 max-w-[38ch] leading-relaxed">
        {mensagem ??
          'Volte em algumas horas. Se você fez uma compra e precisa de ajuda, responda o e-mail que recebeu.'}
      </p>
    </main>
  );
}
