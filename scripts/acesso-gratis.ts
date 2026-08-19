import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { entregarChaveDaPlataforma } from '../src/lib/acesso-plataforma';
import { FAMILIARES, type FamiliarId } from '../src/lib/familiares';

/**
 * "Acesse a sua conta grátis do Bruxário" — para quem viu a oferta e não
 * comprou.
 *
 * ── Por que este e-mail existe, e por que ele demora ──────────────────────
 *
 * Até 19/08 a chave da plataforma saía junto da entrega, para todo mundo. A
 * pessoa recebia tudo antes de olhar a oferta, e a tela de oferta — o único
 * momento de atenção total do funil — competia com um e-mail que já tinha
 * dado o que ela queria.
 *
 * Agora quem compra recebe a chave na hora, pelo caminho do pagamento. Quem
 * não compra recebe algumas horas depois. A espera não é castigo: é o que
 * separa "não comprou porque não quis" de "não comprou ainda". E o e-mail que
 * chega depois tem uma função diferente do que teria na hora — ele não
 * entrega, ele convida a voltar e olhar o que ficou aberto.
 *
 * ── Um e-mail por pessoa ──────────────────────────────────────────────────
 *
 * `acesso_gratis_em` garante isso mesmo com o cron de hora em hora. Sem
 * sequência de follow-up: quem não quis não vai querer no terceiro, vai só
 * marcar como spam — e aí o domínio inteiro paga, inclusive os e-mails de
 * entrega que as pessoas esperam.
 *
 * ── Quem NÃO recebe ───────────────────────────────────────────────────────
 *
 * Quem já comprou (tem cobrança paga): essa pessoa já recebeu a chave pelo
 * pagamento, e mandar "sua conta grátis" para quem acabou de pagar é a forma
 * mais rápida de fazer alguém pedir estorno.
 *
 * Uso:  npm run acesso-gratis [--simular]
 * Cron: 0 * * * * cd /root/apps/bruxario && npm run acesso-gratis
 */

/** Quanto tempo depois da entrega. Ver o comentário acima sobre a espera. */
const HORAS_DE_ESPERA = 4;

/**
 * Nada anterior a esta data, nunca.
 *
 * `acesso_gratis_em` nasce nulo em TODO pedido que já existe — inclusive os
 * de meses atrás, de gente que comprou a Revelação quando ela era paga e já
 * recebeu tudo o que pediu. Sem este corte, a primeira execução em produção
 * dispararia "acesse sua conta grátis" para a base inteira de uma vez: uma
 * onda de e-mail inesperado, marcação de spam, e o domínio queimado junto com
 * os e-mails de entrega que as pessoas de verdade estão esperando.
 *
 * A data é a da virada do funil. Quem entrou antes dela não está neste fluxo.
 */
const DESDE = '2026-08-19T00:00:00.000Z';

interface Pendente {
  id: string;
  nome: string;
  email: string;
  familiar: string;
  leitura_json: string | null;
  criado_em: string;
}

function pendentes(): Pendente[] {
  const limite = new Date(Date.now() - HORAS_DE_ESPERA * 3_600_000).toISOString();

  return db
    .prepare(
      `SELECT p.id, p.nome, p.email, p.familiar, p.leitura_json, p.criado_em
         FROM pedidos p
        WHERE p.status = 'entregue'
          AND p.acesso_gratis_em IS NULL
          AND p.email IS NOT NULL AND p.email <> ''
          AND p.exemplo = 0
          AND p.criado_em <= @limite
          AND p.criado_em >= @desde
          -- Quem comprou já recebeu a chave pelo pagamento.
          AND NOT EXISTS (
            SELECT 1 FROM cobrancas c
             WHERE lower(c.email) = lower(p.email) AND c.status = 'pago'
          )
        ORDER BY p.criado_em`
    )
    .all({ limite, desde: DESDE }) as Pendente[];
}

async function main() {
  const secos = process.argv.includes('--simular');
  const lista = pendentes();

  if (lista.length === 0) {
    console.log('Ninguém esperando acesso grátis.');
    return;
  }

  console.log(
    `${lista.length} pessoa(s) para receber acesso grátis${secos ? ' — SIMULAÇÃO' : ''}:`
  );

  let enviados = 0;
  for (const pedido of lista) {
    const familiar = FAMILIARES[pedido.familiar as FamiliarId];
    const leitura = pedido.leitura_json ? JSON.parse(pedido.leitura_json) : null;
    const horas = Math.round((Date.now() - new Date(pedido.criado_em).getTime()) / 3_600_000);

    console.log(`  ${pedido.email} · ${familiar?.nome ?? pedido.familiar} · há ${horas}h`);
    if (secos) continue;

    const ok = await entregarChaveDaPlataforma({
      email: pedido.email,
      nome: pedido.nome,
      pedidoId: pedido.id,
      nomeFamiliar: familiar?.nome,
      nomeSecreto: leitura?.nome_secreto,
      contaNova: true,
      carimbarComoGratis: true,
    });
    if (ok) enviados++;
  }

  if (!secos) console.log(`\n${enviados} acesso(s) enviado(s).`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
