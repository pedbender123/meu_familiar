import type { Migracao } from './tipos';

/**
 * As duas avulsas da tela de oferta passam a custar o que a campanha cobra.
 *
 * ── Por que mudou ─────────────────────────────────────────────────────────
 *
 * `avulsa_simples` (R$ 7,90) e `avulsa_completa` (R$ 15,90) nasceram para o
 * modelo em que a Revelação é **grátis** e o que se vende é o desbloqueio.
 * Eram baratas porque o ritual não tinha sido pago.
 *
 * Só que elas entregam exatamente os mesmos direitos que `revelacao` e
 * `completa` — PDF e imagens na primeira, relatório completo e narração na
 * segunda. Com a tela de oferta entrando no ar enquanto o funil COBRA pela
 * Revelação, dois preços diferentes para o mesmo produto na mesma semana é
 * como se perde a confiança de quem comprou pelo caro.
 *
 * Então passam a valer os preços da campanha: R$ 12,90 e R$ 18,90.
 *
 * ── Por que migração e não edição no painel ───────────────────────────────
 *
 * `019_planos_de_agosto` semeou os valores antigos. Mudar só o banco de
 * produção deixaria qualquer ambiente novo nascendo com 7,90 — e a diferença
 * só apareceria quando alguém comprasse pelo preço errado.
 */
const migracao: Migracao = {
  id: '028_precos_da_oferta',
  descricao: 'Avulsas da oferta a R$ 12,90 e R$ 18,90, como a campanha cobra',
  up: (db) => {
    const ajustar = db.prepare('UPDATE planos SET preco_centavos = ? WHERE id = ?');
    ajustar.run(1290, 'avulsa_simples');
    ajustar.run(1890, 'avulsa_completa');
  },
};

export default migracao;
