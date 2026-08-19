import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { perfilAstralDaConta } from '../src/nucleo/perfil-astral';
import { direitosEfetivos } from '../src/nucleo/acesso';
import { calcularMes, mapaDaConta } from '../src/modulos/calendario/calendario';
import { enviarDiaDeOuro } from '../src/lib/email';
import { criarTokenMagico } from '../src/lib/autenticacao';
import { registrarAviso, desfazerAviso, janelaDoDia } from '../src/lib/avisos';

/**
 * "Hoje é um dia de ouro" — o aviso mais barato e mais raro da plataforma.
 *
 * ── Por que ele vale a pena ───────────────────────────────────────────────
 *
 * É o único e-mail do sistema com custo variável ZERO: o cálculo sai de
 * `astronomy-engine`, offline e determinístico, sem nenhuma chamada de IA. E
 * é o único motivo de voltar que não é promoção — ele não vende nada, avisa
 * de uma coisa que já está calculada esperando.
 *
 * ── E por que ele não vira ruído ──────────────────────────────────────────
 *
 * Dia de ouro exige as quatro portas abertas ao mesmo tempo no mapa daquela
 * pessoa. São poucos por ano e caem em dias diferentes para cada uma — não
 * existe "dia de ouro do Bruxário", existe o dela. Se isso chegasse toda
 * semana o próximo iria para a lixeira sem ser aberto.
 *
 * ── Quem recebe ───────────────────────────────────────────────────────────
 *
 * Quem tem mapa natal preenchido e alcance de calendário além do dia de hoje.
 * Quem está no gratuito fica de fora **de propósito**: o grátis só abre o dia
 * corrente, e mandar um e-mail sobre uma coisa que a pessoa vai clicar e
 * encontrar trancada é a pior forma possível de apresentar um plano.
 *
 * Uso:  npm run dia-de-ouro [--simular]
 * Cron: 0 9 * * * cd /root/apps/bruxario && npm run dia-de-ouro
 */

const ALCANCES_QUE_VEEM_ADIANTE = new Set(['semana', 'mes', 'semestre', 'ano', 'rolante']);

interface Candidata {
  id: string;
  email: string;
  nome: string;
}

function candidatas(): Candidata[] {
  return db
    .prepare(
      `SELECT c.id, c.email,
              COALESCE((
                SELECT p.nome FROM pedidos p
                 WHERE lower(p.email) = lower(c.email) AND p.nome IS NOT NULL
                 ORDER BY p.criado_em DESC LIMIT 1
              ), '') AS nome
         FROM contas c
        WHERE c.nascimento_data IS NOT NULL
          AND c.nascimento_lat IS NOT NULL
        ORDER BY c.criado_em`
    )
    .all() as Candidata[];
}

async function main() {
  const secos = process.argv.includes('--simular');
  const hoje = new Date();
  const janela = janelaDoDia(hoje);
  const chaveDeHoje = janela;
  const base = process.env.BASE_URL || 'http://localhost:3000';

  const lista = candidatas();
  console.log(`${lista.length} conta(s) com mapa natal completo`);

  let enviados = 0;
  let deOuro = 0;

  for (const pessoa of lista) {
    const direitos = direitosEfetivos(pessoa.id, pessoa.email, hoje);
    if (!ALCANCES_QUE_VEEM_ADIANTE.has(direitos.alcanceCalendario)) continue;

    const { dados } = perfilAstralDaConta(pessoa.id);
    const mapa = mapaDaConta(dados);
    if (!mapa) continue;

    const mes = calcularMes(mapa, direitos.alcanceCalendario, hoje.getFullYear(), hoje.getMonth(), hoje);
    const hojeNoMapa = mes.dias.find((d) => d.data === chaveDeHoje);
    if (!hojeNoMapa?.ouro) continue;

    deOuro++;
    console.log(`  ${pessoa.email} — dia de ouro`);
    if (secos) continue;

    /**
     * Registra ANTES de enviar. Ver a nota em `lib/avisos.ts`: mandar de menos
     * é chato, mandar o mesmo aviso a cada passagem do cron é motivo de spam.
     * Se o envio falhar, o registro é desfeito e a próxima passagem tenta.
     */
    if (!registrarAviso('dia_de_ouro', pessoa.email, janela)) continue;

    try {
      const token = criarTokenMagico(pessoa.email, 'conta');
      await enviarDiaDeOuro({
        email: pessoa.email,
        nome: pessoa.nome,
        url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg&r=${encodeURIComponent('/conta/calendario')}`,
        frase: hojeNoMapa.frase ?? 'As quatro portas abrem juntas hoje.',
      });
      enviados++;
    } catch (erro) {
      desfazerAviso('dia_de_ouro', pessoa.email, janela);
      console.error(`  falhou para ${pessoa.email}:`, erro);
    }
  }

  console.log(
    `${deOuro} com dia de ouro hoje · ${secos ? 'SIMULAÇÃO' : `${enviados} enviado(s)`}`
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
