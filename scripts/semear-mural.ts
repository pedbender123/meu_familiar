import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { randomUUID } from 'crypto';
import db, { criarPedido, atualizarPedido } from '../src/lib/db';
import { ITENS } from '../src/lib/quiz/itens';
import { pontuar, type Respostas } from '../src/lib/quiz/pontuacao';
import { ANGULO_DO_FAMILIAR } from '../src/lib/quiz/circulo';
import { processarPedido } from '../src/lib/processar';
import type { FamiliarId } from '../src/lib/familiares';

/**
 * Semeia o mural com revelações de amostra.
 *
 * ── Elas são de verdade ───────────────────────────────────────────────────
 *
 * Passam pelo mesmo pipeline do produto: pontuação, Gemini, artes, PDF. Não
 * são maquete — são exatamente o que um cliente recebe. Por isso é honesto
 * mostrá-las como exemplo do que o Bruxário faz.
 *
 * São marcadas com `exemplo = 1` no banco, e isso não é detalhe: sem a marca,
 * elas entrariam na conta de receita e na distribuição dos doze, e as duas
 * medidas passariam a mentir. Nenhuma tem comentário — **depoimento é de
 * cliente ou não é depoimento.**
 *
 * ── Como garante variedade ────────────────────────────────────────────────
 *
 * Em vez de sortear respostas e torcer, ele mira: para cada familiar, procura
 * um conjunto de respostas cujo ângulo caia perto do ângulo dele. Assim o
 * mural nasce com os doze representados em vez de cinco Corvos.
 *
 * Uso:  npm run semear-mural -- --quantos 12
 *       npm run semear-mural -- --limpar     (apaga as amostras anteriores)
 */
const NOMES = [
  'Helena', 'Ariel', 'Marina', 'Ísis', 'Cora', 'Lia',
  'Nina', 'Vera', 'Alma', 'Sofia', 'Rita', 'Dara',
  'Bruna', 'Clara', 'Ester', 'Joana',
];

function respostasAleatorias(rnd: () => number): Respostas {
  const r: Respostas = {};
  for (const item of ITENS) r[item.id] = Math.floor(rnd() * 4);
  return r;
}

/** Procura respostas que caiam perto do ângulo do familiar pedido. */
function respostasPara(alvo: FamiliarId, rnd: () => number): Respostas | null {
  let melhor: { r: Respostas; d: number } | null = null;
  for (let i = 0; i < 4000; i++) {
    const r = respostasAleatorias(rnd);
    const res = pontuar(r);
    if (res.familiar === alvo) {
      const d = res.afinidades[1].distancia - res.afinidades[0].distancia;
      // prefere o mais decidido: evita amostra que caiu ali por um fio
      if (!melhor || d > melhor.d) melhor = { r, d };
      if (d > 12) break;
    }
  }
  return melhor?.r ?? null;
}

async function main() {
  const args = process.argv;
  const quantos = Number(args[args.indexOf('--quantos') + 1]) || 12;

  if (args.includes('--limpar')) {
    const amostras = db
      .prepare('SELECT id FROM pedidos WHERE exemplo = 1')
      .all() as { id: string }[];
    for (const a of amostras) db.prepare('DELETE FROM pedidos WHERE id = ?').run(a.id);
    console.log(`${amostras.length} amostra(s) removida(s).`);
    return;
  }

  let semente = Date.now() % 2147483647;
  const rnd = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };

  const familiares = Object.keys(ANGULO_DO_FAMILIAR) as FamiliarId[];
  const alvos = familiares.slice(0, Math.min(quantos, familiares.length));

  console.log(`Semeando ${alvos.length} revelação(ões) de amostra...\n`);

  for (const [i, alvo] of alvos.entries()) {
    const respostas = respostasPara(alvo, rnd);
    if (!respostas) {
      console.log(`  ${alvo}: não achei respostas que caiam aqui — pulando`);
      continue;
    }

    const id = randomUUID();
    const nome = NOMES[i % NOMES.length];
    const ano = 1985 + Math.floor(rnd() * 20);
    const mes = String(1 + Math.floor(rnd() * 12)).padStart(2, '0');
    const dia = String(1 + Math.floor(rnd() * 28)).padStart(2, '0');

    const { calcularSignos, calcularFaseDaLua } = await import('../src/lib/astro');
    const nascimento = `${ano}-${mes}-${dia}`;
    const { signoSol, signoLua } = calcularSignos(nascimento, '12:00');

    criarPedido({
      id,
      nome,
      // Endereço nosso e inválido de propósito: amostra não manda e-mail para
      // ninguém, e não pode ser confundida com conta de cliente.
      email: `amostra+${id.slice(0, 8)}@bruxario.com.br`,
      respostas_json: JSON.stringify({ quiz: respostas, dataNascimento: nascimento }),
      familiar: alvo,
      lua: calcularFaseDaLua(nascimento, '12:00'),
      signo_sol: signoSol,
      signo_lua: signoLua,
      produto: 'completa',
      // MESMA forma que a rota do quiz grava. Gravar o retorno cru de
      // `pontuar` deixava `perfil.eixos` indefinido e a página de revelação
      // estourava em 500 — bug real, pego no ar.
      perfil_json: (() => {
        const r = pontuar(respostas);
        return JSON.stringify({
          eixos: r.normalizado,
          bruto: r.bruto,
          angulo: r.angulo,
          magnitude: r.magnitude,
          afinidades: r.afinidades,
          empate: r.empate,
        });
      })(),
    });

    // `pago` sem expiração: amostra fica no mural para sempre.
    atualizarPedido(id, {
      status: 'pago',
      exemplo: 1,
      pago_em: new Date().toISOString(),
      expira_em: null,
    });

    process.stdout.write(`  ${nome.padEnd(8)} ${alvo.padEnd(12)} gerando...`);
    await processarPedido(id);

    const feito = db.prepare('SELECT status FROM pedidos WHERE id = ?').get(id) as {
      status: string;
    };
    console.log(` ${feito.status}`);
  }

  const total = db.prepare('SELECT count(*) n FROM pedidos WHERE exemplo = 1').get() as {
    n: number;
  };
  console.log(`\nMural tem ${total.n} amostra(s).`);
}

main();
