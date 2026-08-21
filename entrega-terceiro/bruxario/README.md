# Produto: revelação do familiar

Funil de venda de produto único. A pessoa atravessa 26 cenas, recebe uma
leitura escrita sobre ela, paga, e o PDF chega no e-mail.

```
anúncio → 26 cenas → revelação parcial + oferta → pagamento → PDF no e-mail
```

Não há conta de cliente, não há assinatura, não há área logada. O único login
do sistema é o do painel administrativo.

## Subir

```bash
cp .env.example .env      # e preencha
npm install
npm run build             # aplica as migrações pendentes
npm start
```

O `build` toca o banco: `src/lib/db.ts` roda as migrações no import. Rode
`npm run backup` antes de qualquer atualização em produção.

## O que precisa estar preenchido para vender

| variável | sem ela |
|---|---|
| `DIRECTPAG_API_TOKEN` + os dois hashes | não cobra — ver `docs/DIRECTPAG.md` |
| `GEMINI_API_KEY` (ou `OPENAI_API_KEY`) | não escreve a leitura |
| `RESEND_API_KEY` + `EMAIL_REMETENTE` | não entrega |
| `ADMIN_EMAIL` | painel inacessível |
| `BASE_URL` | links de e-mail quebrados |
| `NEXT_PUBLIC_META_PIXEL_ID` | anúncio sem medição |

Sem `DIRECTPAG_API_TOKEN` o checkout entra em **modo de teste**: aprova sem
cobrar, para dar para atravessar o funil inteiro em desenvolvimento.

## Como funciona, em quatro peças

**O ritual** (`src/lib/quiz/`) — 26 cenas, quatro eixos, doze familiares. A
pontuação é determinística e testada; nada de IA aqui.

**A leitura** (`src/lib/leitura.ts`) — o texto, escrito por IA a partir do
perfil. É a única chamada paga por venda.

**A entrega** (`src/lib/arte.ts`, `pdf.ts`, `email.ts`) — as imagens, o PDF, e
o e-mail. A revelação também fica num link público pelo prazo do produto.

**O dinheiro** (`src/nucleo/checkouts/directpag.ts`) — cobrança, webhook,
estorno e reconciliação.

## Quem libera a entrega

**O webhook, e só ele.** A resposta síncrona do checkout nunca libera acesso —
cartão aprovado volta `approved` na hora e Pix volta `pending` com o QR, e em
nenhum dos dois casos o pedido sai de `aguardando_pagamento`. A exceção é o
modo de teste, onde não há webhook para chegar.

Isso é deliberado e é o que impede uma resposta forjada no navegador de
entregar produto.

## Rotinas (cron)

```
*/5 * * * *   npm run capi           # drena a fila de eventos do pixel
0  *  * * *   npm run lembrar-carrinho
0  3  * * *   npm run reconciliar    # acha pagamento que não virou entrega
0  4  * * *   npm run backup
*/15 * * * *  npm run sentinela      # invariantes: valor cobrado, entrega, etc.
```

## Testes

```bash
npm test
```

Rodam num banco temporário — não tocam o de desenvolvimento.

## Documentos

- `docs/DIRECTPAG.md` — conectar o gateway, e o que a API dele não faz
- `LICENCA.md` — o mecanismo de licença, e o que ele não é
