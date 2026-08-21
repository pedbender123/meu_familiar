import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { buscarPedido } from '../src/lib/db';
import { podeMelhorar, PRECO_DA_MELHORIA_CENTAVOS } from '../src/nucleo/melhoria';
import { enviarOfertaDeMelhoria } from '../src/lib/email';
import { FAMILIARES, type FamiliarId } from '../src/lib/familiares';

/**
 * Manda a oferta de melhoria para pedidos específicos.
 *
 * ```
 * npm run oferecer-melhoria -- --simular <id> [<id>...]
 * npm run oferecer-melhoria -- <id> [<id>...]
 * npm run oferecer-melhoria -- --email alguem@exemplo.com
 * ```
 *
 * Por id ou por e-mail, e nunca em lote automático: esta oferta chega a quem
 * já pagou uma vez, e mandar para a base inteira sem escolher é a diferença
 * entre uma oferta e um incômodo.
 */
async function main() {
  const args = process.argv.slice(2);
  const secos = args.includes('--simular');
  const base = process.env.BASE_URL || 'http://localhost:3000';

  const alvos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--simular') continue;
    if (args[i] === '--email') {
      const email = args[++i];
      const achados = db
        .prepare(
          `SELECT id FROM pedidos WHERE lower(email) = ? AND status = 'entregue'
           ORDER BY criado_em DESC`
        )
        .all(email.trim().toLowerCase()) as { id: string }[];
      alvos.push(...achados.map((a) => a.id));
      continue;
    }
    alvos.push(args[i]);
  }

  if (alvos.length === 0) {
    console.log('uso: npm run oferecer-melhoria -- [--simular] <id|--email X>...');
    return;
  }

  let enviados = 0;
  for (const id of alvos) {
    const pedido = buscarPedido(id);
    if (!pedido) {
      console.log(`  ${id} — pedido não existe`);
      continue;
    }
    if (!podeMelhorar(pedido)) {
      console.log(`  ${pedido.email} — não pode melhorar (${pedido.produto}/${pedido.status})`);
      continue;
    }

    const familiar = FAMILIARES[pedido.familiar as FamiliarId];
    console.log(`  ${pedido.email} — ${familiar?.nome ?? pedido.familiar}`);
    if (secos) continue;

    await enviarOfertaDeMelhoria({
      email: pedido.email,
      nome: pedido.nome,
      nomeFamiliar: familiar?.nome ?? 'Seu familiar',
      url: `${base}/melhorar/${id}`,
      precoCentavos: PRECO_DA_MELHORIA_CENTAVOS,
    });
    enviados++;
  }

  console.log(secos ? 'SIMULAÇÃO — nada enviado.' : `${enviados} oferta(s) enviada(s).`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
