# Cakto + Utmify em produção — contexto para uma sessão nova

> Cole isto inteiro no começo do chat novo. É o que a sessão precisa saber
> para trabalhar direto no que está vendendo, sem redescobrir nada.

**O trabalho desta noite:** trocar o Mercado Pago pela **Cakto** e ligar a
**Utmify**, em produção, com campanha de anúncio no ar.

---

## O projeto

**Bruxário** (`bruxario.com.br`) — Next.js 16 App Router, React 19,
TypeScript, better-sqlite3, Tailwind. Vende um teste de 26 cenas que revela um
"familiar" (um de doze animais), com leitura escrita por IA, entregue em PDF e
num link público.

Local: `/home/pedro/Área de trabalho/Micro_Projects/meu_familiar`, branch
`master`. **Está vendendo agora.** Toda mudança acontece sobre tráfego real.

Produtos: **Revelação R$ 9,80** e **Completa R$ 18,90**. Compra única, sem
assinatura, entrega por e-mail.

## Acesso à VPS

```
ssh root@100.126.229.42        # SÓ pela tailnet; a 22 do IP público é fechada
senha: peça ao dono
```

- App em `/root/apps/bruxario`, sob **pm2** (`pm2 restart bruxario`)
- Banco em `var/data/bruxario.db`
- **A árvore de produção NÃO é versionada.** O `git log` de lá aponta um
  commit antigo e o disco tem outra coisa. Deploy é por **cópia de arquivos**;
  `git pull` ali destrói ou conflita
- `npm run build` **aplica migrações** no banco real (`db.ts` chama o runner no
  import). **Backup antes, sempre.**

```bash
# backup
ssh root@100.126.229.42 'cd /root/apps/bruxario && cp var/data/bruxario.db \
  /root/backups-deploy/bruxario-$(date +%Y%m%d-%H%M%S).db'

# deploy
tar czf /tmp/x.tgz <arquivos>
scp /tmp/x.tgz root@100.126.229.42:/tmp/
ssh root@100.126.229.42 'cd /root/apps/bruxario && tar xzf /tmp/x.tgz \
  && npm run build && pm2 restart bruxario --update-env'
```

---

# Parte 1 — Cakto

## Por que ela, e não a DirectPag

A DirectPag foi avaliada e **descartada**: o cartão vai em texto puro pela
nossa API (SAQ A → SAQ D no PCI-DSS), o postback não tem verificação nenhuma,
e não há endpoint público de assinatura. A Cakto resolve os três.

## Autenticação — OAuth2

```
POST https://api.cakto.com.br/public_api/token/
Content-Type: application/x-www-form-urlencoded
client_id=...&client_secret=...
```

Devolve `access_token` (JWT), `expires_in` (ex.: 36000 = 10h), `token_type:
Bearer`, `scope`.

**Não existe endpoint de renovação** — quando expira, pede outro. O adaptador
precisa de um cache em memória com renovação antes do vencimento, e nunca
pedir token a cada requisição.

Escopos necessários: `write payments`, `write card_tokens`, `read orders`.
Credenciais em: painel → Integrações → Cakto API.

## Criar cobrança

```
POST https://api.cakto.com.br/public_api/payments/
Authorization: Bearer <token>
X-Idempotency-Key: <uuid v4>        ← retenção de 24h
```

Corpo, comum a Pix e cartão:

```jsonc
{
  "paymentMethod": "pix" | "credit_card" | "boleto",
  "customer": {
    "name": "...", "email": "...", "phone": "+55...",   // E.164
    "fingerprint": "...",                                // do front
    "docType": "cpf", "docNumber": "..."                 // recomendado no BR
  },
  "items": [{ "offerId": "..." }],                       // EXATAMENTE 1
  "antifraudProfilingAttemptReference": "...",           // do front
  "card": { "token": "..." },                            // só cartão
  "metadata": { "pedidoId": "..." },                     // nossa referência
  "pixExpiresIn": 3600                                   // opcional
}
```

**Pontos que mudam o desenho:**

1. **`offerId` é obrigatório.** Não se cobra valor solto — a oferta existe na
   conta e o preço vem dela. Preço nosso com cupom precisa de conferência:
   ver "O que ainda não sei", abaixo.
2. **Cartão é TOKENIZADO no navegador.** `POST /public_api/card-tokens/`
   devolve um token de 15 min, uso único. O número **nunca** toca nosso
   servidor — é o mesmo modelo do Brick que já usamos. Há SDK deles para isso.
3. **`fingerprint` e `antifraudProfilingAttemptReference` vêm do front**, do
   SDK de antifraude. Sem eles a cobrança não nasce.
4. **`X-Idempotency-Key`** é nativo: é o que impede retentativa virar cobrança
   dupla. Usar o `pedidoId` como base.

Resposta 201 traz `id`, `refId`, `status`, `amount`, `fees`, `checkoutUrl` e,
no Pix, `pix.qrCode` (copia-e-cola), `pix.qrCodeBase64` e `pix.expiresAt`.

Status de cartão: `paid`, `declined`, `refused`. Pix nasce `waiting_payment`.

## Webhook

**Não tem HMAC nem header assinado.** A validação é um campo `secret`
**dentro do corpo**:

```jsonc
{ "secret": "...", "event": "...", "data": { "id": "...", ... } }
```

Conferir o `secret` contra o nosso e recusar quando não bater. Como ele viaja
no corpo, HTTPS é obrigatório.

**Manter a regra que já vale aqui:** confirmar o status consultando a API
deles, e não confiar no corpo. `data.id` é a chave de deduplicação.

Eventos: `initiate_checkout`, `checkout_abandonment`, `purchase_approved`,
`purchase_refused`, `refund`, `chargeback`, `pix_gerado`, `boleto_gerado`, e
seis de assinatura (`subscription_created`, `renewed`, `renewal_refused`,
`paused`, `resumed`, `canceled`).

**Precisa responder 2xx em 8 segundos.** Nosso handler já faz a geração em
segundo plano sem `await` — manter assim. Retentativa deles: 5 vezes (5s, 1min,
2,5min, 6min, 30min).

## O que ainda não sei, e precisa ser conferido na primeira hora

- **Como o cupom entra.** O `offerId` define o preço; há um campo `coupon` no
  corpo, mas não confirmei se ele aceita desconto arbitrário ou só cupom
  cadastrado lá. Hoje o desconto é calculado aqui (`precoComDesconto`). Se a
  Cakto não aceitar valor livre, o cupom vira uma oferta por preço
- **Se há sandbox.** Não achei. Plano B: valor baixo em produção
- **O formato de `fingerprint`** e do SDK de antifraude no front

---

# Parte 2 — Utmify

**Já está escrita e testada**, na pasta da versão reduzida:

```
entrega-terceiro/bruxario/src/lib/utmify.ts          o cliente da API
entrega-terceiro/bruxario/src/lib/reportar-venda.ts  a ponte pedido → Utmify
entrega-terceiro/bruxario/src/components/ScriptUtmify.tsx
entrega-terceiro/bruxario/src/lib/migracoes/002_utms.ts
entrega-terceiro/bruxario/docs/UTMIFY.md
```

**Essa pasta não é o que roda em produção** — é uma versão reduzida feita para
entregar a um terceiro. Serve como fonte: copiar para o projeto principal.

Como funciona:

- **No navegador**, o script deles captura os UTMs da URL do anúncio e os
  mantém entre páginas
- **No servidor**, o pedido é reportado **duas vezes**: `waiting_payment`
  quando a cobrança abre, `paid` quando o dinheiro entra. Só a venda paga
  esconderia quem chegou ao checkout e desistiu
- Os UTMs e o IP são gravados **no pedido** (migração `002_utms`), porque quem
  reporta é o servidor, horas depois, sem navegador por perto

`POST https://api.utmify.com.br/api-credentials/orders`, header
`x-api-token`. Valores em centavos, datas `YYYY-MM-DD HH:MM:SS` em UTC.
A receita reportada é o **líquido** (cobrado menos taxa do gateway) — mandar o
cheio infla toda campanha.

Variáveis: `NEXT_PUBLIC_UTMIFY_PIXEL_ID`, `UTMIFY_API_TOKEN`,
`UTMIFY_PLATAFORMA=Cakto`, `UTMIFY_TESTE=1` enquanto testa.

---

## O caminho crítico — mexeu aqui, testa ponta a ponta

```
src/app/api/pedido/[id]/pagamento/route.ts   cria a cobrança
src/app/api/webhook/route.ts                  recebe a confirmação
src/lib/webhook-pagamento.ts                  decide o que fazer com ela
src/nucleo/checkouts/mercadopago.ts           o adaptador a substituir
src/lib/cupons.ts                             precoComDesconto — o preço
src/lib/modelo-de-venda.ts                    o interruptor (LEIA ABAIXO)
src/lib/processar.ts                          geração e entrega
src/components/CheckoutMercadoPago.tsx        o formulário a substituir
```

A interface `ProvedorPagamento` (em `mercadopago.ts`) tem quatro métodos:
`criarPagamento`, `consultarPagamento`, `estornar`, `listarPagosNoPeriodo`. O
adaptador da Cakto implementa a mesma coisa — o resto do sistema não precisa
saber quem responde.

## ⚠️ O interruptor de preço — a armadilha que já custou dinheiro

`src/lib/modelo-de-venda.ts` existe porque o master contém um modelo de
negócio novo (Revelação grátis + assinatura) que está **desligado**. Com a
chave desligada, a Revelação custa R$ 9,80.

```
npm run modelo-novo              # estado
npm run modelo-novo -- ligar     # modelo novo
npm run modelo-novo -- desligar  # rollback instantâneo
```

**`src/lib/produtos.ts` tem a Revelação com `precoCentavos: 0`.** Qualquer
rota que leia o preço de lá em vez de `produtoVigente()` faz `preco.gratis`
virar verdadeiro e entrega o produto **sem passar pelo gateway**.

Aconteceu em 21/08: duas pessoas receberam de graça o que a campanha vendia,
porque `/api/quiz` lia `produtoDe()`. O sintoma é `pago_em == criado_em` com
`pagamento_id` nulo. Está corrigido, e há um teste em
`src/lib/modelo-de-venda.test.ts` que **lê o código** das rotas que cobram e
recusa qualquer uma que calcule preço pela tabela estática.

**Toda decisão de preço passa por `produtoVigente` / `precoVigenteCentavos`.**

## A regra que não pode quebrar

**Só o webhook libera acesso.** Cartão aprovado volta `paid` na hora e Pix
volta `waiting_payment` — em nenhum dos dois o pedido sai de
`aguardando_pagamento`. A exceção é `pagamentoEhFake()`, o modo sem credencial
para desenvolvimento.

## Pixel da Meta — não mexer sem ler

`PageView`, `Lead` e `Purchase` saem do navegador. O `Purchase` leva
`event_id` estável (`${pedidoId}:purchase`) porque a mesma venda aberta em
três aparelhos contava três vendas no Ads Manager. **Não remover o
`event_id`.**

A Conversions API existe no código e enfileira os mesmos `event_id`, mas
**não há token** — a conta não consegue gerar. Os eventos ficam na fila sem
sair; quem sustenta a medição é o navegador. Não tente "melhorar" isso
tirando o disparo do navegador: já foi tentado e apagou a medição inteira.

## Como o dinheiro funciona hoje

1. 26 cenas → `/api/quiz` cria o pedido
2. `/seu-familiar/[id]` — prévia e oferta (é o que converte)
3. `/api/pedido/[id]/escolher` grava produto e cupom
4. `/pagamento/[id]` → checkout embutido, sem sair do site
5. `/api/pedido/[id]/pagamento` cria a cobrança
6. **Webhook libera**
7. `/obrigado/[id]` faz poll até `entregue` → `/revelacao/[id]`
8. `processar.ts` gera leitura, artes e PDF, e manda o e-mail

## Verificação

```bash
npm test          # 478 testes
npm run build     # o App Router estoura em erro de tipo em rota
```

E o que importa: **uma compra de verdade, com valor baixo**, conferindo que o
e-mail chegou com o PDF e que a venda apareceu na Utmify e no Ads Manager.

## Precisa estar em mãos antes de começar

- [ ] `client_id` e `client_secret` da Cakto (painel → Integrações → Cakto API)
- [ ] Produto e ofertas criados lá, com os `offerId` de cada um
- [ ] O `secret` do webhook da Cakto
- [ ] `NEXT_PUBLIC_UTMIFY_PIXEL_ID` e `UTMIFY_API_TOKEN`

## Como o dono trabalha

- Português, direto. Detesta ser perguntado o que dá para decidir sozinho
- Quer as coisas **feitas**: "se não está feito, faça"
- O assistente executa os comandos, inclusive em produção
- Corrija-o quando ele estiver errado sobre um fato técnico, com evidência —
  ele aceita
- Quando o erro for seu, diga qual foi e conserte. Ele confere o extrato
