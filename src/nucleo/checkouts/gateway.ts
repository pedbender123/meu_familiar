import { pagamento as mercadopago, type ProvedorPagamento } from './mercadopago';
import { ProvedorCakto, caktoConfigurada } from './cakto';
import { ProvedorWiven, wivenConfigurada, tokenDoWebhook } from './wiven';

/**
 * Quem cobra.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 *
 * A troca do Mercado Pago pela Cakto acontece com campanha no ar. Trocar por
 * deploy significaria que voltar atrás também é por deploy — e o momento em
 * que a gente vai querer voltar é justamente o pior momento para buildar,
 * copiar arquivo e reiniciar.
 *
 * Então é variável de ambiente: `GATEWAY=mercadopago` volta tudo como estava,
 * com um restart e nenhuma linha de código alterada. É a disciplina 3 do
 * projeto ("todo caminho novo nasce desligado") aplicada ao que mexe em
 * dinheiro, igual ao `modelo-de-venda`.
 *
 * ── Rota por meio de pagamento ────────────────────────────────────────────
 *
 * `GATEWAY_PIX` e `GATEWAY_CARTAO` sobrepõem o padrão para um meio só. Isso
 * não é firula: o Pix da Cakto é a parte simples (uma chamada REST), e o
 * cartão é a parte que depende do SDK deles, do antifraude e do 3DS no
 * navegador. Se o cartão der problema na virada, dá para mandar só ele de
 * volta ao Mercado Pago sem desistir do resto.
 */

export type NomeDoGateway = 'mercadopago' | 'cakto' | 'wiven';

/** Como o front nomeia o meio, já normalizado. */
export type MeioDePagamento = 'pix' | 'cartao' | 'boleto';

const caktoInstancia = new ProvedorCakto();
const wivenInstancia = new ProvedorWiven();

const NOMES: readonly NomeDoGateway[] = ['mercadopago', 'cakto', 'wiven'];

function normalizar(valor: string | undefined): NomeDoGateway | undefined {
  const limpo = valor?.trim().toLowerCase() as NomeDoGateway | undefined;
  return limpo && NOMES.includes(limpo) ? limpo : undefined;
}

/**
 * O padrão. **Mercado Pago quando não diz nada** — esquecer de configurar não
 * pode mandar dinheiro para um gateway que ninguém testou.
 */
export function gatewayPadrao(): NomeDoGateway {
  return normalizar(process.env.GATEWAY) ?? 'mercadopago';
}

/**
 * O gateway de um meio específico, considerando as sobreposições.
 *
 * A Cakto só é oferecida se houver credencial: pedir Cakto sem
 * `CAKTO_CLIENT_ID` cairia em erro na hora de cobrar, e o sintoma seria uma
 * venda perdida em vez de um aviso no log.
 */
export function gatewayDe(meio: MeioDePagamento): NomeDoGateway {
  const especifico =
    meio === 'pix'
      ? normalizar(process.env.GATEWAY_PIX)
      : meio === 'cartao'
        ? normalizar(process.env.GATEWAY_CARTAO)
        : undefined;

  const escolhido = especifico ?? gatewayPadrao();

  if (escolhido === 'cakto' && !caktoConfigurada()) {
    console.warn(
      `[gateway] ${meio} pedia Cakto, mas falta CAKTO_CLIENT_ID/SECRET — usando Mercado Pago.`
    );
    return 'mercadopago';
  }

  if (escolhido === 'wiven' && !wivenConfigurada()) {
    console.warn(
      `[gateway] ${meio} pedia Wiven, mas falta WIVEN_PUBLIC_KEY/SECRET — usando Mercado Pago.`
    );
    return 'mercadopago';
  }

  /**
   * **Sem token de webhook, a Wiven não cobra.**
   *
   * As chaves da API bastam para criar a cobrança — e é justamente por isso
   * que esta checagem existe. A rota `/api/webhook/wiven` recusa tudo quando
   * `WIVEN_WEBHOOK_TOKEN` está vazio; então uma Wiven só com as chaves da API
   * cobraria normalmente e **nunca entregaria**, porque só o webhook libera
   * acesso. Dinheiro na conta, cliente sem produto, e o log da rota de
   * webhook num arquivo que ninguém abre.
   *
   * Configuração pela metade tem que falhar na porta de entrada, não na porta
   * de saída.
   */
  if (escolhido === 'wiven' && !tokenDoWebhook()) {
    console.warn(
      `[gateway] ${meio} pedia Wiven, mas falta WIVEN_WEBHOOK_TOKEN — ` +
        'cobraria sem nunca entregar. Usando Mercado Pago.'
    );
    return 'mercadopago';
  }

  return escolhido;
}

export function provedorDe(nome: NomeDoGateway): ProvedorPagamento {
  if (nome === 'cakto') return caktoInstancia;
  if (nome === 'wiven') return wivenInstancia;
  return mercadopago;
}

/** O provedor que deve cobrar um meio, já resolvido. */
export function provedorPara(meio: MeioDePagamento): ProvedorPagamento {
  return provedorDe(gatewayDe(meio));
}

/**
 * De onde o front nomeia o meio para o nosso vocabulário.
 *
 * O Brick manda `payment_method_id` com a bandeira (`master`, `visa`) ou
 * `pix`; a Cakto manda `credit_card`/`threeDs`/`pix`; a Wiven manda
 * `CREDIT_CARD`/`PIX`/`BOLETO`. Todos desembocam aqui.
 */
export function meioDe(bruto: string | undefined): MeioDePagamento {
  const v = (bruto ?? '').toLowerCase();
  if (v === 'pix' || v === 'pix_auto') return 'pix';
  if (v === 'boleto' || v === 'bolbradesco') return 'boleto';
  return 'cartao';
}
