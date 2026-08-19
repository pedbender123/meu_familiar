import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { leiturasParadas, DIAS_DE_ESPERA } from '../src/nucleo/leitura-parada';
import { enviarLeituraEsperando } from '../src/lib/email';
import { criarTokenMagico } from '../src/lib/autenticacao';
import { registrarAviso, desfazerAviso, janelaDoMes } from '../src/lib/avisos';
import { FAMILIARES, type FamiliarId } from '../src/lib/familiares';

/**
 * "Resgate a sua leitura" — o remarketing de quem entrou e não usou.
 *
 * ── Por que ele é honesto ─────────────────────────────────────────────────
 *
 * Não pede nada e não vende nada: a pessoa JÁ TEM a leitura, ela é gratuita, e
 * vai se perder no fim do mês porque a cota não acumula. Avisar disso é um
 * favor — é a única mensagem de remarketing daqui que continuaria verdadeira
 * mesmo se não houvesse nada à venda.
 *
 * A venda acontece do outro lado: quem clica cai no Oráculo e faz uma leitura
 * de verdade, com cartas e o céu do dia. O produto se explicando sozinho
 * converte melhor que qualquer parágrafo sobre planos.
 *
 * ── Quem recebe, exatamente ───────────────────────────────────────────────
 *
 *  1. Fez o ritual e deixou e-mail — a conta existe.
 *  2. Faz **3 dias ou mais** que entrou. Antes disso ainda está no calor da
 *     revelação e provavelmente vai usar sozinha; e-mail aí é atropelo.
 *  3. **Não assina nenhum plano pago.** Quem paga não precisa ser convencido a
 *     usar o que comprou, e receber "resgate sua leitura gratuita" depois de
 *     ter pago é a mensagem errada para a pessoa errada.
 *  4. Ainda tem leitura disponível na cota — se já usou, não há o que resgatar.
 *  5. Nunca fez leitura nenhuma. Quem já fez conhece o produto; para essa
 *     pessoa o convite certo é outro (`cota-renovada`), não este.
 *
 * ── Um por mês, no máximo ─────────────────────────────────────────────────
 *
 * A janela do aviso é a do mês, a mesma da cota. Quem não usar em agosto
 * recebe de novo em setembro, quando a leitura de fato voltou a existir — não
 * é insistência, é um fato novo. Dentro do mesmo mês, nunca duas vezes.
 *
 * Uso:  npm run leitura-esperando [--simular]
 * Cron: 0 15 * * * cd /root/apps/bruxario && npm run leitura-esperando
 */

/** Ver a nota em `scripts/acesso-gratis.ts` — o corte da virada do funil. */
const DESDE = '2026-08-19T00:00:00.000Z';

async function main() {
  const secos = process.argv.includes('--simular');
  const agora = new Date();
  const janela = janelaDoMes(agora);
  const base = process.env.BASE_URL || 'http://localhost:3000';

  const lista = leiturasParadas({ desde: DESDE, agora });
  console.log(
    `${lista.length} conta(s) com leitura parada há ${DIAS_DE_ESPERA}+ dias${secos ? ' — SIMULAÇÃO' : ''}`
  );

  let enviados = 0;
  for (const pessoa of lista) {
    const familiar = pessoa.familiar
      ? FAMILIARES[pessoa.familiar as FamiliarId]?.nome
      : undefined;

    console.log(`  ${pessoa.email} — ${pessoa.quantas} leitura(s) parada(s)`);
    if (secos) continue;

    // Registra antes de enviar — ver `lib/avisos.ts`.
    if (!registrarAviso('leitura_esperando', pessoa.email, janela)) continue;

    try {
      const token = criarTokenMagico(pessoa.email, 'conta');
      await enviarLeituraEsperando({
        email: pessoa.email,
        nome: pessoa.nome,
        url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg&r=${encodeURIComponent('/conta/oraculo')}`,
        quantas: pessoa.quantas,
        nomeFamiliar: familiar,
      });
      enviados++;
    } catch (erro) {
      desfazerAviso('leitura_esperando', pessoa.email, janela);
      console.error(`  falhou para ${pessoa.email}:`, erro);
    }
  }

  if (!secos) console.log(`${enviados} lembrete(s) enviado(s).`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
