# Revelação do Familiar — produto único

Funil de venda completo, de ponta a ponta:

```
26 cenas → bilhete do familiar + oferta → pagamento → PDF no e-mail
```

Uma pessoa entra, responde o teste, recebe uma prévia do resultado, paga, e a
leitura completa chega na caixa de entrada em PDF. Não há conta de cliente,
não há assinatura, não há área logada. O único login do sistema é o do painel.

## Subir

```bash
cp .env.example .env      # e preencha
npm install
npm run build             # aplica as migrações pendentes
npm start
```

## O mínimo para vender

| variável | sem ela |
|---|---|
| `DIRECTPAG_API_TOKEN` + os dois hashes | não cobra — ver `docs/DIRECTPAG.md` |
| `GEMINI_API_KEY` (ou `OPENAI_API_KEY`) | não escreve a leitura |
| `RESEND_API_KEY` + `EMAIL_REMETENTE` | não entrega |
| `ADMIN_EMAIL` | painel inacessível |
| `BASE_URL` | links do e-mail quebrados |
| `NEXT_PUBLIC_META_PIXEL_ID` | anúncio sem medição |
| `NEXT_PUBLIC_UTMIFY_PIXEL_ID` + `UTMIFY_API_TOKEN` | não sabe qual campanha vendeu — ver `docs/UTMIFY.md` |

**Sem `DIRECTPAG_API_TOKEN` o checkout entra em modo de teste:** aprova sem
cobrar. Dá para atravessar o funil inteiro em desenvolvimento.

## As quatro peças

**O ritual** (`src/lib/quiz/`) — 26 cenas, quatro eixos, doze familiares. A
pontuação é determinística e testada; nada de IA aqui.

**O bilhete e a oferta** (`src/lib/teaser.ts`, `/seu-familiar/[id]`) — a prévia
que a pessoa recebe antes de pagar. É o que converte.

**A leitura e a entrega** (`src/lib/leitura.ts`, `arte.ts`, `pdf.ts`,
`email.ts`) — o texto completo escrito por IA, as imagens, o PDF, e o e-mail.
A revelação também fica num link público pelo prazo do produto.

**O dinheiro** (`src/nucleo/checkouts/directpag.ts`) — cobrança, webhook e
estorno.

## Quem libera a entrega

**O webhook, e só ele.** A resposta síncrona do checkout nunca libera: um Pix
nasce `pending` e só vira `paid` quando a pessoa paga de verdade. A única
exceção é o modo de teste, onde não há webhook para chegar.

Isso é o que impede uma resposta forjada no navegador de entregar produto.

## O painel

`/painel/entrar` → link mágico para `ADMIN_EMAIL` → `/painel/pedidos`.

Responde a uma pergunta só: *as vendas estão chegando e sendo entregues?*
Pedido parado em `aguardando_pagamento` é carrinho abandonado; pedido em
`erro` é venda paga que não foi entregue — e é o único que exige ação.

Não há análise de campanha, catálogo nem gestão de cupom. Quem quiser isso
conecta o que preferir por fora.

## Reprocessar uma entrega que falhou

```bash
npm run reprocessar -- <id-do-pedido>
```

## Testes

```bash
npm test
```

Rodam num banco temporário — não tocam o de desenvolvimento.

## Rastreio de campanha

O pixel da Meta dispara `PageView`, `Lead` e `Purchase` — este último com
`event_id` estável por pedido, para a mesma venda aberta em dois aparelhos
contar uma vez só.

A Utmify recebe o pedido duas vezes: `waiting_payment` quando a cobrança abre
e `paid` quando o dinheiro entra. Os UTMs da URL do anúncio ficam gravados no
pedido, porque quem reporta a venda é o servidor e ele acontece horas depois,
sem navegador por perto.

## Documentos

- `docs/DIRECTPAG.md` — conectar o gateway
- `docs/UTMIFY.md` — conectar o rastreio de campanha
