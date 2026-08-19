import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { emailDoAdmin } from '../src/lib/autenticacao';
import { enviarResumoDoDia } from '../src/lib/email';
import { resumoDeAssinantes } from '../src/nucleo/assinantes';
import { registrarAviso, desfazerAviso, janelaDoDia } from '../src/lib/avisos';

/**
 * O dia de ontem, em oito linhas, na sua caixa de entrada.
 *
 * ── Por que existe, tendo painel ──────────────────────────────────────────
 *
 * O painel só conta a história para quem abre o painel. "Vendeu alguma coisa
 * ontem?" não deveria exigir abrir nada — e no dia em que a resposta for
 * ruim, é exatamente o dia em que ninguém abre.
 *
 * Ele também é um alarme passivo, e talvez esse seja o valor maior: um dia em
 * que os rituais caem a zero aparece na caixa de entrada antes de aparecer em
 * qualquer gráfico. Anúncio reprovado, servidor fora, funil quebrado por um
 * deploy — tudo isso tem a mesma assinatura, que é um número virando zero.
 *
 * ── Vai só para o dono ────────────────────────────────────────────────────
 *
 * `ADMIN_EMAIL`, e mais ninguém. A equipe do painel vê os números entrando no
 * painel; e-mail diário automático com faturamento é o tipo de coisa que se
 * encaminha sem pensar.
 *
 * Uso:  npm run resumo-do-dia [--simular]
 * Cron: 0 8 * * * cd /root/apps/bruxario && npm run resumo-do-dia
 */

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function contar(sql: string, params: Record<string, unknown>): number {
  return (db.prepare(sql).get(params) as { n: number }).n;
}

async function main() {
  const secos = process.argv.includes('--simular');
  const dono = emailDoAdmin();
  if (!dono) {
    console.error('ADMIN_EMAIL não configurado — sem para quem mandar.');
    process.exit(1);
  }

  const agora = new Date();
  const fimDeOntem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicioDeOntem = new Date(fimDeOntem.getTime() - 86_400_000);
  const de = inicioDeOntem.toISOString();
  const ate = fimDeOntem.toISOString();

  const rituais = contar(
    `SELECT COUNT(*) n FROM pedidos WHERE criado_em >= @de AND criado_em < @ate AND exemplo = 0`,
    { de, ate }
  );
  const entregues = contar(
    `SELECT COUNT(*) n FROM pedidos WHERE status = 'entregue' AND atualizado_em >= @de AND atualizado_em < @ate AND exemplo = 0`,
    { de, ate }
  );
  const vendas = contar(
    `SELECT COUNT(*) n FROM cobrancas WHERE status = 'pago' AND pago_em >= @de AND pago_em < @ate`,
    { de, ate }
  );
  const receita = (
    db
      .prepare(
        `SELECT COALESCE(SUM(valor_centavos), 0) v FROM cobrancas
          WHERE status = 'pago' AND pago_em >= @de AND pago_em < @ate`
      )
      .get({ de, ate }) as { v: number }
  ).v;
  const leituras = contar(
    `SELECT COUNT(*) n FROM leituras WHERE criado_em >= @de AND criado_em < @ate`,
    { de, ate }
  );

  const assinantes = resumoDeAssinantes(agora);

  const quando = inicioDeOntem.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const linhas = [
    { rotulo: 'Rituais começados', valor: String(rituais) },
    { rotulo: 'Familiares entregues', valor: String(entregues) },
    { rotulo: 'Vendas', valor: String(vendas) },
    { rotulo: 'Receita do dia', valor: reais(receita) },
    { rotulo: 'Leituras do Oráculo', valor: String(leituras) },
    { rotulo: '— assinatura —', valor: '' },
    { rotulo: 'Receita por mês', valor: reais(assinantes.mrrCentavos) },
    { rotulo: 'Pagantes', valor: String(assinantes.pagantes) },
    { rotulo: 'No gratuito', valor: String(assinantes.gratuitos) },
    {
      rotulo: 'Vencendo em 7 dias',
      valor: String(assinantes.vencendo.length),
    },
  ];

  console.log(`Resumo de ${quando}:`);
  for (const l of linhas) console.log(`  ${l.rotulo}: ${l.valor}`);
  if (secos) return;

  const janela = janelaDoDia(agora);
  if (!registrarAviso('resumo_do_dia', dono, janela)) {
    console.log('Já enviado hoje.');
    return;
  }

  try {
    await enviarResumoDoDia({ email: dono, linhas, quando });
    console.log('Enviado.');
  } catch (erro) {
    desfazerAviso('resumo_do_dia', dono, janela);
    console.error('Falhou:', erro);
    process.exit(1);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
