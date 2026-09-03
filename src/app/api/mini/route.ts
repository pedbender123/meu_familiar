import { NextRequest, NextResponse } from 'next/server';
import { selarRespostaDoPedido } from '@/lib/porta-do-comprador';
import { v4 as uuidv4 } from 'uuid';
import { calcularSignos, calcularFaseDaLua } from '@/lib/astro';
import { criarPedido, rascunhoVirouPedido, atualizarPedido } from '@/lib/db';
import { validarEmail, validarNome } from '@/lib/validacao';
import { PRODUTO_PADRAO, produtoDe } from '@/lib/produtos';
import { atribuicaoDoPedido } from '@/lib/rastreio';
import { ehFunil, FUNIL_PADRAO } from '@/lib/funis';
import { excedeuLimite } from '@/lib/rate-limit';
import { GRUPOS, ehGrupo } from '@/lib/quiz/grupos';
import { ISCA, grupoDaIsca } from '@/lib/quiz/isca';
import { FAMILIARES } from '@/lib/familiares';
import { gerarVeu } from '@/lib/arte';

/**
 * Fecha o mini-ritual: três cenas e um formulário viram um pedido.
 *
 * ── O que mudou em relação ao `/api/quiz` ─────────────────────────────────
 *
 * Aquele exigia as 26 cenas para criar qualquer coisa. Este cria o pedido com
 * TRÊS — porque o funil inteiro depende de a pessoa chegar ao preço enquanto
 * ainda está curiosa. As 26 continuam existindo e continuam decidindo o
 * familiar; elas só acontecem depois do pagamento (`/ritual/[id]`).
 *
 * ── O familiar gravado aqui é provisório ──────────────────────────────────
 *
 * `familiar` recebe o candidato do meio do grupo, porque a coluna é
 * obrigatória e o véu precisa de uma arte para borrar. Quem distingue
 * "provisório" de "definitivo" é `ritual_completo` — nada no produto deve
 * tratar este valor como resposta antes dessa flag virar 1.
 *
 * ── O grupo é recalculado aqui, não aceito do cliente ─────────────────────
 *
 * A tela manda `grupo` junto para conveniência de log, mas quem decide é
 * `grupoDaIsca` sobre as respostas. Aceitar o campo do corpo deixaria
 * qualquer um escolher o próprio grupo com um POST.
 *
 * ── O e-mail é opcional ───────────────────────────────────────────────────
 *
 * Sem aceite dos termos a tela não mostra campo de e-mail, e o pedido nasce
 * com `email` vazio: a pessoa segue para o preço com dois campos preenchidos.
 * O endereço é pedido depois do pagamento, onde a entrega justifica a coleta
 * por si só. Nada que dependa de e-mail (conta, envio) pode rodar antes de
 * ele existir — ver `aposPagamento`.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`mini:${ip}`)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas. Aguarde um instante.' },
      { status: 429 }
    );
  }

  const corpo = await req.json().catch(() => ({}));
  const { isca, perfilLongo, grupo: grupoPedido, nome, email, dataNascimento, funil } = corpo ?? {};

  /**
   * Dois funis chegam aqui, e eles trazem coisas diferentes.
   *
   * O curto (`/atravessar`) manda as sete cenas da isca. O longo (`/familiar`)
   * manda o perfil daquele formato — coração, objetivo, cor, elemento — que
   * NÃO é psicometria e não decide familiar nenhum: ele existe para a pessoa
   * chegar ao preço tendo investido alguma coisa.
   *
   * Nos dois casos o familiar de verdade sai das 26 cenas, depois da compra.
   */
  const respostas = (isca ?? {}) as Record<string, number>;
  const temIsca = Object.keys(respostas).length > 0;

  if (temIsca) {
    const faltando = ISCA.filter((p) => {
      const e = respostas[p.id];
      return typeof e !== 'number' || e < 0 || e >= p.opcoes.length;
    });
    if (faltando.length > 0) {
      return NextResponse.json(
        { erro: 'Responda as sete perguntas para continuar.' },
        { status: 400 }
      );
    }
  } else if (!perfilLongo || typeof perfilLongo !== 'object') {
    return NextResponse.json({ erro: 'Respostas ausentes.' }, { status: 400 });
  }

  if (!validarNome(nome)) {
    return NextResponse.json(
      { erro: 'Diga como quer ser chamada — pelo menos três letras.' },
      { status: 400 }
    );
  }
  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    return NextResponse.json({ erro: 'Confira a data de nascimento.' }, { status: 400 });
  }

  // Vazio é um estado legítimo (quem não aceitou os termos). Preenchido e
  // torto, não: seria uma entrega perdida sem ninguém perceber.
  const emailLimpo = typeof email === 'string' ? email.trim() : '';
  if (emailLimpo && !validarEmail(emailLimpo)) {
    return NextResponse.json({ erro: 'Confira o e-mail.' }, { status: 400 });
  }

  /**
   * O grupo do funil longo vem da tela, e isso é aceitável AQUI — só aqui.
   *
   * Ele não decide preço, não libera nada e não é resultado: é a coerência
   * entre o que a pessoa acabou de escolher e o que ela vê na revelação. Um
   * valor forjado só faria alguém ver um grupo que não é o seu numa tela que
   * ainda vai ser refeita pelas 26 cenas. O `ehGrupo` impede lixo no banco.
   */
  const grupo = temIsca
    ? grupoDaIsca(respostas)
    : ehGrupo(grupoPedido)
      ? grupoPedido
      : 'caminho';
  // O do meio, e não o primeiro: os três do grupo estão em ordem angular, e o
  // central é o menos comprometido com qualquer das bordas — o véu borra
  // silhueta, mas a que menos entrega o resultado é a do centro.
  const candidatos = GRUPOS[grupo].familiares;
  const provavel = candidatos[Math.floor(candidatos.length / 2)];

  // O signo entra como TEXTURA da leitura, nunca na conta que escolhe o
  // familiar (SPEC 2.1) — é por isso que ele é calculado aqui e guardado,
  // mas não participa de `resultadoDoMini`.
  const { signoSol, signoLua } = calcularSignos(dataNascimento);
  const lua = calcularFaseDaLua(dataNascimento);

  const pedidoId = uuidv4();
  criarPedido({
    id: pedidoId,
    nome: String(nome).trim().slice(0, 40),
    email: emailLimpo,
    respostas_json: JSON.stringify(
      temIsca
        ? { isca: respostas, dataNascimento }
        : { perfilLongo, dataNascimento }
    ),
    familiar: provavel,
    lua,
    signo_sol: signoSol,
    signo_lua: signoLua,
    produto: produtoDe(PRODUTO_PADRAO).id,
    // Qual dos funis fez esta venda. Validado contra o registro em vez de
    // aceito cru: o corpo vem do navegador, e um valor inventado poluiria a
    // comparação entre os formatos.
    funil: ehFunil(funil) ? funil : FUNIL_PADRAO,
    // Origem, campanha, peça e COMO o crédito foi decidido — tudo de uma vez.
    // Ver `atribuicaoDoPedido`: primeiro toque vence, e-mail transacional não
    // rouba crédito, remarketing é a única exceção que sobrescreve.
    ...atribuicaoDoPedido(req.cookies),
    visitante: req.cookies.get('bx_v')?.value ?? null,
    perfil_json: JSON.stringify(temIsca ? { isca: { grupo } } : { perfilLongo }),
  });

  atualizarPedido(pedidoId, {
    grupo,
    cenas_respondidas: 0,
  });

  // O véu é o que a tela de revelação mostra. Uma composição de sharp, sem
  // IA — falhar aqui não pode derrubar a venda, a tela só perde a imagem.
  try {
    await gerarVeu(pedidoId, FAMILIARES[provavel]);
  } catch (erro) {
    console.error('[api/mini] véu falhou:', erro);
  }

  const visitante = req.cookies.get('bx_v')?.value;
  if (visitante) rascunhoVirouPedido(visitante);

  // Ver `porta-do-comprador.ts`.
  return selarRespostaDoPedido(NextResponse.json({ id: pedidoId, grupo }), pedidoId);
}
