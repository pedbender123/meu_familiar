import { NextRequest, NextResponse } from 'next/server';
import { exigirEdicaoNoPainel } from '@/lib/guarda-painel';
import {
  atualizarEnvio,
  apagarEnvio,
  buscarEnvio,
  contatos,
  criarRascunhoDeEnvio,
  estaDescadastrado,
  tokenDeDescadastro,
} from '@/lib/remarketing';
import { criarCupom } from '@/lib/cupons';
import { copyPadrao, gerarCopyDaOferta } from '@/lib/copy-oferta';
import { enviarOferta } from '@/lib/email';
import { PRODUTOS, ehProdutoValido, precoFormatado, type ProdutoId } from '@/lib/produtos';
import { precoComDesconto } from '@/lib/cupons';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import db from '@/lib/db';
import { ITENS } from '@/lib/quiz/itens';

async function exigirAdmin() {
  /**
   * Só o dono altera. A equipe do painel entra com `tipo === 'admin'` e vê
   * tudo, mas não muda nada — ver `lib/guarda-painel.ts`.
   */
  const barrado = await exigirEdicaoNoPainel();
  if (barrado) return barrado;
  return null;
}

function base(): string {
  return process.env.BASE_URL || 'http://localhost:3000';
}

/**
 * Gera os rascunhos de e-mail para as pessoas selecionadas.
 *
 * ── Por que rascunho, e não envio direto ──────────────────────────────────
 *
 * O texto é escrito por IA, uma versão por pessoa. Mandar sem ler é confiar
 * que o modelo não escreveu nada torto para ninguém — e num e-mail de venda,
 * um parágrafo esquisito custa a pessoa inteira. Aqui a rota só escreve; o
 * envio é outro clique, depois da revisão.
 *
 * ── O cupom é um só para o lote ───────────────────────────────────────────
 *
 * Um código por campanha de remarketing, com teto de usos igual ao número de
 * pessoas. Cupom individual por pessoa daria rastreio mais fino, mas encheria
 * a tabela de cupons e não muda nenhuma decisão que você vá tomar.
 */
export async function POST(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const c = (await req.json().catch(() => ({}))) ?? {};
  const emails: string[] = Array.isArray(c.emails) ? c.emails : [];
  const ideia = String(c.ideia ?? '').trim().slice(0, 600);
  const produtoId: ProdutoId = ehProdutoValido(c.produto) ? c.produto : 'completa';
  const desconto = Math.min(90, Math.max(1, Math.round(Number(c.desconto) || 45)));

  if (emails.length === 0) {
    return NextResponse.json({ erro: 'Ninguém selecionado.' }, { status: 400 });
  }
  if (!ideia) {
    return NextResponse.json(
      { erro: 'Escreva a ideia da mensagem — é o que guia o texto.' },
      { status: 400 }
    );
  }

  const produto = PRODUTOS[produtoId];
  const preco = precoComDesconto(produto, desconto);

  // Um cupom por lote. O código carrega a data para você reconhecer depois.
  const sufixo = new Date()
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, '');
  let codigo = `VOLTA${sufixo}`;
  const criado = criarCupom({
    codigo,
    desconto_percentual: desconto,
    usos_max: emails.length,
    nota: `Remarketing ${produto.nome} — ${emails.length} pessoas`,
  });
  // Código repetido (segundo lote no mesmo dia): tenta com um sufixo de hora.
  if (!criado.ok) {
    codigo = `VOLTA${sufixo}${String(new Date().getHours()).padStart(2, '0')}`;
    criarCupom({
      codigo,
      desconto_percentual: desconto,
      usos_max: emails.length,
      nota: `Remarketing ${produto.nome} — ${emails.length} pessoas`,
    });
  }

  const todos = contatos();
  const porEmail = new Map(todos.map((x) => [x.email, x]));

  const criados: string[] = [];
  const pulados: { email: string; motivo: string }[] = [];

  for (const bruto of emails) {
    const email = String(bruto).trim().toLowerCase();
    const pessoa = porEmail.get(email);
    if (!pessoa) {
      pulados.push({ email, motivo: 'não encontrada' });
      continue;
    }
    if (estaDescadastrado(email)) {
      pulados.push({ email, motivo: 'descadastrada' });
      continue;
    }

    // O resumo das respostas dá material real para o texto. Só existe para
    // quem chegou a criar pedido — quem só deixou e-mail não tem respostas.
    let resumoRespostas: string | undefined;
    let familiar = null;
    if (pessoa.pedidoId) {
      const p = db
        .prepare('SELECT respostas_json, familiar FROM pedidos WHERE id = ?')
        .get(pessoa.pedidoId) as { respostas_json: string; familiar: string } | undefined;
      if (p) {
        familiar = FAMILIARES[p.familiar as FamiliarId] ?? null;
        try {
          const escolhas = JSON.parse(p.respostas_json).quiz as Record<string, number>;
          resumoRespostas = ITENS.slice(0, 6)
            .map((item) => {
              const e = escolhas?.[item.id];
              const o = typeof e === 'number' ? item.opcoes[e] : undefined;
              return o ? `«${item.cena}» → "${o.texto}"` : null;
            })
            .filter(Boolean)
            .join('\n');
        } catch {
          resumoRespostas = undefined;
        }
      }
    }

    let copy;
    try {
      copy = await gerarCopyDaOferta({
        nome: pessoa.nome,
        ideia,
        descontoPercentual: desconto,
        nomeDoProduto: produto.nome,
        precoDe: `R$ ${precoFormatado(produto)}`,
        precoPor: `R$ ${(preco.finalCentavos / 100).toFixed(2).replace('.', ',')}`,
        familiar,
        cenaMaxima: pessoa.cenaMaxima,
        chegouAoCheckout: pessoa.abriuCheckout,
        jaComprou: pessoa.comprou,
        resumoRespostas,
      });
    } catch (erro) {
      console.error('[remarketing] copy falhou para', email, erro);
      copy = copyPadrao({
        nome: pessoa.nome,
        descontoPercentual: desconto,
        nomeDoProduto: produto.nome,
      });
    }

    criados.push(
      criarRascunhoDeEnvio({
        email,
        nome: pessoa.nome,
        visitante: pessoa.visitante,
        pedidoId: pessoa.pedidoId,
        campanhaId: typeof c.campanhaId === 'string' ? c.campanhaId : null,
        produto: produtoId,
        descontoPercentual: desconto,
        cupom: codigo,
        assunto: copy.assunto,
        corpo: JSON.stringify({
          paragrafos: copy.paragrafos,
          textoDoBotao: copy.textoDoBotao,
        }),
      })
    );
  }

  return NextResponse.json({ ok: true, criados: criados.length, pulados, cupom: codigo });
}

/** Envia um rascunho já revisado. Um por chamada, para o erro ser por pessoa. */
export async function PUT(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const { id } = (await req.json().catch(() => ({}))) ?? {};
  const envio = buscarEnvio(String(id ?? ''));
  if (!envio) return NextResponse.json({ erro: 'envio não encontrado' }, { status: 404 });
  if (envio.status === 'enviado') {
    return NextResponse.json({ ok: true, jaEnviado: true });
  }

  // Reconfere na hora do envio: a pessoa pode ter se descadastrado entre a
  // geração do rascunho e o clique de enviar.
  if (estaDescadastrado(envio.email)) {
    atualizarEnvio(envio.id, { status: 'falhou', erro: 'descadastrada' });
    return NextResponse.json({ erro: 'Esta pessoa se descadastrou.' }, { status: 409 });
  }

  const { paragrafos, textoDoBotao } = JSON.parse(envio.corpo) as {
    paragrafos: string[];
    textoDoBotao: string;
  };

  const produto = PRODUTOS[envio.produto as ProdutoId] ?? PRODUTOS.completa;
  const preco = precoComDesconto(produto, envio.desconto_percentual);
  const url = envio.pedido_id
    // `rm`: este e-mail existe para reconquistar quem foi embora. Se a
    // venda fecha depois dele, o crédito é dele — é a ÚNICA coisa que
    // sobrescreve o primeiro toque. Ver `deveSubstituir` em rastreio.ts.
    ? `${base()}/seu-familiar/${envio.pedido_id}?e=rm`
    : `${base()}/vendas?e=rm`;

  try {
    await enviarOferta({
      nome: envio.nome,
      email: envio.email,
      assunto: envio.assunto,
      paragrafos,
      urlDaOferta: url,
      textoDoBotao,
      chamada: `${envio.desconto_percentual}% na ${produto.nome}: de R$ ${precoFormatado(produto)} por R$ ${(preco.finalCentavos / 100).toFixed(2).replace('.', ',')}${envio.cupom ? ` — use o código ${envio.cupom}` : ''}`,
      urlDeDescadastro: `${base()}/descadastrar?e=${encodeURIComponent(envio.email)}&t=${tokenDeDescadastro(envio.email)}`,
    });
    atualizarEnvio(envio.id, {
      status: 'enviado',
      enviado_em: new Date().toISOString(),
      erro: null,
    });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'falha no envio';
    atualizarEnvio(envio.id, { status: 'falhou', erro: msg });
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

/** Descarta um rascunho que não vai ser enviado. */
export async function DELETE(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 });
  apagarEnvio(id);
  return NextResponse.json({ ok: true });
}
