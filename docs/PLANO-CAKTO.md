# Cakto + Utmify — o plano de execução

Escrito em 22/08/2026, a partir da **documentação real da Cakto**
(`docs.cakto.com.br/schema.yaml`, 266 KB de OpenAPI, mais as páginas do SDK),
não do resumo do `HANDOFF-CAKTO.md`. Onde os dois discordam, vale este.

---

## Parte 0 — O que o HANDOFF errou

Quatro pontos, e três deles mudam o desenho.

### 1. `metadata` não guarda o nosso `pedidoId`

O handoff diz `metadata: { pedidoId: "..." }`. **Não existe.** O objeto
`metadata` tem exatamente seis campos, todos de tracking:

```
utm_source  utm_medium  utm_campaign  utm_term  utm_content  sck
```

Campo livre, nenhum. Isso é grave porque o Mercado Pago tinha
`external_reference`, e é por ele que o webhook reencontra o pedido quando a
notificação chega antes de a resposta síncrona ter sido gravada.

**A saída é o `sck`.** Ele aceita 255 caracteres, é opaco para a Cakto, e —
confirmado no schema do pedido — **volta no `GET /public_api/orders/{id}/`**.
Então `sck` vira o nosso `external_reference`, e os cinco UTMs vão preenchidos
de verdade, o que dá de brinde a atribuição dentro do painel deles.

O corpo do webhook **não** traz `sck`. Traz `data.id`. Como a nossa regra já é
"nunca confiar no corpo, sempre consultar a API", o `sck` chega na consulta —
que é exatamente onde a gente precisa dele.

### 2. `coupon` é código cadastrado lá, não valor livre

O campo existe (`coupon`, string, 255), mas é **o código de um cupom
cadastrado na Cakto**. Não dá para mandar "20%" nem "menos R$ 2,00".

O preço vem inteiramente do `offerId`. Só que — e isso o handoff não sabia —
**oferta se cria por API**, com `price` livre:

```
POST /public_api/offers/   { name, price, product, status: "active" }
```

Então existem três caminhos para o cupom, e a decisão é sua:

| Caminho | Como fica | Custo |
| --- | --- | --- |
| **A. Cupom desligado na virada** | Nenhum cupom aceito enquanto a Cakto estabiliza | Zero trabalho. Perde os cupons por alguns dias |
| **B. Recadastrar os cupons na Cakto** | O desconto passa a morar lá; a gente só repassa o código | Você recadastra à mão. A regra de cupom sai do nosso banco |
| **C. Uma oferta por preço** | `precoComDesconto` calcula, a gente acha (ou cria) a oferta daquele valor | Mais código nosso. Mantém a regra aqui, funciona com qualquer desconto |

Minha recomendação: **A agora, C depois.** Cupom não é o que está escalando a
campanha, e é a peça mais fácil de segurar sem perder venda.

### 3. Não existe sandbox

Procurei "sandbox", "homologação" e "ambiente de teste" nos 266 KB de spec e
em todas as páginas do SDK: **zero ocorrências.** A Cakto tem um ambiente só.

Consequência prática: o teste de ponta a ponta é **cobrança real**. Por isso o
plano abaixo cria uma **oferta de R$ 1,00 desativada da campanha**, só para a
gente comprar de si mesmo e conferir o caminho inteiro.

### 4. Cartão pede muito mais do comprador do que o Brick pedia

Este é o ponto que mexe com conversão, e por isso é o mais importante para
quem vai escalar anúncio amanhã.

`customer` tem quatro campos **obrigatórios** — `name`, `email`, `phone`
(E.164), `fingerprint` — e mais dois que a própria doc marca como "não
obrigatório, obrigatório na prática": `docType` e `docNumber` (CPF).

Hoje o nosso funil cobra com muito menos. **Telefone e CPF são campos novos na
tela de pagamento**, num ticket de R$ 9,80. Isso derruba conversão — não tem
como não derrubar. Não é motivo para não fazer, é motivo para **medir antes e
depois**, e é mais um argumento para o Pix ser o caminho principal.

---

## Parte 1 — Como a API deles funciona, e o que muda

### O desenho, em uma frase

O Mercado Pago cobrava **um valor que a gente mandava**. A Cakto cobra **uma
oferta que existe na conta dela**. O preço deixa de ser um parâmetro e vira um
cadastro.

### Autenticação

```
POST https://api.cakto.com.br/public_api/token/
Content-Type: application/x-www-form-urlencoded
client_id=...&client_secret=...
```

Devolve `access_token` (JWT) e `expires_in`. **Não há endpoint de refresh** —
expirou, pede outro. O adaptador guarda em memória e renova antes de vencer.
Pedir token a cada cobrança queima o rate limit à toa.

### Criar cobrança

`POST /public_api/payments/`, com `X-Idempotency-Key` **obrigatório** (até 255
chars, retenção de 24h, e reusar a chave com corpo diferente dá `409`).

```jsonc
{
  "paymentMethod": "pix" | "credit_card" | "threeDs" | "boleto" | "pix_auto",
  "customer": {
    "name": "...", "email": "...", "phone": "5511999999999",
    "fingerprint": "...",              // do SDK, no navegador
    "docType": "cpf", "docNumber": "..."
  },
  "items": [{ "offerId": "77BcHrY", "quantity": 1, "offerType": "main" }],
  "card": { "token": "..." },          // cartão: token de 15 min, uso único
  "threeDSecure": { "cavv", "eci", "xid", "referenceId", "version" },
  "antifraudProfilingAttemptReference": "...",   // do SDK. Obrigatório no cartão
  "coupon": "CODIGO",
  "metadata": { "utm_source": "...", "sck": "<nosso pedidoId>" },
  "pixExpiresIn": 3600
}
```

`items` aceita **exatamente um** item, e `offerType` só aceita `main`.

Resposta `201`: `id`, `refId`, `status`, `amount`, `baseAmount`, `discount`,
`fees`, `externalId`, `checkoutUrl`, `product`, `offer`, e em Pix
`pix.qrCode` / `pix.qrCodeBase64` / `pix.expirationDate`.

> Uma incerteza honesta: o `schema.yaml` lista o enum de `paymentMethod` como
> `[pix, pix_auto, boleto]` — **sem cartão**. Mas as páginas dedicadas
> documentam `credit_card` e `threeDs` em detalhe, com exemplos completos. O
> schema está atrasado em relação à doc. Vamos descobrir na primeira chamada
> real; se o cartão for recusado por enum, o Pix segue de pé sozinho.

### Status

| Meio | Nasce | Vira |
| --- | --- | --- |
| Pix | `waiting_payment` | `paid` quando pagam |
| Cartão | `paid`, `declined` (banco recusou) ou `refused` (falha técnica) | — |

O pedido completo (`GET /public_api/orders/{id}/`) traz o que o painel
financeiro precisa: `amount`, `baseAmount`, `discount`, **`fees`**, `paidAt`,
`installments`, `couponCode`, `refundedAt`, `chargedbackAt`, e os UTMs + `sck`.

Note que a resposta da **criação** do cartão não traz `fees`. O líquido só
existe no pedido. Como a Utmify quer receita **líquida**, quem alimenta ela é
a consulta ao pedido, não a resposta da cobrança.

### Webhook

Sem HMAC, sem header assinado. A validação é o campo `secret` **dentro do
corpo**, comparado em tempo constante. HTTPS obrigatório.

Responder `2xx` em **8 segundos**. Retentativas: 5s, 1min, 2min30, 6min, 30min
— cinco no total. Dedup por `data.id`.

Nosso handler já responde rápido e gera em segundo plano. Isso não muda.

### Rate limit

60 req/min por IP de origem, 120 req/min por token de acesso.

### Estorno

`POST /public_api/orders/{id}/refund/`. Integral, sem parcial. Devolve
`{ detail }` com mensagem em português ("Pedido já reembolsado", "Não é
possível reembolsar uma ordem que não está paga"). Encaixa direto no nosso
`estornar`, que já devolve `{ ok, erro }` em vez de lançar.

### Reconciliação — o ponto chato

`GET /public_api/orders/` aceita **só `limit` e `page`**. Não tem filtro por
data. Então `listarPagosNoPeriodo` deixa de ser uma busca e vira paginação:
percorre da página 1 até achar `paidAt` mais antigo que a janela e para.
Funciona, gasta mais chamadas, e o rate limit de 120/min é folgado para isso.

### Quadro comparativo

| | Mercado Pago | Cakto |
| --- | --- | --- |
| Preço | parâmetro (`transaction_amount`) | cadastro (`offerId`) |
| Nossa referência | `external_reference` | `metadata.sck` |
| Idempotência | opcional (SDK) | **header obrigatório** |
| Webhook | HMAC no header | `secret` no corpo |
| Front do cartão | Payment Brick (form pronto) | SDK cru: token + antifraude + 3DS, **form nosso** |
| Campos do comprador | e-mail | nome, e-mail, telefone, CPF, fingerprint |
| Taxa por venda | `fee_details` na hora | só no `GET /orders/{id}` |
| Ambiente de teste | credenciais `TEST-` | **não existe** |
| Filtro por data | sim | não |
| Cupom | nosso, percentual livre | código cadastrado lá |

---

## Parte 2 — O que você precisa fazer nos painéis

Faça isto e me traga os valores. Nada aqui depende de mim.

### Cakto — chave de API

1. `app.cakto.com.br/dashboard/cakto-api` → **Integrações** → **Cakto API**
2. **Criar Chave de API**
3. Escopos: **read**, **write**, **payments**, **tokenização de cartão**,
   **orders**. Na dúvida marque tudo — dá para criar outra chave depois
4. **Copie o `client_secret` agora.** Ele aparece uma vez só

→ me traga `client_id` e `client_secret`.

### Cakto — produto e ofertas

5. Crie **um produto**: `Bruxário`
6. Nele, habilite os meios: **Pix** e **Cartão de crédito**
7. Crie **três ofertas**:

| Nome | Preço | Para quê |
| --- | --- | --- |
| `Revelação` | 9,80 | o que a campanha vende |
| `Revelação Completa` | 18,90 | o upgrade |
| `Teste — não vender` | 1,00 | a nossa compra de verdade, para validar |

8. Anote o **id de cada oferta** (`Produtos` no painel)

→ me traga os três `offerId`.

### Cakto — webhook

9. Painel → **Apps/Webhooks** → criar, apontando para:
   `https://bruxario.com.br/api/webhook/cakto`
10. Eventos: `purchase_approved`, `purchase_refused`, `pix_gerado`,
    `refund`, `chargeback`
11. Copie o **`secret`** gerado

→ me traga o `secret`.

### Cakto — a conta

12. Confirme que a conta está **aprovada para receber** (KYC/documentos). Se
    não estiver, nada disso cobra, e a mensagem de erro não vai dizer isso

### Utmify

13. Pegue o **`API token`** (credenciais de API) e o **`pixel ID`**
14. Confirme que a integração com a Meta aparece **conectada**
15. Na Utmify, a plataforma da venda vai como **`Cakto`**

→ me traga `UTMIFY_API_TOKEN` e `NEXT_PUBLIC_UTMIFY_PIXEL_ID`.

### Meta

16. Nada a fazer agora. **Não vamos mexer no pixel do navegador nesta virada** —
    ele continua disparando como hoje. Só depois de a Utmify aparecer mandando
    `Purchase` no Events Manager é que a gente decide desligar o nosso, num
    commit separado, com como voltar atrás

---

## Parte 3 — A ordem de execução

Cada fase termina com `npm test` passando. Nada vai para produção antes da
fase 6.

### Fase 0 — o furo do preço zero ✅ feito

`/api/pedido/[id]/pagamento` lia `produtoDe()` — a tabela estática, onde a
Revelação está com `precoCentavos: 0`. Com o interruptor desligado, essa rota
mandaria o gateway cobrar **R$ 0,00** por uma venda anunciada a R$ 9,80.

É o mesmo furo de 21/08 um degrau adiante: lá a entrega saía de graça, aqui a
cobrança sairia zerada. Trocado por `produtoVigenteDe()`, e o teste que lê o
código das rotas passa a cobrir também a rota que cobra.

### Fase 1 — Utmify (não depende da Cakto)

Portar de `entrega-terceiro/bruxario/` para o projeto principal: `utmify.ts`,
`reportar-venda.ts`, `ScriptUtmify.tsx`, migração `002_utms`.

O pedido é reportado **duas vezes**: `waiting_payment` quando a cobrança abre,
`paid` quando o dinheiro entra. Os UTMs e o IP ficam gravados no pedido, porque
quem reporta é o servidor, horas depois, sem navegador por perto.

Com `UTMIFY_TESTE=1` até você trazer o token.

### Fase 2 — o adaptador da Cakto

`src/nucleo/checkouts/cakto.ts`, implementando o mesmo `ProvedorPagamento` de
quatro métodos. Cache de token em memória. `sck` como referência externa.
Tradução de status para o nosso vocabulário. Testes com `fetch` dublado.

### Fase 3 — o webhook

`/api/webhook/cakto`, separado do do Mercado Pago. Compara o `secret` em tempo
constante, consulta o pedido na API deles, e entrega para o
`webhook-pagamento.ts` que já existe e já é idempotente.

Rota nova, endereço novo: **o webhook do MP continua funcionando o tempo
inteiro**. Nenhuma venda em curso quebra.

### Fase 4 — o checkout novo

Componente `CheckoutCakto.tsx` no lugar do Brick: SDK deles, antifraude no
load da página, tokenização no submit, 3DS no cartão, e os campos novos
(telefone e CPF).

Pix primeiro e em cima — é onde converte nesse ticket, e é o caminho que não
depende do SDK dar certo.

### Fase 5 — o interruptor de gateway

`GATEWAY=mercadopago | cakto`, **nascendo em `mercadopago`**. É a disciplina 3
do projeto aplicada ao que mexe em dinheiro: o código sobe sem trocar o
negócio, e voltar atrás é uma variável de ambiente e um `pm2 restart`, não um
deploy.

### Fase 6 — provar, com dinheiro de verdade

1. Local, com túnel, para o webhook chegar
2. **Backup do banco de produção antes de qualquer coisa**
3. Deploy com `GATEWAY=mercadopago` — nada muda para quem está comprando
4. Vira para `cakto`, e você compra a oferta de **R$ 1,00**: Pix e cartão
5. Confere os quatro: e-mail com o PDF chegou · pedido `entregue` ·
   venda na Utmify · `Purchase` no Events Manager
6. Se qualquer um falhar: `GATEWAY=mercadopago`, restart, e a gente investiga
   com a campanha vendendo normal

### Fase 7 — depois de estável, e só depois

Decidir o cupom (A → C). Reavaliar o pixel do navegador. Aposentar o
Mercado Pago.

---

## O que continua valendo, e não se discute

- **Só o webhook libera acesso.** Cartão volta `paid` na hora, Pix volta
  `waiting_payment` — em nenhum dos dois o pedido sai de `aguardando_pagamento`
- **Toda decisão de preço passa por `produtoVigente` / `precoVigenteCentavos`**
- **O interruptor `modelo-novo` fica DESLIGADO.** O foco é venda, não cadastro:
  Revelação R$ 9,80, Completa R$ 18,90
- **O `event_id` do `Purchase` não sai do lugar** (`${pedidoId}:purchase`)
- **`npm run build` aplica migrações no banco real.** Backup antes, sempre
