/**
 * Prepara a conta da Cakto por API e preenche o `.env`.
 *
 *   npm run cakto-setup
 *
 * Você cola `CAKTO_CLIENT_ID` e `CAKTO_CLIENT_SECRET` no `.env`. O resto isto
 * resolve: cria o produto, cria o webhook, pega o segredo dele e escreve os
 * valores de volta no arquivo. Nada de abrir painel e copiar id na mão.
 *
 * É **idempotente**: rodar de novo reaproveita o produto e o webhook que já
 * existem em vez de criar duplicados. Pode rodar quantas vezes quiser.
 */
import { readFileSync, writeFileSync } from 'fs';
import { carregarEnv } from '../src/lib/carregar-env';

carregarEnv();

const BASE = 'https://api.cakto.com.br/public_api';

const NOME_DO_PRODUTO = 'Bruxário';
const NOME_DO_WEBHOOK = 'Bruxário — pagamentos';

/**
 * Os cinco que interessam. `pix_gerado` entra porque é ele que confirma que o
 * QR nasceu; sem ele, um Pix que falha ao ser gerado some sem deixar rastro.
 */
const EVENTOS = [
  'purchase_approved',
  'purchase_refused',
  'pix_gerado',
  'refund',
  'chargeback',
];

async function token(): Promise<string> {
  const client_id = process.env.CAKTO_CLIENT_ID;
  const client_secret = process.env.CAKTO_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    console.error(
      '\n  Falta preencher no .env:\n\n' +
        '    CAKTO_CLIENT_ID=\n    CAKTO_CLIENT_SECRET=\n\n' +
        '  Painel da Cakto → Integrações → Cakto API → Criar Chave de API.\n' +
        '  Escopos: read, write, payments, tokenização de cartão, orders.\n' +
        '  O client_secret aparece UMA vez, na hora da criação.\n'
    );
    process.exit(1);
  }

  const r = await fetch(`${BASE}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id, client_secret }),
  });
  if (!r.ok) throw new Error(`token recusado (${r.status}): ${await r.text()}`);
  return (await r.json()).access_token;
}

async function api(t: string, caminho: string, init: RequestInit = {}) {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const corpo = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${caminho} → ${r.status}: ${corpo}`);
  return corpo ? JSON.parse(corpo) : {};
}

/** Acha o produto pelo nome, ou cria. */
async function garantirProduto(t: string, paginaDeVendas: string): Promise<string> {
  const lista = await api(t, '/products/?limit=100');
  const achado = (lista.results ?? []).find(
    (p: { name?: string }) => p.name?.trim() === NOME_DO_PRODUTO
  );
  if (achado) {
    console.log(`  produto já existia: ${achado.name} (${achado.id})`);
    // Conserta o que uma rodada anterior possa ter gravado errado — a página
    // de vendas saía de BASE_URL, que em desenvolvimento é localhost.
    if (achado.salesPage !== paginaDeVendas) {
      await api(t, `/products/${achado.id}/`, {
        method: 'PUT',
        // PUT, não PATCH: a Cakto exige o recurso inteiro, então os campos
        // que não estamos mudando são reenviados como estão.
        body: JSON.stringify({
          name: achado.name,
          description: achado.description ?? NOME_DO_PRODUTO,
          price: String(achado.price ?? '16.00'),
          type: achado.type ?? 'unique',
          salesPage: paginaDeVendas,
        }),
      });
      console.log(`  página de vendas corrigida: ${achado.salesPage} → ${paginaDeVendas}`);
    }
    return achado.id;
  }

  const criado = await api(t, '/products/', {
    method: 'POST',
    body: JSON.stringify({
      name: NOME_DO_PRODUTO,
      description: 'Revelação do familiar — leitura personalizada em PDF.',
      // O preço do PRODUTO não é o que se cobra: quem cobra é a oferta, e as
      // ofertas o adaptador cria sozinho conforme o preço vigente.
      price: '16.00',
      type: 'unique',
      salesPage: paginaDeVendas,
    }),
  });
  console.log(`  produto criado: ${criado.name ?? NOME_DO_PRODUTO} (${criado.id})`);
  return criado.id;
}

/** Acha o webhook pela URL, ou cria. Devolve o segredo. */
async function garantirWebhook(t: string, produtoId: string, url: string): Promise<string> {
  const lista = await api(t, '/webhook/?limit=100');
  const achado = (lista.results ?? []).find((w: { url?: string }) => w.url === url);
  if (achado) {
    console.log(`  webhook já existia: ${achado.url} (${achado.id})`);
    return achado.fields?.secret ?? '';
  }

  const criado = await api(t, '/webhook/', {
    method: 'POST',
    body: JSON.stringify({
      name: NOME_DO_WEBHOOK,
      url,
      products: [produtoId],
      events: EVENTOS,
    }),
  });
  console.log(`  webhook criado: ${url} (${criado.id})`);
  return criado.fields?.secret ?? '';
}

/**
 * Escreve de volta no `.env`, preenchendo a chave que já está lá em vez de
 * acrescentar uma segunda linha com o mesmo nome — duas linhas iguais e a
 * última vence em silêncio, que é uma noite inteira perdida.
 */
function gravarNoEnv(valores: Record<string, string>) {
  let texto = readFileSync('.env', 'utf8');
  for (const [chave, valor] of Object.entries(valores)) {
    if (!valor) continue;
    const linha = `${chave}=${valor}`;
    const padrao = new RegExp(`^${chave}=.*$`, 'm');
    texto = padrao.test(texto) ? texto.replace(padrao, linha) : `${texto}\n${linha}`;
  }
  writeFileSync('.env', texto);
}

async function principal() {
  /**
   * A URL do webhook **não** sai de `BASE_URL`.
   *
   * Em desenvolvimento ela é `http://localhost:3000`, e a Cakto precisa de um
   * endereço público em HTTPS para alcançar a gente. Cadastrar localhost daria
   * um webhook que nunca entrega nada, sem erro nenhum na hora do cadastro.
   *
   * Então: o domínio de produção por padrão, ou o que vier no argumento —
   * a URL do túnel, quando for testar localmente.
   *
   *   npm run cakto-setup                          → bruxario.com.br
   *   npm run cakto-setup -- https://x.ngrok.app   → o túnel
   */
  const argumento = process.argv[2];
  const base = (argumento || 'https://bruxario.com.br').replace(/\/$/, '');

  if (!base.startsWith('https://')) {
    console.error(`\n  A Cakto exige HTTPS no webhook. "${base}" não serve.\n`);
    process.exit(1);
  }

  const urlDoWebhook = `${base}/api/webhook/cakto`;

  console.log('\n  Cakto — preparando a conta\n');

  const t = await token();
  console.log('  token ok');

  const produtoId = await garantirProduto(t, base);
  const segredo = await garantirWebhook(t, produtoId, urlDoWebhook);

  gravarNoEnv({
    CAKTO_PRODUTO_ID: produtoId,
    CAKTO_WEBHOOK_SECRET: segredo,
    NEXT_PUBLIC_CAKTO_CLIENT_ID: process.env.CAKTO_CLIENT_ID ?? '',
  });

  console.log('\n  .env preenchido:');
  console.log(`    CAKTO_PRODUTO_ID=${produtoId}`);
  console.log(`    CAKTO_WEBHOOK_SECRET=${segredo ? segredo.slice(0, 8) + '…' : '(vazio)'}`);
  console.log(`    NEXT_PUBLIC_CAKTO_CLIENT_ID=${process.env.CAKTO_CLIENT_ID}`);

  if (!segredo) {
    console.log(
      '\n  ⚠️  O webhook não devolveu segredo. Pegue em app.cakto.com.br/dashboard/apps\n' +
        '     e cole em CAKTO_WEBHOOK_SECRET.'
    );
  }

  console.log(`\n  Webhook apontando para: ${urlDoWebhook}`);
  console.log(`  Eventos: ${EVENTOS.join(', ')}`);
  console.log('\n  Falta só, no painel deles: o cupom de 20%.');
  console.log('  Nada trocou de gateway — GATEWAY continua em mercadopago.\n');
}

principal().catch((erro) => {
  console.error('\n  falhou:', erro.message, '\n');
  process.exit(1);
});
