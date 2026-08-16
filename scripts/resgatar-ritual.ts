import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import {
  pedidosParaResgate,
  marcarResgateEnviado,
  registrarEvento,
} from '../src/lib/db';
import { enviarResgateDoRitual } from '../src/lib/email';
import { ITENS } from '../src/lib/quiz/itens';

/**
 * Resgate de quem PAGOU e não terminou o ritual.
 *
 * ── Por que isto não é remarketing ────────────────────────────────────────
 *
 * O lembrete de carrinho persegue uma venda. Este aqui entrega uma venda que
 * já aconteceu: a pessoa pagou, fechou a aba no meio das cenas, e está com um
 * produto pago e não entregue. Não mandar é que seria o problema.
 *
 * É também a consequência direta do funil novo. O teste saiu de antes do
 * pagamento para depois dele, e isso criou um estado que não existia — pago e
 * incompleto. Sem este script esse estado é um buraco: só o painel enxerga, e
 * a pessoa fica esperando uma coisa que nunca chega.
 *
 * ── Um e-mail por pessoa ──────────────────────────────────────────────────
 *
 * `resgate_em` garante isso mesmo com o cron de hora em hora. Insistir com
 * quem pagou é pior do que insistir com quem não pagou: vira reclamação e
 * estorno, e o estorno leva junto a taxa do Mercado Pago.
 *
 * Uso:  npm run resgatar-ritual [--simular]
 * Cron: 0 * * * * cd /root/apps/bruxario && npm run resgatar-ritual
 */
async function main() {
  const secos = process.argv.includes('--simular');
  const pendentes = pedidosParaResgate();

  if (pendentes.length === 0) {
    console.log('Ninguém pagou e parou no meio do ritual.');
    return;
  }

  console.log(
    `${pendentes.length} ritual(is) parado(s)${secos ? ' — SIMULAÇÃO, nada será enviado' : ''}:`
  );

  let enviados = 0;
  for (const pedido of pendentes) {
    const feitas = pedido.cenas_respondidas ?? 0;
    const horas = pedido.pago_em
      ? Math.round((Date.now() - new Date(pedido.pago_em).getTime()) / 3_600_000)
      : 0;
    console.log(
      `  ${pedido.id.slice(0, 8)}  ${pedido.nome.padEnd(20)} ${feitas}/${ITENS.length} cenas  pagou há ${horas}h`
    );

    if (secos) continue;

    try {
      await enviarResgateDoRitual({
        nome: pedido.nome,
        email: pedido.email,
        pedidoId: pedido.id,
        paragrafos: paragrafos(pedido.nome, feitas),
      });
      // Marcado DEPOIS do envio: se o Resend falhar, a pessoa continua na fila
      // para a próxima rodada em vez de sumir sem nunca ter recebido nada.
      marcarResgateEnviado(pedido.id);
      registrarEvento('resgate_enviado', pedido.id);
      enviados += 1;
    } catch (erro) {
      console.error(`    falhou: ${erro instanceof Error ? erro.message : erro}`);
    }
  }

  console.log(secos ? '\nSimulação — nada foi enviado.' : `\n${enviados} enviado(s).`);
}

/**
 * O texto muda conforme o quanto ela já andou.
 *
 * Quem respondeu vinte cenas e quem respondeu zero pararam por motivos
 * diferentes, e um texto único soa genérico para os dois. O que nunca muda:
 * nenhuma cobrança e nenhum "aproveite antes que acabe" — ela já pagou, e o
 * que falta é dela.
 */
function paragrafos(nome: string, feitas: number): string[] {
  if (feitas === 0) {
    return [
      `${nome}, o seu lugar está pago e guardado — mas ele ainda não sabe quem você é.`,
      'As cenas continuam abertas exatamente onde você deixou. São escolhas rápidas, e no fim delas ele aparece com nome, retrato e a leitura escrita a partir do que você respondeu.',
      'Não tem pressa e não tem prazo. É só voltar quando puder.',
    ];
  }

  if (feitas >= ITENS.length - 6) {
    return [
      `${nome}, faltou pouco. Você respondeu quase tudo e parou a alguns passos do fim.`,
      'Tudo que você já respondeu está guardado — nada se perdeu. As últimas cenas são o que falta para ele terminar de te reconhecer.',
      'Menos de um minuto e ele atravessa.',
    ];
  }

  return [
    `${nome}, você começou e parou no meio. Ele ficou esperando ali.`,
    'Suas respostas estão guardadas do jeito que você deixou — é só continuar de onde parou, sem refazer nada.',
    'Quando as cenas acabarem, ele aparece: nome, retrato e a leitura inteira, no seu e-mail.',
  ];
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
