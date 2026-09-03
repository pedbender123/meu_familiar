import { criarTokenMagico, garantirConta, VALIDADE_DO_LINK_MIN } from './autenticacao';
import { enviarContaCriada } from './email';
import db, { registrarEvento, atualizarPedido } from './db';
import { criarAssinatura } from '../nucleo/assinaturas';
import { assinaturasAtivasDaConta } from '../nucleo/assinaturas';

/**
 * Entregar a chave da plataforma — a conta, o link de entrada e o e-mail.
 *
 * ── Por que virou uma função só ───────────────────────────────────────────
 *
 * Desde 19/08 existem **dois momentos** em que esse e-mail sai, e eles são
 * opostos: quem compra recebe na hora do pagamento; quem não compra recebe
 * horas depois, pelo cron. Escrever a mesma sequência (garantir conta, criar
 * token, montar URL, enviar, registrar) nos dois lugares é como um dos dois
 * para de criar a assinatura gratuita — e a pessoa entra numa casa de cômodos
 * trancados sem ninguém entender por quê.
 *
 * ── A assinatura gratuita vem junto ───────────────────────────────────────
 *
 * É ela que liga a tiragem do dia, o calendário e a primeira leitura. Quem já
 * tem assinatura ativa não recebe outra: refazer o ritual não pode rebaixar
 * quem paga, e o webhook repete.
 */
export async function entregarChaveDaPlataforma(dados: {
  email: string;
  nome: string;
  /** Marca o pedido de origem, quando houver — é o que liga assinatura a ritual. */
  pedidoId?: string;
  nomeFamiliar?: string;
  nomeSecreto?: string;
  /**
   * `false` para quem já era cliente: muda o texto do e-mail e mantém o
   * marcador `lg` na URL, que impede uma volta de contar como aquisição.
   */
  contaNova: boolean;
  /** Carimba `acesso_gratis_em` no pedido. Só o caminho gratuito faz isso. */
  carimbarComoGratis?: boolean;
}): Promise<boolean> {
  const email = dados.email?.trim();
  if (!email) return false;

  try {
    const conta = garantirConta(email);
    const token = criarTokenMagico(email, 'conta');
    const base = process.env.BASE_URL || 'http://localhost:3000';

    await enviarContaCriada({
      nome: dados.nome,
      email,
      /**
       * O link abre **no familiar**, e não na porta da casa.
       *
       * Ele caía em `/conta`, e de lá a pessoa tinha que descobrir sozinha
       * onde estava a coisa que ela veio ver. Um clique a mais entre o e-mail
       * e o produto é um clique onde metade das pessoas some — e é o pior
       * lugar possível para perdê-las, porque é o primeiro contato delas com a
       * plataforma inteira.
       *
       * O destino passa pela lista fixa de `/entrar/verificar`: nada que venha
       * de URL vira redirecionamento sem estar declarado lá.
       */
      url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg&destino=${encodeURIComponent('/conta/familiar')}`,
      minutosDeValidade: VALIDADE_DO_LINK_MIN,
      contaNova: dados.contaNova,
      // O familiar vai no e-mail como NOTÍCIA, não como entrega: é o que faz
      // a pessoa clicar. O que ela vem buscar está dentro.
      nomeFamiliar: dados.nomeFamiliar,
      nomeSecreto: dados.nomeSecreto,
      // A arte do familiar ilustra o e-mail. É o que é gratuito de verdade
      // aqui, e é o que faz a pessoa abrir.
      pedidoId: dados.pedidoId,
    });

    registrarEvento(
      dados.contaNova ? 'conta_criada' : 'conta_acesso_enviado',
      dados.pedidoId
    );

    try {
      if (assinaturasAtivasDaConta(conta.id).length === 0) {
        criarAssinatura({
          contaId: conta.id,
          planoId: 'gratuito',
          pedidoId: dados.pedidoId,
          inicio: new Date(),
        });
      }
    } catch (erroAssinatura) {
      // Nunca pode derrubar a entrega da chave: sem e-mail a pessoa não entra
      // de jeito nenhum; sem assinatura ela entra e vê menos.
      console.error('[chave] assinatura gratuita falhou:', erroAssinatura);
    }

    if (dados.carimbarComoGratis && dados.pedidoId) {
      atualizarPedido(dados.pedidoId, {
        acesso_gratis_em: new Date().toISOString(),
      });
    }

    return true;
  } catch (erro) {
    console.error('[chave] falhou para', email, erro);
    registrarEvento('conta_falhou', dados.pedidoId);
    return false;
  }
}

/**
 * O nome de tratamento de quem tem só o e-mail em mãos.
 *
 * O caminho do pagamento conhece a cobrança, não o pedido — e a cobrança
 * guarda e-mail, não nome. Pegar o nome do último pedido daquele endereço é o
 * que faz o e-mail dizer "Helena" em vez de "olá". Quando não houver pedido
 * nenhum, um cumprimento sem nome é melhor do que um nome errado.
 */
/**
 * Nome e CPF de quem já comprou aqui, para pré-preencher o checkout do plano.
 *
 * A `cobranca` guarda só e-mail, e a Wiven exige pagador identificado — nome
 * e documento. Quem está vendo uma oferta de assinatura já comprou antes, e o
 * último pedido dela tem os dois; pedir de novo o que já foi digitado é
 * atrito no lugar mais caro do funil.
 *
 * Devolve `null` em cada campo que não existir: o checkout pede o que faltar.
 * Nunca chuta — documento errado faz o gateway recusar a cobrança inteira.
 */
export function pagadorDaConta(email: string): { nome: string | null; cpf: string | null } {
  const linha = db
    .prepare(
      `SELECT nome, cpf FROM pedidos WHERE lower(email) = ?
        ORDER BY criado_em DESC LIMIT 1`
    )
    .get(email.trim().toLowerCase()) as { nome: string | null; cpf: string | null } | undefined;

  return {
    nome: linha?.nome?.trim() || null,
    cpf: linha?.cpf?.trim() || null,
  };
}

export function nomeDaConta(email: string): string {
  const linha = db
    .prepare(
      `SELECT nome FROM pedidos WHERE lower(email) = ? AND nome IS NOT NULL
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get(email.trim().toLowerCase()) as { nome: string } | undefined;
  return linha?.nome?.trim() || '';
}
