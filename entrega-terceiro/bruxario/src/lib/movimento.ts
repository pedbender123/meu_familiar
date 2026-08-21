import { useSyncExternalStore } from 'react';

/**
 * Se a pessoa pediu menos movimento no sistema operacional.
 *
 * Usa `useSyncExternalStore` em vez de `useEffect` + `setState`: a media query é
 * um sistema externo, e este é o jeito que o React tem para ler um. Ganhos
 * concretos sobre o padrão ingênuo:
 *
 *  - nenhuma renderização em cascata na montagem
 *  - se a pessoa mudar a preferência com a página aberta, a UI acompanha
 *  - o servidor devolve `true`, então o HTML já nasce com o texto visível e
 *    nada some entre o primeiro paint e a hidratação
 */
const CONSULTA = '(prefers-reduced-motion: reduce)';

function inscrever(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

function lerNoCliente() {
  return window.matchMedia(CONSULTA).matches;
}

// No servidor assumimos "prefere menos movimento": conteúdo nasce visível.
// O contrário faria o texto aparecer, sumir e reaparecer na hidratação.
function lerNoServidor() {
  return true;
}

export function usePrefereMenosMovimento(): boolean {
  return useSyncExternalStore(inscrever, lerNoCliente, lerNoServidor);
}
