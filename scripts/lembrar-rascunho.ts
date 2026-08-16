/**
 * Chama de volta quem deixou o e-mail e largou o ritual no meio.
 *
 *   npx tsx scripts/lembrar-rascunho.ts          → envia
 *   npx tsx scripts/lembrar-rascunho.ts --seco   → só lista, não envia
 *
 * Roda uma vez por pessoa, para sempre: `lembrete_em` é gravado no mesmo
 * instante do envio, e a consulta exclui quem já tem a marca. Rodar o script
 * dez vezes seguidas não manda dez e-mails.
 *
 * A janela de 2h a 72h existe para não escrever a quem largou a aba há dois
 * minutos e ainda pode voltar sozinha, nem a quem passou por aqui na semana
 * passada e já esqueceu.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { marcarLembreteDeRascunho, rascunhosAbandonados } from '../src/lib/db';
import { enviarLembreteDeRascunho } from '../src/lib/email';

const seco = process.argv.includes('--seco');

async function principal() {
  const alvos = rascunhosAbandonados();
  console.log(`${alvos.length} rascunho(s) abandonado(s).`);

  for (const r of alvos) {
    if (seco) {
      console.log(`  [seco] ${r.email} — parou na cena ${r.cena}`);
      continue;
    }
    try {
      await enviarLembreteDeRascunho({ email: r.email, cena: r.cena });
      // Marca DEPOIS do envio: se o Resend falhar, a pessoa continua elegível
      // na próxima rodada em vez de perder o único lembrete que teria.
      marcarLembreteDeRascunho(r.visitante);
      console.log(`  enviado → ${r.email} (cena ${r.cena})`);
    } catch (erro) {
      console.error(`  falhou → ${r.email}:`, erro);
    }
  }
}

principal();
