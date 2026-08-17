import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { expirarVencidas, vencendoEm, varrerAssinaturasSemPrazo } from '../src/nucleo/ciclo-de-assinatura';
import { criarTokenMagico, VALIDADE_DO_LINK_MIN } from '../src/lib/autenticacao';
import { enviarAvisoDeRenovacao } from '../src/lib/email';
import db, { registrarEvento } from '../src/lib/db';

/**
 * O relógio das assinaturas, para rodar em cron uma vez por dia.
 *
 * Faz três coisas, nesta ordem de propósito: expira o que venceu (para o
 * `status` não mentir), avisa quem está para vencer (que é o mecanismo de
 * renovação de quem paga no Pix), e varre linhas inconsistentes.
 *
 * O aviso sai **7 dias antes do `fim` de cada assinatura**, não numa data
 * fixa do mês: elas vencem em datas rolantes, então data fixa avisaria a
 * maioria na hora errada.
 */
async function main() {
  const expiradas = expirarVencidas();
  console.log(`${expiradas} assinatura(s) marcada(s) como expirada(s)`);

  const base = process.env.BASE_URL || 'http://localhost:3000';
  const vencendo = vencendoEm(7);
  console.log(`${vencendo.length} vencendo nos próximos 7 dias`);

  let avisados = 0;
  for (const assinatura of vencendo) {
    /**
     * Um aviso por assinatura, não um por dia dos sete: sem esta marca o
     * cron mandaria o mesmo e-mail sete vezes seguidas, que é como uma
     * cortesia vira spam e o endereço vai pra caixa de lixo.
     */
    const jaAvisou = db
      .prepare(
        `SELECT 1 FROM eventos WHERE tipo = 'renovacao_avisada' AND pedido_id = ?`
      )
      .get(assinatura.id);
    if (jaAvisou) continue;

    try {
      const token = criarTokenMagico(assinatura.email, 'conta');
      await enviarAvisoDeRenovacao({
        nome: assinatura.email.split('@')[0],
        email: assinatura.email,
        url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg`,
        nomeDoPlano: assinatura.plano_nome,
        diasRestantes: assinatura.dias_restantes,
      });
      registrarEvento('renovacao_avisada', assinatura.id);
      avisados++;
    } catch (erro) {
      console.error(`falha ao avisar ${assinatura.email}:`, erro);
    }
  }
  console.log(`${avisados} aviso(s) de renovação enviado(s)`);
  console.log(`(link do aviso vale ${VALIDADE_DO_LINK_MIN} min, uso único)`);

  varrerAssinaturasSemPrazo();
  console.log('varredura de assinaturas sem prazo concluída');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
