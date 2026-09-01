import type { Migracao } from './tipos';

/**
 * Quando a chave de acesso saiu — por cobrança.
 *
 * ── A pergunta que ninguém conseguia responder ────────────────────────────
 *
 * "Quem assinou recebeu o acesso ao app?" O sistema sabia que o pagamento
 * confirmou e sabia que `entregarChaveDaPlataforma` tinha sido chamada. O que
 * ela devolveu morria num `registrarEvento` sem referência — o `pedidoId` é
 * indefinido no caminho da assinatura, então o evento existia solto, sem
 * dizer de quem era.
 *
 * Na prática, o único jeito de conferir era abrir a caixa de e-mail do
 * cliente. E a resposta importa: em assinatura, o e-mail que não chega não
 * produz um chamado de suporte — produz um cancelamento no mês seguinte, sem
 * explicação nenhuma.
 *
 * ── Por que na cobrança, e não na conta ───────────────────────────────────
 *
 * Porque é a cobrança que dispara a entrega, e porque a mesma conta pode
 * assinar, sair e voltar. Na conta só caberia a última vez, e "a última vez"
 * apaga justamente o caso interessante: a assinatura em que a chave não saiu.
 *
 * `NULL` quer dizer duas coisas diferentes, e as duas são úteis: cobrança que
 * ainda não foi paga, e cobrança paga cuja entrega falhou. O status da própria
 * linha separa as duas.
 */
const migracao: Migracao = {
  id: '039_acesso_entregue',
  descricao: 'Quando a chave de acesso foi entregue a quem assinou',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(cobrancas)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('acesso_enviado_em')) {
      db.exec(`ALTER TABLE cobrancas ADD COLUMN acesso_enviado_em TEXT`);
    }
  },
};

export default migracao;
