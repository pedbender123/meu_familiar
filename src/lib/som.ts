'use client';

/**
 * Efeitos sonoros sintetizados por código, sem depender de arquivo.
 *
 * ── Por que sintetizado, e não baixado ─────────────────────────────────────
 *
 * Efeito de clique/transição é curto e barato de gerar com osciladores — não
 * precisa de um mp3 de terceiro (com licença incerta) para um "tique" de
 * 60ms. A música de fundo é outra história: aquilo tem textura (chuva, vela
 * crepitando) que síntese não reproduz bem, e por isso usa os mp3 reais em
 * `AudioAmbiente.tsx`.
 *
 * ── Por que módulo, e não hook ─────────────────────────────────────────────
 *
 * `tocar()` não guarda estado nenhum entre chamadas — cada efeito é criado e
 * descartado na hora. Um Context só serviria para redistribuir a mesma
 * função, então é mais simples chamar direto de qualquer client component.
 */

const CHAVE_MUDO = 'bx_som_mudo';
const EVENTO_MUDO = 'bx-som-mudo';

let contexto: AudioContext | null = null;

function contextoAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Construtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Construtor) return null;

  if (!contexto) contexto = new Construtor();
  // Navegador começa o contexto suspenso até um gesto do usuário; retomar é
  // barato quando já está rodando, então não custa chamar sempre.
  if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  return contexto;
}

export function estaMudo(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CHAVE_MUDO) === '1';
}

export function alternarMudo(): boolean {
  const novo = !estaMudo();
  window.localStorage.setItem(CHAVE_MUDO, novo ? '1' : '0');
  window.dispatchEvent(new CustomEvent<boolean>(EVENTO_MUDO, { detail: novo }));
  return novo;
}

export function aoMudarMudo(ouvinte: (mudo: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (ev: Event) => ouvinte((ev as CustomEvent<boolean>).detail);
  window.addEventListener(EVENTO_MUDO, handler);
  return () => window.removeEventListener(EVENTO_MUDO, handler);
}

type Efeito = 'clique' | 'avancar' | 'revelar';

interface Perfil {
  /** Uma frequência = tique simples; várias = pequeno arpejo. */
  frequencias: number[];
  duracao: number;
  ganho: number;
  tipo: OscillatorType;
}

const PERFIS: Record<Efeito, Perfil> = {
  // Escolher uma opção: tique curto e discreto.
  clique: { frequencias: [660], duracao: 0.07, ganho: 0.32, tipo: 'sine' },
  // Virar de cena: dois tons subindo, como uma página virando.
  avancar: { frequencias: [520, 780], duracao: 0.14, ganho: 0.28, tipo: 'sine' },
  // Ritual selado / mensagem revelada: arpejo mais quente e longo.
  revelar: { frequencias: [440, 660, 880], duracao: 0.55, ganho: 0.34, tipo: 'triangle' },
};

/** Toca um efeito sintetizado. Silencioso se o navegador não suportar áudio. */
export function tocar(efeito: Efeito) {
  if (estaMudo()) return;
  const ctx = contextoAudio();
  if (!ctx) return;

  const perfil = PERFIS[efeito];
  const agora = ctx.currentTime;
  const passo = (perfil.duracao / perfil.frequencias.length) * 0.6;

  perfil.frequencias.forEach((frequencia, i) => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = perfil.tipo;
    osc.frequency.value = frequencia;

    const inicio = agora + i * passo;
    // Rampa de subida rápida e descida exponencial: evita o "clique" seco de
    // ligar/desligar o oscilador abruptamente (estouro digital audível).
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.linearRampToValueAtTime(perfil.ganho, inicio + 0.015);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + perfil.duracao);

    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + perfil.duracao + 0.05);
  });
}
