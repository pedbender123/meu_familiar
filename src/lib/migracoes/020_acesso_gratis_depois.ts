import type { Migracao } from './tipos';

/**
 * Quando a chave da plataforma foi entregue de graça — e por qual caminho.
 *
 * ── O que mudou no funil ──────────────────────────────────────────────────
 *
 * Até 19/08 o e-mail com o link de acesso saía junto da entrega, para todo
 * mundo. Isso dava a plataforma inteira antes de a pessoa ter olhado a oferta
 * — e a tela de oferta, que é o único momento de atenção total do funil,
 * competia com um e-mail que já tinha entregado tudo.
 *
 * Agora o acesso grátis chega **depois**, para quem viu a oferta e não
 * comprou. Quem compra recebe a chave na hora, pelo caminho do pagamento.
 *
 * `acesso_gratis_em` é o carimbo desse envio. Ele serve a duas coisas, e a
 * segunda é a que exige uma coluna em vez de um cálculo:
 *
 *  1. **Não repetir.** O cron roda de hora em hora; sem carimbo, a mesma
 *     pessoa receberia o e-mail a cada passagem.
 *  2. **Fechar a janela das avulsas.** As ofertas de 7,90 e 15,90 são da tela
 *     de depois do ritual. Quem já entrou pelo grátis não as vê mais — dali
 *     em diante só os planos recorrentes, e essa decisão precisa ser
 *     consultável na hora de montar a tela.
 */
const migracao: Migracao = {
  id: '020_acesso_gratis_depois',
  descricao: 'Carimbo do envio da chave grátis, que também fecha a janela das avulsas',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('acesso_gratis_em')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN acesso_gratis_em TEXT`);
    }
  },
};

export default migracao;
