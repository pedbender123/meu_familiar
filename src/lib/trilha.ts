'use client';

/**
 * O estado do tocador de trilhas, fora do React.
 *
 * ── Por que fora do React ─────────────────────────────────────────────────
 *
 * Quem pede uma faixa não é só o tocador. O leitor de livros troca a trilha
 * quando o capítulo muda (`som:` no Markdown), e um dia a tiragem do dia vai
 * fazer o mesmo. Se o estado morasse num Context, todo mundo que quisesse
 * pedir uma faixa precisaria estar dentro daquela árvore — e o leitor está,
 * mas o próximo não vai estar.
 *
 * É o mesmo desenho de `som.ts`: um módulo com assinantes, lido nos
 * componentes por `useSyncExternalStore`. O elemento `<audio>` em si é do
 * tocador, que é quem sabe desenhar; este arquivo só diz o que deveria estar
 * tocando.
 *
 * ── O que fica guardado ───────────────────────────────────────────────────
 *
 * A última faixa e o volume, no `localStorage` do navegador. Quem escolheu
 * chuva ontem quer chuva hoje, e reconfigurar o volume a cada visita é o tipo
 * de detalhe que faz o som ser desligado de vez.
 *
 * **Nunca começa tocando.** Navegador nenhum permite áudio antes de um gesto,
 * e insistir contra isso gera o pior desfecho: a pessoa acha que está
 * tocando, não está, e o botão parece quebrado.
 */

const CHAVE_FAIXA = 'bx_trilha';
const CHAVE_VOLUME = 'bx_trilha_volume';
const EVENTO = 'bx-trilha';

export interface EstadoDaTrilha {
  /** O id da faixa escolhida. `null` = nenhuma. */
  id: string | null;
  tocando: boolean;
  /** 0 a 1. */
  volume: number;
  /**
   * O rádio está à mostra?
   *
   * **Não é guardado de propósito.** O padrão é escondido, em toda visita: o
   * tocador é uma coisa que a pessoa chama quando quer, não um painel que
   * ocupa canto de tela para sempre. Guardar "estava aberto ontem" faria dele
   * exatamente o que ele deixou de ser.
   */
  aberto: boolean;
}

const VOLUME_PADRAO = 0.45;

let estado: EstadoDaTrilha = {
  id: null,
  tocando: false,
  volume: VOLUME_PADRAO,
  aberto: false,
};
let hidratado = false;

function lerGuardado(): void {
  if (hidratado || typeof window === 'undefined') return;
  hidratado = true;
  try {
    const id = window.localStorage.getItem(CHAVE_FAIXA);
    const volume = Number(window.localStorage.getItem(CHAVE_VOLUME));
    estado = {
      id: id || null,
      tocando: false,
      volume: Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : VOLUME_PADRAO,
      aberto: false,
    };
  } catch {
    // Navegador com armazenamento bloqueado: o tocador funciona igual, só não
    // lembra de nada. Não é motivo para derrubar a página.
  }
}

export function estadoDaTrilha(): EstadoDaTrilha {
  lerGuardado();
  return estado;
}

/** O valor do servidor, para `useSyncExternalStore` não divergir na hidratação. */
export function estadoDaTrilhaNoServidor(): EstadoDaTrilha {
  return { id: null, tocando: false, volume: VOLUME_PADRAO, aberto: false };
}

export function assinarTrilha(ouvinte: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENTO, ouvinte);
  return () => window.removeEventListener(EVENTO, ouvinte);
}

function mudar(novo: Partial<EstadoDaTrilha>): void {
  lerGuardado();
  const anterior = estado;
  estado = { ...estado, ...novo };
  if (
    estado.id === anterior.id &&
    estado.tocando === anterior.tocando &&
    estado.volume === anterior.volume &&
    estado.aberto === anterior.aberto
  ) {
    return;
  }

  try {
    if (estado.id) window.localStorage.setItem(CHAVE_FAIXA, estado.id);
    else window.localStorage.removeItem(CHAVE_FAIXA);
    window.localStorage.setItem(CHAVE_VOLUME, String(estado.volume));
  } catch {
    // ver `lerGuardado`
  }

  window.dispatchEvent(new Event(EVENTO));
}

export function tocarTrilha(id: string): void {
  mudar({ id, tocando: true });
}

export function pausarTrilha(): void {
  mudar({ tocando: false });
}

export function alternarTrilha(id: string): void {
  const atual = estadoDaTrilha();
  if (atual.id === id && atual.tocando) pausarTrilha();
  else tocarTrilha(id);
}

export function definirVolumeDaTrilha(volume: number): void {
  mudar({ volume: Math.min(1, Math.max(0, volume)) });
}

/* ── o rádio ─────────────────────────────────────────────────────────────
   Abrir e fechar não mexe no som: quem fecha o rádio com música tocando
   quer sumir com o controle, não com a trilha. É a diferença entre esconder
   o aparelho e desligá-lo. */

export function abrirRadio(): void {
  mudar({ aberto: true });
}

export function fecharRadio(): void {
  mudar({ aberto: false });
}

export function alternarRadio(): void {
  mudar({ aberto: !estadoDaTrilha().aberto });
}

/**
 * A próxima faixa da lista, em roda.
 *
 * `disponiveis` vem de quem chama porque só o tocador sabe quais faixas a
 * pessoa pode ouvir — este módulo não conhece assinatura nem disco. Em roda
 * porque um rádio que acaba não é um rádio.
 */
export function passarTrilha(disponiveis: string[], sentido: 1 | -1): void {
  if (disponiveis.length === 0) return;

  const atual = estadoDaTrilha();
  const onde = atual.id ? disponiveis.indexOf(atual.id) : -1;
  const proxima =
    disponiveis[(onde + sentido + disponiveis.length * 2) % disponiveis.length];

  // Trocar de faixa é um gesto de quem quer ouvir: sai tocando, mesmo que o
  // rádio estivesse pausado. É o botão de avançar de qualquer aparelho.
  mudar({ id: proxima, tocando: true });
}

/**
 * Um capítulo pedindo a trilha dele.
 *
 * ── Por que pedir não é mandar ────────────────────────────────────────────
 *
 * O livro sugere; quem decide é a pessoa. Se ela pausou o som, virar a página
 * não pode voltar a tocar — som que volta sozinho depois de ser desligado é a
 * coisa mais irritante que uma página web faz. Então a troca só acontece com o
 * tocador já tocando: aí ela quer som, e o capítulo só diz qual.
 */
export function pedirTrilha(id: string | null | undefined): void {
  if (!id) return;
  const atual = estadoDaTrilha();
  if (!atual.tocando) {
    // Guarda a escolha para quando ela apertar o play, sem começar sozinho.
    mudar({ id });
    return;
  }
  if (atual.id !== id) mudar({ id, tocando: true });
}
