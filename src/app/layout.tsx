import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Bruxário — O familiar de bruxa que te escolheu",
  description:
    "Toda bruxa tem um familiar. O seu já te escolheu. Você só ainda não sabe qual é.",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
