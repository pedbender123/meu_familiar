import { carregarEnv } from '../lib/carregar-env';
carregarEnv();

import { pedidosTravados } from '../lib/db';
import { processarPedido } from '../lib/processar';

async function main() {
  const travados = pedidosTravados();
  if (travados.length === 0) {
    console.log('Nenhum pedido travado.');
    return;
  }
  console.log(`Reprocessando ${travados.length} pedido(s)...`);
  for (const pedido of travados) {
    console.log(`- ${pedido.id} (status: ${pedido.status}, tentativas: ${pedido.tentativas})`);
    await processarPedido(pedido.id);
  }
  console.log('Concluído.');
}

main().then(() => process.exit(0));
