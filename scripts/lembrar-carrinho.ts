import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import {
  pedidosAbandonados,
  marcarLembretePorEmail,
  registrarEvento,
} from '../src/lib/db';
import { enviarLembreteDeCarrinho } from '../src/lib/email';
import { FAMILIARES, type FamiliarId } from '../src/lib/familiares';
import { criarCupom, precoComDesconto } from '../src/lib/cupons';
import { produtoVigente } from '../src/lib/modelo-de-venda';

/** O tamanho do desconto de resgate. */
const DESCONTO_DE_RESGATE = 45;

/** Quantos dias o código vale. Curto: a urgência é o argumento. */
const DIAS_DO_CUPOM = 3;

/**
 * Um cupom por rodada, com usos contados.
 *
 * Não é um código fixo de 45% de propósito. Um cupom permanente desse tamanho
 * vaza — vai parar em grupo de desconto — e vira o preço real do produto para
 * todo mundo, inclusive para quem compraria pelo cheio. Este nasce com o
 * número exato de pessoas da rodada e morre em três dias.
 *
 * O formato `VOLTA<AAMMDDHHMM>` segue o que o painel de remarketing já criava
 * à mão, para as duas origens aparecerem juntas na mesma listagem.
 */
function cupomDaRodada(pessoas: number): { codigo: string; percentual: number } | null {
  const agora = new Date();
  const carimbo =
    String(agora.getFullYear()).slice(2) +
    String(agora.getMonth() + 1).padStart(2, '0') +
    String(agora.getDate()).padStart(2, '0') +
    String(agora.getHours()).padStart(2, '0') +
    String(agora.getMinutes()).padStart(2, '0');

  const criado = criarCupom({
    codigo: `VOLTA${carimbo}`,
    desconto_percentual: DESCONTO_DE_RESGATE,
    usos_max: pessoas,
    expira_em: new Date(Date.now() + DIAS_DO_CUPOM * 86_400_000).toISOString(),
    nota: `Resgate automático de carrinho — ${pessoas} pessoa(s)`,
  });

  if (!criado.ok) {
    console.error(`  não consegui criar o cupom: ${criado.erro}`);
    return null;
  }
  return { codigo: criado.codigo, percentual: DESCONTO_DE_RESGATE };
}

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

  /**
   * A oferta sai UMA vez por rodada, e só quando há gente para receber.
   * Criar o cupom antes de saber disso encheria a tabela de códigos mortos a
   * cada hora de cron.
   */
  const oferta = secos ? null : cupomDaRodada(pendentes.length);
  const precoDaCompleta = oferta
    ? precoComDesconto(produtoVigente('completa'), oferta.percentual).finalCentavos
    : 0;

  if (oferta) {
    console.log(
      `  oferta da rodada: ${oferta.codigo} · ${oferta.percentual}% · ` +
        `Completa por R$ ${(precoDaCompleta / 100).toFixed(2).replace('.', ',')}\n`
    );
  }

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
        oferta: oferta
          ? { ...oferta, precoCentavos: precoDaCompleta }
          : null,
      });
      // Marca DEPOIS do envio: se o e-mail falhar, a próxima rodada tenta de
      // novo. O contrário deixaria a pessoa sem lembrete nenhum por um erro
      // passageiro de rede.
      //
      // Por E-MAIL e não por pedido: quem refez o ritual três vezes tem três
      // carrinhos, e marcar só um deixaria os outros dois na fila para as
      // próximas rodadas — três e-mails iguais para a mesma pessoa.
      marcarLembretePorEmail(pedido.email);
      registrarEvento('lembrete_enviado', pedido.id);
      enviados += 1;
    } catch (erro) {
      console.error(`    falhou: ${erro instanceof Error ? erro.message : erro}`);
    }
  }

  if (!secos) console.log(`\n${enviados} lembrete(s) enviado(s).`);
}

main();
