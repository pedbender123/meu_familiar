import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { direitosEfetivos } from '../src/nucleo/acesso';
import { enviarCotaRenovada } from '../src/lib/email';
import { criarTokenMagico } from '../src/lib/autenticacao';
import { registrarAviso, desfazerAviso, janelaDoMes } from '../src/lib/avisos';

/**
 * "Suas leituras voltaram" — o e-mail do dia 1.
 *
 * ── Por que este aviso existe ─────────────────────────────────────────────
 *
 * A cota do Oráculo vira sozinha na virada do mês: a janela está na CHAVE do
 * consumo (`janela='mes', chave='2026-08'`), então nada precisa ser zerado e
 * o mês novo simplesmente começa vazio. Isso é elegante por dentro e
 * invisível por fora — quem gastou a última leitura no dia 20 não tem como
 * saber que ela voltou sem abrir o site, e não abre, justamente porque da
 * última vez que abriu estava esgotado.
 *
 * É o gancho de retorno mais honesto que existe aqui: não inventa urgência,
 * não oferece desconto, só conta uma coisa verdadeira que a pessoa não teria
 * como ver de fora.
 *
 * ── Quem recebe ───────────────────────────────────────────────────────────
 *
 * Só quem **usou** o Oráculo no mês passado. Quem nunca usou não sente falta
 * do que voltou, e receberia isto como propaganda de uma coisa que não pediu
 * — para essa pessoa o convite certo é outro, não este.
 *
 * Uso:  npm run cota-renovada [--simular]
 * Cron: 0 10 1 * * cd /root/apps/bruxario && npm run cota-renovada
 */

interface Usuaria {
  id: string;
  email: string;
  nome: string;
  usou: number;
}

/** Quem consumiu alguma coisa do Oráculo no mês anterior. */
function usaramNoMesPassado(agora: Date): Usuaria[] {
  const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const chave = janelaDoMes(anterior);

  return db
    .prepare(
      `SELECT c.id, c.email, SUM(co.usado) AS usou,
              COALESCE((
                SELECT p.nome FROM pedidos p
                 WHERE lower(p.email) = lower(c.email) AND p.nome IS NOT NULL
                 ORDER BY p.criado_em DESC LIMIT 1
              ), '') AS nome
         FROM consumo co
         JOIN contas c ON c.id = co.conta_id
        WHERE co.janela = 'mes' AND co.chave = @chave AND co.usado > 0
        GROUP BY c.id
        ORDER BY usou DESC`
    )
    .all({ chave }) as Usuaria[];
}

async function main() {
  const secos = process.argv.includes('--simular');
  const agora = new Date();
  const janela = janelaDoMes(agora);
  const base = process.env.BASE_URL || 'http://localhost:3000';

  const lista = usaramNoMesPassado(agora);
  console.log(
    `${lista.length} pessoa(s) usaram o Oráculo no mês passado${secos ? ' — SIMULAÇÃO' : ''}`
  );

  let enviados = 0;
  for (const pessoa of lista) {
    const direitos = direitosEfetivos(pessoa.id, pessoa.email, agora);

    // Sem cota nenhuma não há o que anunciar — e dizer "suas leituras
    // voltaram" para quem tem zero seria mentira com cara de convite.
    if (direitos.leiturasPorMes === 0 && direitos.perguntasOraculo === 0) continue;

    console.log(
      `  ${pessoa.email} — usou ${pessoa.usou}, agora tem ${direitos.leiturasPorMes}L/${direitos.perguntasOraculo}M`
    );
    if (secos) continue;

    if (!registrarAviso('cota_renovada', pessoa.email, janela)) continue;

    try {
      const token = criarTokenMagico(pessoa.email, 'conta');
      await enviarCotaRenovada({
        email: pessoa.email,
        nome: pessoa.nome,
        url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg&r=${encodeURIComponent('/conta/oraculo')}`,
        leituras: direitos.leiturasPorMes,
        mensagens: direitos.perguntasOraculo,
      });
      enviados++;
    } catch (erro) {
      desfazerAviso('cota_renovada', pessoa.email, janela);
      console.error(`  falhou para ${pessoa.email}:`, erro);
    }
  }

  if (!secos) console.log(`${enviados} aviso(s) enviado(s).`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
