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
  descontoPercentual = 0
): PrecoComDesconto {
  const pct = Math.max(0, Math.min(100, Math.round(descontoPercentual)));
  const cheio = produto.precoCentavos;
  // Arredonda para cima: 20% de R$ 9,80 dá R$ 7,84 e não R$ 7,83. Centavo a
  // menos no nosso bolso é irrelevante; centavo a mais é cobrança indevida.
  const final = Math.ceil(cheio * (1 - pct / 100));

  return {
    cheioCentavos: cheio,
    finalCentavos: final < PISO_COBRAVEL_CENTAVOS ? 0 : final,
    descontoPercentual: pct,
    gratis: final < PISO_COBRAVEL_CENTAVOS,
  };
}

/** O preço de um pedido, lido do que ficou gravado nele. */
export function precoDoPedido(pedido: {
  produto: string;
  desconto_percentual: number | null;
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
    pedido.desconto_percentual ?? 0
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
