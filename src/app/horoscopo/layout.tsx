import { Suspense } from 'react';
import { MetaPixelHoroscopo } from '@/components/horoscopo/MetaPixelHoroscopo';

export const metadata = {
  title: 'Horóscopo Pessoal — Bruxário',
  description: 'O que o seu Sol e sua Lua já sabem sobre você. Duas perguntas, leitura na hora.',
};

/**
 * Layout aninhado só de `/horoscopo/**`. Monta o pixel PRÓPRIO deste produto
 * — `components/MetaPixel.tsx` (o do Bruxário) ignora estas rotas de
 * propósito, ver o guard nele.
 */
export default function HoroscopoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <MetaPixelHoroscopo />
      </Suspense>
      {children}
    </>
  );
}
