'use client';

import { useEffect, useRef } from 'react';
import { marcar } from '@/lib/marcar';

/**
 * Marca que a página de vendas foi vista, e até onde foi rolada.
 *
 * A profundidade de rolagem é a única coisa que diz se o texto está sendo lido
 * ou se as pessoas batem no hero e saem. Sem ela, "50 visitas e nenhuma venda"
 * não distingue "a página é ruim" de "o anúncio traz gente errada".
 */
export function MarcoDeEntrada() {
  const vistos = useRef(new Set<string>());

  useEffect(() => {
    const uma = (nome: 'landing' | 'landing_meio' | 'landing_fim') => {
      if (vistos.current.has(nome)) return;
      vistos.current.add(nome);
      marcar(nome);
    };

    uma('landing');

    const aoRolar = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const fracao = window.scrollY / total;
      if (fracao >= 0.45) uma('landing_meio');
      if (fracao >= 0.9) uma('landing_fim');
    };

    window.addEventListener('scroll', aoRolar, { passive: true });
    aoRolar();
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  return null;
}
