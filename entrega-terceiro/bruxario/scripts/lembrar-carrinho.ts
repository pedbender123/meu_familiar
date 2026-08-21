import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import {
  pedidosAbandonados,
  marcarLembreteEnviado,
  registrarEvento,
} from '../src/lib/db';
import { enviarLembreteDeCarrinho } from '../src/lib/email';
import { FAMILIARES, type FamiliarId } from '../src/lib/familiares';

/**
 * Recuperação de carrinho: um lembrete para quem respondeu ao ritual inteiro e
 * parou na tela de pagamento.
 *
 * É a receita mais barata do sistema — essas pessoas já investiram cinco
 * minutos e já entregaram o e-mail. O que falta é lembrança, não convencimento.
 *
 * **Um e-mail por pessoa, e só.** A coluna `lembrete_em` garante isso mesmo se
 * o cron rodar de hora em hora. Sem sequência de follow-up: quem não quis não
 * vai querer no terceiro, vai só marcar como spam — e aí o domínio inteiro
 * paga o preço, inclusive os e-mails de entrega que as pessoas esperam.
 *
 * Uso:  npm run lembrar-carrinho
 * Cron: 0 * * * * cd /root/apps/bruxario && npm run lembrar-carrinho
 */
async function main() {
  const secos = process.argv.includes('--simular');
  const pendentes = pedidosAbandonados();

  if (pendentes.length === 0) {
    console.log('Nenhum carrinho para lembrar.');
    return;
  }

  console.log(
    `${pendentes.length} carrinho(s) abandonado(s)${secos ? ' — SIMULAÇÃO, nada será enviado' : ''}:`
  );

  let enviados = 0;
  for (const pedido of pendentes) {
    const familiar = FAMILIARES[pedido.familiar as FamiliarId];
    const horas = Math.round(
      (Date.now() - new Date(pedido.criado_em).getTime()) / 3_600_000
    );
    console.log(
      `  ${pedido.id.slice(0, 8)}  ${pedido.nome.padEnd(20)} ${familiar?.nome ?? '?'}  há ${horas}h`
    );

    if (secos) continue;

    try {
      await enviarLembreteDeCarrinho({
        nome: pedido.nome,
        email: pedido.email,
        pedidoId: pedido.id,
        nomeFamiliar: familiar?.nome ?? 'seu familiar',
      });
      // Marca DEPOIS do envio: se o e-mail falhar, a próxima rodada tenta de
      // novo. O contrário deixaria a pessoa sem lembrete nenhum por um erro
      // passageiro de rede.
      marcarLembreteEnviado(pedido.id);
      registrarEvento('lembrete_enviado', pedido.id);
      enviados += 1;
    } catch (erro) {
      console.error(`    falhou: ${erro instanceof Error ? erro.message : erro}`);
    }
  }

  if (!secos) console.log(`\n${enviados} lembrete(s) enviado(s).`);
}

main();
