import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db, { registrarEvento } from '../src/lib/db';
import { criarTokenMagico, VALIDADE_DO_CONVITE_MIN } from '../src/lib/autenticacao';
import { enviarConviteDosPlanos } from '../src/lib/email';

/**
 * Avisa quem já comprou que os planos mudaram e que ela ganhou 30 dias.
 *
 * Roda UMA vez, depois da migração `012_cortesia_para_quem_comprou` — é o
 * e-mail que dá sentido àquela migração: sem ele a pessoa ganha 30 dias de
 * Oráculo e calendário e nunca fica sabendo.
 *
 * Idempotente pelo evento `convite_planos_enviado`: rodar duas vezes não
 * manda dois e-mails. Isso importa mais aqui do que no resto — é um disparo
 * manual para a base inteira, e "rodei sem querer de novo" é justamente o
 * acidente provável.
 *
 * `--de-verdade` é obrigatório para enviar: sem a flag ele só lista quem
 * receberia. Disparo para base inteira não pode ser o comportamento padrão
 * de um comando que alguém roda para "ver o que acontece".
 */
const NOVIDADES = [
  'O <strong>Oráculo</strong> — perguntas ao seu familiar, com resposta na hora',
  'O <strong>Calendário</strong> — seus dias de amor, carreira, viagem e fortuna',
  'O <strong>guia semanal</strong>, chegando por e-mail',
];

async function main() {
  const enviarDeVerdade = process.argv.includes('--de-verdade');
  const base = process.env.BASE_URL || 'http://localhost:3000';

  const contas = db
    .prepare(
      `SELECT DISTINCT c.email, a.id AS assinatura_id
       FROM contas c
       JOIN assinaturas a ON a.conta_id = c.id
       WHERE a.plano_id = 'revelacao_mensal' AND a.status = 'ativa'`
    )
    .all() as { email: string; assinatura_id: string }[];

  const pendentes = contas.filter(
    (c) =>
      !db
        .prepare(`SELECT 1 FROM eventos WHERE tipo = 'convite_planos_enviado' AND pedido_id = ?`)
        .get(c.assinatura_id)
  );

  console.log(`${contas.length} conta(s) com cortesia ativa; ${pendentes.length} ainda sem convite`);

  if (!enviarDeVerdade) {
    for (const c of pendentes) console.log(`  [seria enviado] ${c.email}`);
    console.log('\nNada foi enviado. Use --de-verdade para disparar.');
    return;
  }

  let enviados = 0;
  for (const conta of pendentes) {
    try {
      const token = criarTokenMagico(conta.email, 'conta', VALIDADE_DO_CONVITE_MIN);
      await enviarConviteDosPlanos({
        nome: conta.email.split('@')[0],
        email: conta.email,
        url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg`,
        diasDeCortesia: 30,
        novidades: NOVIDADES,
      });
      registrarEvento('convite_planos_enviado', conta.assinatura_id);
      enviados++;
      console.log(`  ✓ ${conta.email}`);
    } catch (erro) {
      console.error(`  ✗ ${conta.email}:`, erro);
    }
  }
  console.log(`\n${enviados} convite(s) enviado(s)`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
