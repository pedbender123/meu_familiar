import db from './db';
import { PRODUTOS, type Produto, type ProdutoId } from './produtos';
import { precoVigenteCentavos } from './modelo-de-venda';

/**
 * Cupons de desconto.
 *
 * ── Duas coisas que este arquivo existe para garantir ─────────────────────
 *
 * **1. O desconto nunca vem do navegador.** A tela manda o código; quem decide
 * quanto vale é o servidor, e o preço cobrado é recalculado do zero a partir
 * do que ficou gravado no pedido. Se fosse o cliente a mandar o percentual,
 * qualquer pessoa com o DevTools aberto compraria tudo por um centavo.
 *
 * **2. O percentual fica CONGELADO no pedido.** Gravamos o número, não só o
 * código. Assim, mudar um cupom de 20% para 10% amanhã não reescreve o preço
 * de quem comprou ontem — o histórico continua contando a verdade.
 *
 * ── Quando o uso é contado ────────────────────────────────────────────────
 *
 * No **pagamento**, não na aplicação. Contar ao digitar o código faria dez
 * carrinhos abandonados queimarem um cupom de dez usos sem ninguém ter
 * comprado nada. O efeito colateral aceito é que dois pedidos simultâneos
 * podem passar do limite; nesta escala, perder uma venda por corrida vale
 * menos que travá-la.
 *
 * ── O piso cobrável ───────────────────────────────────────────────────────
 *
 * Gateway nenhum processa R$ 0,47. Se o desconto derruba o valor abaixo de
 * `PISO_COBRAVEL_CENTAVOS`, o pedido vira **gratuito** em vez de tentar cobrar
 * um valor que o Mercado Pago recusaria — e pedido gratuito não passa pelo
 * checkout, é liberado direto.
 */

/** Abaixo disto o gateway recusa. Vira grátis em vez de tentar cobrar. */
export const PISO_COBRAVEL_CENTAVOS = 100;

export interface Cupom {
  codigo: string;
  desconto_percentual: number;
  /** `null` = ilimitado. */
  usos_max: number | null;
  usos: number;
  /** ISO. `null` = não expira. */
  expira_em: string | null;
  ativo: number;
  /** Para você lembrar por que criou. Não aparece para o comprador. */
  nota: string | null;
  criado_em: string;
}

/**
 * Normaliza o que a pessoa digita: `  amiga-10 ` e `AMIGA10` são o mesmo
 * cupom. Sem isto, o suporte vira "digitei certo, não funciona".
 */
export function normalizarCodigo(bruto: string): string {
  return bruto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
}

export type MotivoRecusa =
  | 'inexistente'
  | 'inativo'
  | 'expirado'
  | 'esgotado';

export const RECUSA_EM_PORTUGUES: Record<MotivoRecusa, string> = {
  inexistente: 'Esse cupom não existe.',
  inativo: 'Esse cupom não está mais valendo.',
  expirado: 'Esse cupom venceu.',
  esgotado: 'Esse cupom já foi todo usado.',
};

export type ResultadoCupom =
  | { ok: true; cupom: Cupom }
  | { ok: false; motivo: MotivoRecusa };

export function validarCupom(bruto: string, agora = new Date()): ResultadoCupom {
  const codigo = normalizarCodigo(bruto);
  if (!codigo) return { ok: false, motivo: 'inexistente' };

  const cupom = db
    .prepare('SELECT * FROM cupons WHERE codigo = ?')
    .get(codigo) as Cupom | undefined;

  if (!cupom) return { ok: false, motivo: 'inexistente' };
  if (!cupom.ativo) return { ok: false, motivo: 'inativo' };
  if (cupom.expira_em && new Date(cupom.expira_em) <= agora) {
    return { ok: false, motivo: 'expirado' };
  }
  if (cupom.usos_max !== null && cupom.usos >= cupom.usos_max) {
    return { ok: false, motivo: 'esgotado' };
  }
  return { ok: true, cupom };
}

export interface PrecoComDesconto {
  /** O de tabela, para mostrar riscado. */
  cheioCentavos: number;
  finalCentavos: number;
  descontoPercentual: number;
  /** `true` quando nada será cobrado e o checkout deve ser pulado. */
  gratis: boolean;
  /**
   * Quanto dos `finalCentavos` são ebooks marcados no checkout.
   *
   * Zero em quase todo pedido. Separado do preço do produto porque as duas
   * receitas se leem diferente — uma é a oferta que a campanha anuncia, a
   * outra é o que ela conseguiu somar depois do sim — e porque só o produto
   * recebe desconto de cupom.
   */
  bumpsCentavos: number;
}

/**
 * O preço que vale, dado um produto e um percentual já validado.
 *
 * É a **única** função que calcula preço com desconto. A tela de pagamento, a
 * chamada ao Mercado Pago e o painel passam todos por aqui — é o que impede o
 * caso clássico de a vitrine mostrar um valor e a cobrança sair outro.
 */
export function precoComDesconto(
  /**
   * Só o preço importa aqui. Pedir um `Produto` inteiro obrigava quem vende
   * um PLANO a fabricar um produto de mentira, com `pdf`, `imagens` e
   * `diasDeLinkPublico` que não significam nada numa conta de desconto.
   */
  produto: { precoCentavos: number },
  descontoPercentual = 0,
  /**
   * Os ebooks marcados no checkout, já somados por `somaDosBumps`.
   *
   * ── Por que entra DEPOIS do desconto ────────────────────────────────────
   *
   * O cupom foi dado para a oferta que a campanha anuncia. Deixá-lo incidir
   * sobre o bump daria um desconto que ninguém prometeu, num item cujo preço
   * é a coisa toda: R$ 9,90 com 20% vira R$ 7,92, e a margem de um PDF de
   * impulso não tem essa folga.
   *
   * ── Por que não entra no `cheioCentavos` ────────────────────────────────
   *
   * Porque o cheio é o riscado, e riscar o bump afirmaria que ele já custou
   * mais — o que seria propaganda enganosa pelo mesmo motivo que
   * `PRECO_RISCADO_CENTAVOS` existe separado em `modelo-de-venda.ts`.
   */
  bumpsCentavos = 0
): PrecoComDesconto {
  const pct = Math.max(0, Math.min(100, Math.round(descontoPercentual)));
  const cheio = produto.precoCentavos;
  // Arredonda para cima: 20% de R$ 9,80 dá R$ 7,84 e não R$ 7,83. Centavo a
  // menos no nosso bolso é irrelevante; centavo a mais é cobrança indevida.
  const doProduto = Math.ceil(cheio * (1 - pct / 100));
  const extras = Math.max(0, Math.round(bumpsCentavos));

  /*
    O piso vale sobre o TOTAL, não sobre o produto.

    Um cupom de 100% na Revelação com um ebook marcado não é uma venda grátis:
    são R$ 9,90 a cobrar. Aplicar o piso só ao produto faria o checkout ser
    pulado e o livro entregue sem cobrança nenhuma.
  */
  const total = doProduto + extras;

  return {
    cheioCentavos: cheio,
    finalCentavos: total < PISO_COBRAVEL_CENTAVOS ? 0 : total,
    descontoPercentual: pct,
    gratis: total < PISO_COBRAVEL_CENTAVOS,
    bumpsCentavos: extras,
  };
}

/** O preço de um pedido, lido do que ficou gravado nele. */
export function precoDoPedido(pedido: {
  produto: string;
  desconto_percentual: number | null;
  /**
   * O que os ebooks marcados no checkout somaram, **como foi cobrado**.
   *
   * ── Por que é obrigatório, e não `?` ────────────────────────────────────
   *
   * Este campo decide receita, e quase toda consulta que chama esta função
   * seleciona colunas à mão. Opcional, ele seria esquecido num `SELECT` e o
   * relatório passaria a mostrar menos dinheiro do que entrou — sem erro,
   * sem aviso, sem ninguém notar.
   *
   * É a mesma lição de `DadosCriacao.descontoPercentual`, que nasceu opcional
   * e produziu um Pix cobrando o preço cheio num pedido com 20% de desconto.
   * Campo que mexe em dinheiro não tem valor padrão: `null` é uma resposta
   * (não houve bump), e o compilador obriga quem consulta a dá-la.
   *
   * Vale o valor GRAVADO, não o do catálogo hoje: o preço de um livro pode
   * mudar, e uma venda antiga continua valendo o que foi cobrado dela.
   */
  bumps_centavos: number | null;
}): PrecoComDesconto {
  /**
   * O preço VIGENTE, não o da tabela estática.
   *
   * `PRODUTOS.revelacao` está zerado porque o modelo novo a transformou na
   * porta de entrada. Enquanto o interruptor estiver desligado, ela custa o
   * que a campanha está vendendo — e ler `PRODUTOS` direto aqui foi
   * exatamente o que entregou duas leituras de graça em 21/08.
   */
  return precoComDesconto(
    { precoCentavos: precoVigenteCentavos(pedido.produto as ProdutoId) },
    pedido.desconto_percentual ?? 0,
    pedido.bumps_centavos ?? 0
  );
}

/**
 * Conta um uso. Chamado quando o pedido é pago, uma vez por pedido.
 *
 * O `WHERE` com o limite é o que impede o contador de passar do teto quando
 * duas confirmações chegam juntas — SQLite serializa a escrita, então a
 * segunda vê o valor já incrementado.
 */
export function registrarUsoDeCupom(codigo: string): void {
  db.prepare(
    `UPDATE cupons
        SET usos = usos + 1
      WHERE codigo = ?
        AND (usos_max IS NULL OR usos < usos_max)`
  ).run(normalizarCodigo(codigo));
}

export function criarCupom(p: {
  codigo: string;
  desconto_percentual: number;
  usos_max?: number | null;
  expira_em?: string | null;
  nota?: string | null;
}): { ok: true; codigo: string } | { ok: false; erro: string } {
  const codigo = normalizarCodigo(p.codigo);
  if (codigo.length < 3) {
    return { ok: false, erro: 'O código precisa de ao menos 3 letras ou números.' };
  }

  const pct = Math.round(p.desconto_percentual);
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
    return { ok: false, erro: 'O desconto tem que estar entre 1% e 100%.' };
  }

  try {
    db.prepare(
      `INSERT INTO cupons (codigo, desconto_percentual, usos_max, expira_em, nota, ativo, usos, criado_em)
       VALUES (@codigo, @desconto_percentual, @usos_max, @expira_em, @nota, 1, 0, @agora)`
    ).run({
      codigo,
      desconto_percentual: pct,
      usos_max: p.usos_max ?? null,
      expira_em: p.expira_em ?? null,
      nota: p.nota ?? null,
      agora: new Date().toISOString(),
    });
    return { ok: true, codigo };
  } catch {
    return { ok: false, erro: `O cupom ${codigo} já existe.` };
  }
}

export function listarCupons(): Cupom[] {
  return db
    .prepare('SELECT * FROM cupons ORDER BY criado_em DESC')
    .all() as Cupom[];
}

export function alternarCupom(codigo: string, ativo: boolean): void {
  db.prepare('UPDATE cupons SET ativo = ? WHERE codigo = ?').run(
    ativo ? 1 : 0,
    normalizarCodigo(codigo)
  );
}

/**
 * Quanto dinheiro este pedido trouxe de verdade.
 *
 * ── Por que não é `bruto ?? precoDoPedido` ────────────────────────────────
 *
 * Era, e o resultado foi receita inventada. Um pedido pode estar `entregue`
 * sem ter passado pelo gateway — cupom de 100%, amostra, ou a falha de 21/08
 * em que o preço zerado fez a entrega pular a cobrança. Nesses casos
 * `bruto_centavos` é nulo, e cair no preço de tabela transforma uma entrega
 * gratuita em R$ 9,80 de faturamento que nunca entrou.
 *
 * O que separa os dois casos é o `pagamento_id`: ele só existe quando houve
 * uma cobrança de verdade no gateway. Sem ele, a receita é zero — e o preço de
 * tabela só entra como recurso para pedidos ANTIGOS, de antes de `bruto_centavos`
 * existir, que têm o id do pagamento mas não o valor.
 *
 * Errar aqui é pior do que parece: este número alimenta o relatório por
 * campanha, e campanha com receita inflada é verba de anúncio empurrada para
 * o criativo errado.
 */
export function receitaDoPedido(pedido: {
  produto: string;
  desconto_percentual: number | null;
  /** Ver `precoDoPedido`: obrigatório porque decide dinheiro. */
  bumps_centavos: number | null;
  bruto_centavos?: number | null;
  pagamento_id?: string | null;
}): number {
  if (pedido.bruto_centavos !== null && pedido.bruto_centavos !== undefined) {
    return pedido.bruto_centavos;
  }
  if (!pedido.pagamento_id) return 0;
  return precoDoPedido(pedido).finalCentavos;
}
