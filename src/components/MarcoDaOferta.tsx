'use client';

import { useEffect, useRef } from 'react';
import { marcar } from '@/lib/marcar';

/** Marca que a pessoa chegou a ver a oferta — o degrau mais valioso do funil. */
export function MarcoDaOferta() {
  const marcou = useRef(false);
  useEffect(() => {
    if (marcou.current) return;
    marcou.current = true;
    marcar('plano_visto');
  }, []);
  return null;
}
