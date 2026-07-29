export interface DadosCobranca {
  pedidoId: string;
  valorCentavos: number;
}

export interface Cobranca {
  url: string;
  idExterno: string;
}

export interface ProvedorPagamento {
  criarCobranca(dados: DadosCobranca): Promise<Cobranca>;
}

const ASAAS_BASE_URL =
  process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';

/**
 * Implementação real via Asaas (REST direto, sem SDK). Usa o Checkout
 * hospedado (/v3/checkouts): não pré-cadastramos cliente nem CPF — a própria
 * página do Asaas coleta nome, CPF e forma de pagamento (cartão ou Pix),
 * evitando pedir os mesmos dados duas vezes. Usada quando ASAAS_API_KEY está
 * configurada.
 */
class ProvedorAsaas implements ProvedorPagamento {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // A API da Asaas às vezes engasga numa conexão isolada — em vez de deixar
  // uma única tentativa lenta (até 40s) derrubar a compra, tentamos algumas
  // vezes com timeout curto por tentativa antes de desistir de verdade.
  private async chamar(caminho: string, body: object) {
    const tentativas = 3;
    const timeoutMs = 6000;
    let ultimoErro: unknown;

    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      const controle = new AbortController();
      const timeout = setTimeout(() => controle.abort(), timeoutMs);
      try {
        const resposta = await fetch(`${ASAAS_BASE_URL}${caminho}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: this.apiKey,
          },
          body: JSON.stringify(body),
          signal: controle.signal,
        });
        clearTimeout(timeout);

        if (!resposta.ok) {
          const texto = await resposta.text();
          // erro de negócio (ex.: dados inválidos) — não adianta tentar de novo
          throw new Error(`Asaas ${caminho} falhou (${resposta.status}): ${texto}`);
        }
        return await resposta.json();
      } catch (erro) {
        clearTimeout(timeout);
        ultimoErro = erro;
        const eraTimeoutOuRede =
          erro instanceof Error &&
          (erro.name === 'AbortError' || erro.message.includes('fetch failed'));
        if (!eraTimeoutOuRede || tentativa === tentativas) throw erro;
        await new Promise((r) => setTimeout(r, 500 * tentativa));
      }
    }
    throw ultimoErro;
  }

  async criarCobranca(dados: DadosCobranca): Promise<Cobranca> {
    const base = process.env.BASE_URL || 'http://localhost:3000';
    const checkout = await this.chamar('/checkouts', {
      // DEBIT_CARD não é aceito pelo endpoint de Checkout hospedado da Asaas
      // (só existe na API de cobrança avulsa /payments) — confirmado em
      // teste direto contra a API de produção. O cartão de crédito no
      // Checkout já cobre boa parte dos casos de débito na prática.
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      minutesToExpire: 120,
      externalReference: dados.pedidoId,
      callback: {
        successUrl: `${base}/obrigado/${dados.pedidoId}`,
        cancelUrl: `${base}/pagamento/${dados.pedidoId}`,
        expiredUrl: `${base}/pagamento/${dados.pedidoId}`,
        // sem isso a Asaas só mostra um botão "Ir para o site" em vez de
        // redirecionar sozinha — funciona pra cartão, débito e Pix (os três
        // meios que confirmam pagamento na hora)
        autoRedirect: true,
      },
      items: [
        {
          name: 'Familiar — Bruxário', // máx. 30 caracteres exigido pela Asaas
          description: 'Leitura personalizada + artes do seu familiar de bruxa',
          quantity: 1,
          value: dados.valorCentavos / 100,
        },
      ],
    });

    // checkout.id é a "checkoutSession" — é ESSE campo (não o payment.id) que
    // vem no webhook em payment.checkoutSession, então é o que usamos pra
    // casar o pedido de volta (ver app/api/webhook/route.ts).
    return { url: checkout.link ?? checkout.url, idExterno: checkout.id };
  }
}

/**
 * Provedor de demonstração: sem gateway configurado, gera uma página local
 * de "pagamento" que o próprio dono confirma com um clique (finge que pagou).
 * Mantém a mesma interface para trocar pelo Asaas sem tocar no resto do fluxo.
 */
class ProvedorFake implements ProvedorPagamento {
  async criarCobranca(dados: DadosCobranca): Promise<Cobranca> {
    const idExterno = `fake_${dados.pedidoId}`;
    return { url: '', idExterno };
  }
}

function obterProvedor(): ProvedorPagamento {
  const apiKey = process.env.ASAAS_API_KEY;
  if (apiKey) return new ProvedorAsaas(apiKey);
  return new ProvedorFake();
}

// Reavalia a cada chamada (em vez de um singleton fixado na primeira
// importação) para que trocar a ASAAS_API_KEY no .env passe a valer sem
// precisar derrubar o processo.
export const pagamento: ProvedorPagamento = {
  criarCobranca: (dados) => obterProvedor().criarCobranca(dados),
};

export function pagamentoEhFake(): boolean {
  return !process.env.ASAAS_API_KEY;
}
