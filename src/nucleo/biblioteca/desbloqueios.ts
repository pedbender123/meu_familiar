import { randomUUID } from 'crypto';
import db from '../../lib/db';
import { EBOOKS, buscarEbook, ebookEntregavel, type Ebook } from './catalogo';
import { estadoDoDownload } from '../carencia';

/**
 * Quem pode abrir qual livro.
 *
 * ── Dois caminhos, e eles não se somam ────────────────────────────────────
 *
 * **Comprado** é permanente: entrou uma linha em `desbloqueios` e ela não sai
 * mais. **Incluído na assinatura** dura enquanto a assinatura durar.
 *
 * A distinção importa no dia do cancelamento. Quem assinou e leu os três não
 * comprou nenhum: ao cancelar, perde o acervo. Quem marcou o bump no checkout
 * pagou por aquele livro e fica com ele para sempre, assine ou não.
 *
 * Misturar os dois — dar linha de desbloqueio a assinante — pareceria mais
 * simples e seria um erro caro: o cancelamento não teria como retirar o
 * acesso, e a assinatura perderia a única coisa que ela oferece aqui.
 */

export type OrigemDoDesbloqueio = 'bump' | 'avulso' | 'assinatura' | 'cortesia';

export interface Desbloqueio {
  id: string;
  email: string;
  conta_id: string | null;
  ebook_id: string;
  origem: OrigemDoDesbloqueio;
  pedido_id: string | null;
  cobranca_id: string | null;
  preco_centavos: number;
  criado_em: string;
}

function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Registra a compra de um livro. **Idempotente.**
 *
 * O webhook do gateway reenvia até receber 200, e a segunda passagem não pode
 * criar um segundo direito nem contar a receita duas vezes. A trava é o índice
 * único `(email, ebook_id)`: a segunda tentativa colide, e colidir aqui
 * significa "ela já tem", que é o desfecho certo.
 *
 * Devolve `null` quando não criou nada — já tinha, ou o livro não existe.
 */
export function desbloquear(dados: {
  email: string;
  ebookId: string;
  origem: OrigemDoDesbloqueio;
  contaId?: string | null;
  pedidoId?: string | null;
  cobrancaId?: string | null;
  precoCentavos?: number;
  quando?: Date;
}): Desbloqueio | null {
  const email = normalizar(dados.email);
  if (!email) return null;

  const ebook = buscarEbook(dados.ebookId);
  if (!ebook) return null;

  const id = randomUUID();
  const agora = (dados.quando ?? new Date()).toISOString();

  try {
    db.prepare(
      `INSERT INTO desbloqueios
         (id, email, conta_id, ebook_id, origem, pedido_id, cobranca_id,
          preco_centavos, criado_em)
       VALUES (@id, @email, @conta, @ebook, @origem, @pedido, @cobranca, @preco, @agora)`
    ).run({
      id,
      email,
      conta: dados.contaId ?? null,
      ebook: ebook.id,
      origem: dados.origem,
      pedido: dados.pedidoId ?? null,
      cobranca: dados.cobrancaId ?? null,
      preco: dados.precoCentavos ?? 0,
      agora,
    });
  } catch {
    // Índice único: ela já tem este livro. Reenvio de webhook cai aqui.
    return null;
  }

  return db.prepare('SELECT * FROM desbloqueios WHERE id = ?').get(id) as Desbloqueio;
}

/** Os livros que esta pessoa COMPROU. Não inclui o que a assinatura libera. */
export function desbloqueiosDe(email: string): Desbloqueio[] {
  return db
    .prepare('SELECT * FROM desbloqueios WHERE email = ? ORDER BY criado_em')
    .all(normalizar(email)) as Desbloqueio[];
}

/**
 * Liga os desbloqueios a uma conta, quando ela finalmente existe.
 *
 * Quem comprou no bump não tinha conta: o direito nasceu preso ao e-mail. No
 * primeiro login a conta aparece, e ligá-la aqui deixa as consultas por conta
 * funcionarem sem precisar sempre voltar ao e-mail.
 *
 * O e-mail continua sendo a chave — isto é conveniência, não a fonte.
 */
export function ligarDesbloqueiosAConta(email: string, contaId: string): void {
  db.prepare(
    'UPDATE desbloqueios SET conta_id = ? WHERE email = ? AND conta_id IS NULL'
  ).run(contaId, normalizar(email));
}

export interface LivroNaEstante {
  ebook: Ebook;
  /** `false` = ainda à venda para esta pessoa. */
  liberado: boolean;
  /** Por que está liberado. `null` quando não está. */
  por: OrigemDoDesbloqueio | null;
}

/**
 * A estante de uma pessoa: todo o catálogo, com o que está aberto marcado.
 *
 * ── Por que devolve o catálogo inteiro, e não só o que ela tem ────────────
 *
 * Porque a estante é uma vitrine. Uma tela que mostra só os livros comprados
 * está completa no dia da compra e vazia antes dela — e o que não aparece não
 * vende. Mostrar os três, com dois fechados, é o que transforma a biblioteca
 * de recibo em oferta.
 *
 * ── `assinaturaAtiva` vem de fora ─────────────────────────────────────────
 *
 * Este módulo não sabe consultar assinatura, e não deveria: quem sabe se
 * alguém está ativo é `assinaturasAtivasDaConta`, que tem as suas próprias
 * regras de data. Receber a resposta pronta mantém a decisão num lugar só.
 */
export function estanteDe(
  email: string,
  assinaturaAtiva = false
): LivroNaEstante[] {
  const comprados = new Map(desbloqueiosDe(email).map((d) => [d.ebook_id, d]));

  return EBOOKS.filter(ebookEntregavel)
    .sort((a, b) => a.ordem - b.ordem)
    .map((ebook) => {
      const comprado = comprados.get(ebook.id);
      if (comprado) return { ebook, liberado: true, por: comprado.origem };
      /*
        A assinatura abre, mas não vira linha de desbloqueio: ela abre
        ENQUANTO durar. Gravar aqui daria um direito permanente a quem paga
        por mês, e o cancelamento não teria como retirá-lo.
      */
      if (assinaturaAtiva) return { ebook, liberado: true, por: 'assinatura' as const };
      return { ebook, liberado: false, por: null };
    });
}

/** A pergunta que a rota de download faz antes de servir o arquivo. */
export function podeAbrir(
  email: string,
  ebookId: string,
  assinaturaAtiva = false
): boolean {
  const ebook = buscarEbook(ebookId);
  if (!ebook || !ebookEntregavel(ebook)) return false;
  if (assinaturaAtiva) return true;
  return desbloqueiosDe(email).some((d) => d.ebook_id === ebookId);
}

/**
 * O livro pode ser BAIXADO?
 *
 * ── Ler não é levar embora ────────────────────────────────────────────────
 *
 * `podeAbrir` responde sobre leitura, e a assinatura abre tudo. Aqui a
 * pergunta é outra: o arquivo sai daqui e fica com a pessoa para sempre,
 * independente do que ela faça depois. Isso é de quem **comprou o livro**.
 *
 * Assinante não baixa — ele lê enquanto assina, e é justamente esse "enquanto"
 * que a assinatura vende. Cortesia também não: ninguém pagou por ela.
 *
 * ── E mesmo quem comprou espera sete dias ─────────────────────────────────
 *
 * O prazo de arrependimento do CDC. Ver `nucleo/carencia.ts` para o porquê —
 * o resumo é que baixar no primeiro minuto e pedir estorno no segundo é uma
 * porta que não precisa ficar aberta, e que a espera transforma o arquivo de
 * saída em lembrança.
 */
export interface DownloadDoLivro {
  liberado: boolean;
  diasQueFaltam: number;
  /** `false` quando o direito não é de compra (assinatura, cortesia, nada). */
  comprado: boolean;
}

/** As origens que são compra de verdade — as que geram direito ao arquivo. */
const ORIGENS_DE_COMPRA: OrigemDoDesbloqueio[] = ['bump', 'avulso'];

export function downloadDoLivro(
  email: string,
  ebookId: string,
  agora?: Date
): DownloadDoLivro {
  const fechado = { liberado: false, diasQueFaltam: 0, comprado: false };

  const ebook = buscarEbook(ebookId);
  if (!ebook || !ebookEntregavel(ebook)) return fechado;

  const compra = desbloqueiosDe(email).find(
    (d) => d.ebook_id === ebookId && ORIGENS_DE_COMPRA.includes(d.origem)
  );
  if (!compra) return fechado;

  const estado = estadoDoDownload(compra.criado_em, agora);
  return {
    liberado: estado.liberado,
    diasQueFaltam: estado.diasQueFaltam,
    comprado: true,
  };
}
