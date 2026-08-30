import type { NomeDoGateway } from './nomes';

/**
 * Qual gateway está de pé, agora.
 *
 * ── O dia que criou isto ──────────────────────────────────────────────────
 *
 * 24/08: a Wiven passou a responder 403 com uma página de desafio do
 * Cloudflare, de todos os IPs, inclusive o que estava na lista de
 * autorizados dela. O checkout inteiro teria parado — sem erro legível, com
 * um HTML que código nenhum nosso sabe interpretar — e ninguém saberia até
 * alguém reclamar que não consegue pagar.
 *
 * ── Por que um disjuntor, e não "tenta de novo" ───────────────────────────
 *
 * Tentar outro gateway NO MEIO da cobrança tem um problema que não se
 * resolve: quando a chamada estoura o tempo, não dá para saber se a cobrança
 * foi criada do outro lado. Cair para o Mercado Pago nesse caso pode cobrar
 * a mesma pessoa duas vezes.
 *
 * Um disjuntor evita a situação em vez de remediar: a primeira falha
 * derruba a chave, e **a tela seguinte já nasce no Mercado Pago** — Pix e
 * cartão, sem meia-cobrança, sem cobrança dupla.
 *
 * ── Por que na memória, e não no banco ────────────────────────────────────
 *
 * O estado é do processo e vale minutos. Gravar em disco criaria a pergunta
 * "quem apaga isso?" e o modo de falha em que um `pm2 restart` não devolve o
 * gateway porque a linha ficou lá. Reiniciar zera, que é o comportamento
 * desejado: quem reinicia quer tentar de novo.
 */

/** Quanto tempo um gateway fica de fora depois de falhar. */
export const QUARENTENA_MS = 5 * 60 * 1000;

const caidoAte = new Map<NomeDoGateway, number>();

/**
 * O que a última medição viu, por gateway.
 *
 * O disjuntor sozinho responde "posso cobrar agora?", que é o suficiente para
 * ROTEAR e insuficiente para MOSTRAR. Passada a quarentena, `caidoAte` se
 * apaga e o gateway volta a parecer intocado — some o fato de que ele caiu às
 * 3h da manhã e voltou sozinho. Este mapa guarda esse fato.
 *
 * `ok: false` sem quarentena ativa é exatamente o caso que importa: já
 * voltou, mas houve queda — e é isso que a tela de saúde precisa dizer para
 * alguém desconfiar antes da próxima.
 */
interface Medicao {
  ok: boolean;
  /** Vazio quando `ok`. Frase curta e legível, nunca um stack. */
  motivo: string;
  em: number;
}

const ultimaMedicao = new Map<NomeDoGateway, Medicao>();

/**
 * Marca o gateway como fora do ar.
 *
 * Chamado só para falha de INFRAESTRUTURA — 401, 403, 429, 5xx, rede caindo.
 * Cartão recusado não entra aqui: recusa é resposta, não indisponibilidade, e
 * derrubar o gateway porque alguém digitou o cartão errado tiraria do ar um
 * serviço que está funcionando perfeitamente.
 */
export function marcarIndisponivel(nome: NomeDoGateway, motivo: string): void {
  caidoAte.set(nome, Date.now() + QUARENTENA_MS);
  ultimaMedicao.set(nome, { ok: false, motivo, em: Date.now() });
  console.error(
    `[saude] ${nome} fora por ${QUARENTENA_MS / 60000} min — ${motivo}. ` +
      'As cobranças vão para o gateway padrão.'
  );
}

/**
 * A medição passou. Só a sonda chama: uma cobrança que deu certo prova menos
 * do que parece — ela pode ter ido para o gateway de queda, não para este.
 */
export function marcarDisponivel(nome: NomeDoGateway): void {
  ultimaMedicao.set(nome, { ok: true, motivo: '', em: Date.now() });
}

/**
 * A última medição, ou `null` se ninguém mediu desde que o processo subiu.
 *
 * `null` não é "está bem" nem "está mal" — é falta de dado, e a tela de saúde
 * tem um estado próprio para isso. Pintar de verde o que não foi medido é a
 * forma mais rápida de tornar um painel de saúde inútil.
 */
export function ultimaMedicaoDe(nome: NomeDoGateway): Medicao | null {
  return ultimaMedicao.get(nome) ?? null;
}

export function estaDisponivel(nome: NomeDoGateway, agora = Date.now()): boolean {
  const ate = caidoAte.get(nome);
  if (ate === undefined) return true;
  if (agora >= ate) {
    // A quarentena venceu: a próxima cobrança testa de novo, de verdade.
    caidoAte.delete(nome);
    return true;
  }
  return false;
}

/** Para o painel e os testes. Segundos que faltam, ou `null` se está de pé. */
export function segundosAteVoltar(nome: NomeDoGateway, agora = Date.now()): number | null {
  const ate = caidoAte.get(nome);
  if (ate === undefined || agora >= ate) return null;
  return Math.ceil((ate - agora) / 1000);
}

/** Só para os testes: devolve tudo ao estado inicial. */
export function limparSaude(): void {
  caidoAte.clear();
  ultimaMedicao.clear();
}

/**
 * A falha merece derrubar o gateway?
 *
 * `true` para o que indica "o serviço não está atendendo", `false` para o que
 * indica "o serviço atendeu e disse não".
 */
export function ehIndisponibilidade(status: number): boolean {
  // 402 é recusa de pagamento, e 400/404/422 são erro nosso de requisição —
  // trocar de gateway não conserta corpo malformado.
  if (status === 401 || status === 403 || status === 429) return true;
  return status >= 500;
}
