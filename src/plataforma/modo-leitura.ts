/**
 * A tela de leitura de um livro é a única da plataforma sem casca.
 *
 * ── Por que o menu some ───────────────────────────────────────────────────
 *
 * Porque ali a pessoa está lendo um livro, e livro não tem barra de navegação
 * em volta. A folha de pergaminho ocupando a tela inteira é o produto; o menu
 * ao redor dela lembra o tempo todo que aquilo é um site. A saída continua a
 * um clique — a seta de voltar mora dentro do próprio leitor.
 *
 * O reconhecimento é pela rota, e não por um interruptor passado de mão em
 * mão: quem entra em `/conta/biblioteca/<livro>` está lendo, e ninguém
 * precisa lembrar de avisar.
 */
export function ehModoLeitura(caminho: string | null | undefined): boolean {
  return /^\/conta\/biblioteca\/[^/]+\/?$/.test(caminho ?? '');
}
