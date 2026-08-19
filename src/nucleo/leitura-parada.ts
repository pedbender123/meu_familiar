import db from '../lib/db';
import { estadoDaCota } from './consumo';
import { assinaturasAtivasDaConta } from './assinaturas';
import { buscarPlano } from './planos';

/**
 * Quem tem leitura gratuita parada e ainda não conhece o Oráculo.
 *
 * ── Por que esta seleção mora aqui, e não dentro do script ────────────────
 *
 * São cinco filtros, e cada um deles é uma decisão sobre para quem NÃO
 * mandar. Errar qualquer um manda e-mail para quem não deveria receber — e
 * remarketing para a pessoa errada não é ineficiente, é o começo de uma
 * reputação de spam que derruba junto os e-mails que as pessoas esperam.
 *
 * Num script, isso só seria verificável rodando em produção e olhando a
 * caixa de entrada de alguém. Aqui é testável com dados de mentira.
 */

/** Quanto tempo depois de entrar. Antes disso a pessoa ainda está no calor
 *  da revelação e provavelmente usa sozinha — e-mail aí é atropelo. */
export const DIAS_DE_ESPERA = 3;

export interface LeituraParada {
  contaId: string;
  email: string;
  nome: string;
  familiar: string | null;
  quantas: number;
}

/** `true` se tem alguma assinatura ativa que custou dinheiro. */
export function ehPagante(contaId: string, agora = new Date()): boolean {
  return assinaturasAtivasDaConta(contaId, agora).some((a) => {
    const plano = buscarPlano(a.plano_id);
    return !!plano && plano.preco_centavos > 0;
  });
}

/**
 * Os cinco filtros, na ordem em que descartam mais gente primeiro.
 *
 *  1. entrou há `DIAS_DE_ESPERA` dias ou mais
 *  2. entrou depois do corte (`desde`) — sem isso a primeira execução em
 *     produção varre a base histórica inteira de uma vez
 *  3. nunca fez leitura nenhuma
 *  4. não assina plano pago
 *  5. ainda tem leitura sobrando no MÊS (não no dia — ver a nota abaixo)
 *
 * Os três primeiros são SQL porque descartam em massa; os dois últimos são
 * por linha porque dependem de direitos efetivos, que é código.
 */
export function leiturasParadas(opcoes: {
  desde: string;
  agora?: Date;
}): LeituraParada[] {
  const agora = opcoes.agora ?? new Date();
  const limite = new Date(agora.getTime() - DIAS_DE_ESPERA * 86_400_000).toISOString();

  const linhas = db
    .prepare(
      `SELECT c.id, c.email,
              COALESCE(p.nome, '') AS nome,
              p.familiar AS familiar
         FROM contas c
         LEFT JOIN pedidos p ON p.id = (
              SELECT p2.id FROM pedidos p2
               WHERE lower(p2.email) = lower(c.email) AND p2.status = 'entregue'
               ORDER BY p2.criado_em DESC LIMIT 1
         )
        WHERE c.criado_em <= @limite
          AND c.criado_em >= @desde
          AND c.email IS NOT NULL AND c.email <> ''
          AND NOT EXISTS (SELECT 1 FROM leituras l WHERE l.conta_id = c.id)
        ORDER BY c.criado_em`
    )
    .all({ limite, desde: opcoes.desde }) as {
    id: string;
    email: string;
    nome: string;
    familiar: string | null;
  }[];

  const paradas: LeituraParada[] = [];

  for (const linha of linhas) {
    // Quem paga não precisa ser convencido a usar o que comprou — e receber
    // "resgate sua leitura gratuita" depois de pagar é a mensagem errada.
    if (ehPagante(linha.id, agora)) continue;

    /**
     * O que conta aqui é o restante do MÊS, não o `disponivel`.
     *
     * `disponivel` é o menor entre o teto do dia e o do mês — é o número certo
     * para a TELA, que precisa dizer o que a pessoa consegue fazer agora. Este
     * e-mail fala de outra coisa: da leitura que vai se perder na virada do
     * mês. O teto diário não reduz o que está esperando, só espalha o uso.
     *
     * Usar `disponivel` deixava de fora quem tivesse gastado a leitura de hoje
     * e ainda tivesse mês pela frente — e como o teto diário da leitura é 1,
     * isso era quase todo mundo que tem cota mensal maior que um.
     */
    const cota = estadoDaCota(linha.id, linha.email, 'leitura', agora);
    if (cota.restanteNoMes <= 0) continue;

    paradas.push({
      contaId: linha.id,
      email: linha.email,
      nome: linha.nome,
      familiar: linha.familiar,
      quantas: cota.restanteNoMes,
    });
  }

  return paradas;
}
