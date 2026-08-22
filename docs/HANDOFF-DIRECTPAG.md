# Trocar o Mercado Pago pela DirectPag — contexto para uma sessão nova

> Cole isto inteiro no começo do chat novo. É o que a sessão precisa saber
> para trabalhar direto no que está vendendo, sem redescobrir nada.

---

## Quem é o projeto

**Bruxário** (`bruxario.com.br`) — Next.js 16 App Router, React 19,
TypeScript, better-sqlite3, Tailwind. Vende um teste de personalidade de 26
cenas que revela um "familiar" (um de doze animais), com leitura escrita por
IA, entregue em PDF e num link público.

Repositório local:
`/home/pedro/Área de trabalho/Micro_Projects/meu_familiar` — branch `master`.

**Está vendendo agora, com campanha de anúncio no ar.** Toda mudança acontece
sobre tráfego real.

## Acesso à VPS

```
ssh root@100.126.229.42        # SÓ pela tailnet; o IP público tem a 22 fechada
senha: peça ao dono (descartável, trocada com frequência)
```

- App em `/root/apps/bruxario`, servido por **pm2** (`pm2 restart bruxario`)
- Banco em `var/data/bruxario.db`
- **A árvore de produção NÃO é versionada.** O `git log` de lá aponta um
  commit antigo e o disco tem outra coisa. Deploy é por **cópia de arquivos**,
  nunca `git pull` — qualquer operação de git ali destrói ou conflita
- `npm run build` **aplica as migrações** no banco real, porque `db.ts` chama
  o runner no import. Backup antes, sempre:
  `cp var/data/bruxario.db /root/backups-deploy/...`

Receita de deploy que funciona:

```bash
tar czf /tmp/x.tgz <arquivos>
scp /tmp/x.tgz root@100.126.229.42:/tmp/
ssh root@100.126.229.42 'cd /root/apps/bruxario && tar xzf /tmp/x.tgz \
  && npm run build && pm2 restart bruxario --update-env'
```

---

## O que se quer fazer

**Trocar o Mercado Pago pela DirectPag**, com o produto configurado lá como
**"Área de membros externa"** e usando o **checkout personalizado** deles.

O modelo de venda **não muda**: produto único, compra avulsa, entrega por
e-mail. Revelação R$ 9,80 e Completa R$ 18,90.

---

## O que já existe pronto e deve ser reaproveitado

**Há um adaptador DirectPag inteiro, testado, em:**

```
entrega-terceiro/bruxario/src/nucleo/checkouts/directpag.ts
entrega-terceiro/bruxario/src/nucleo/checkouts/tipos.ts
entrega-terceiro/bruxario/src/nucleo/checkouts/directpag.test.ts   (9 testes)
entrega-terceiro/bruxario/docs/DIRECTPAG.md
```

Essa pasta é uma versão reduzida do sistema feita para entregar a um terceiro.
**Não é o que roda em produção** — serve como fonte do adaptador, que pode ser
copiado para `src/nucleo/checkouts/` do projeto principal.

O adaptador implementa a interface `ProvedorPagamento`, a mesma que o
`mercadopago.ts` já implementa: `criarPagamento`, `consultarPagamento`,
`estornar`, `listarPagosNoPeriodo`. A arquitetura foi feita para dois
provedores conviverem.

---

## O que a API da DirectPag faz e não faz

Levantado da documentação oficial (`https://docs.directpag.com.br/`, que é uma
SPA — o conteúdo está no bundle JS).

**Base:** `https://api.directpag.com.br/api/public/v1`
**Auth:** `?api_token=` em **query string**, em toda requisição (não é header)

17 endpoints: transações (criar, listar, consultar, estornar), produtos e
ofertas, saldo e saques, contas bancárias, e split por payload.

### Quatro coisas que mudam o desenho

1. **Toda transação exige uma `offer_hash`.** Não se cobra um valor solto — o
   produto e a oferta precisam existir na conta antes da primeira venda.
   O valor final continua vindo do nosso servidor.

2. **`customer.document` (CPF) é obrigatório.** O checkout do Mercado Pago não
   pedia. O formulário novo precisa pedir, e não há como contornar pela API.

3. **O postback NÃO é assinado.** Sem HMAC, sem header assinado. Qualquer um
   que descubra a URL pode forjar um pagamento aprovado.
   **A defesa:** tratar o corpo como aviso e ler só o id da transação; o status
   real vem de `consultarPagamento`, autenticado com o nosso token. Isso já
   está implementado no adaptador.

4. **Cartão vai em texto puro** (`card.number`), sem tokenização no navegador
   e sem cofre. Move a operação de SAQ A para SAQ D no PCI-DSS. O adaptador
   vem com `METODOS_HABILITADOS = ['pix', 'billet']` e cartão desligado — é
   uma decisão que merece ser tomada de propósito.

**Recorrência:** existe no painel (`payment_type` é inteiro e a doc só
documenta `1 = Pagamento Único`), mas não há endpoint público para criar,
consultar ou cancelar assinatura, nem evento de renovação. Irrelevante aqui,
que é produto único.

**Sem sandbox documentado.** Testar com valor baixo em produção.

---

## O caminho crítico — os arquivos que mexem com dinheiro

Qualquer mudança aqui exige teste ponta a ponta antes de subir:

```
src/app/api/pedido/[id]/pagamento/route.ts   cria a cobrança
src/app/api/webhook/route.ts                  recebe a confirmação
src/lib/webhook-pagamento.ts                  decide o que fazer com ela
src/nucleo/checkouts/mercadopago.ts           o adaptador atual
src/lib/cupons.ts                             precoComDesconto — o preço
src/lib/modelo-de-venda.ts                    o interruptor (ler abaixo!)
src/lib/processar.ts                          geração e entrega
src/components/CheckoutMercadoPago.tsx        o formulário atual
```

## O interruptor do modelo de venda — LEIA ANTES DE MEXER EM PREÇO

`src/lib/modelo-de-venda.ts` existe porque o master contém um modelo de
negócio novo (Revelação grátis + assinatura) que **está desligado** em
produção. Com a chave desligada, a Revelação custa R$ 9,80.

```
npm run modelo-novo              # mostra o estado
npm run modelo-novo -- ligar     # modelo novo
npm run modelo-novo -- desligar  # rollback instantâneo
```

**A armadilha que já custou dinheiro:** `src/lib/produtos.ts` tem a Revelação
com `precoCentavos: 0` (é o modelo novo). Qualquer rota que leia o preço de lá
em vez de `produtoVigente()` faz `preco.gratis` virar verdadeiro e entrega o
produto **sem passar pelo gateway**.

Isso aconteceu em 21/08: duas pessoas receberam de graça o que a campanha
vendia, porque `/api/quiz` lia `produtoDe()`. Está corrigido, e há um teste em
`src/lib/modelo-de-venda.test.ts` que lê o código das rotas que cobram e
recusa qualquer uma que calcule preço pela tabela estática.

**Toda decisão de preço passa por `produtoVigente` / `precoVigenteCentavos`.**

---

## Rastreio — o que existe e por quê

- **Pixel da Meta** no navegador: `PageView`, `Lead`, `Purchase`. O `Purchase`
  leva `event_id` estável (`${pedidoId}:purchase`) porque a mesma venda aberta
  em três aparelhos contava três vezes no Ads Manager. **Não remover o
  `event_id`.**
- **Conversions API** existe no código e enfileira os mesmos `event_id`, mas
  **não há token** (`META_CAPI_ACCESS_TOKEN` ausente, e a conta não consegue
  gerar). Os eventos ficam na fila sem sair. Quem sustenta a medição hoje é o
  navegador.
- **Utmify**: implementada na versão de entrega
  (`entrega-terceiro/bruxario/src/lib/utmify.ts` + `docs/UTMIFY.md`), **ainda
  não em produção**. Reporta o pedido duas vezes (`waiting_payment` e `paid`),
  com os UTMs gravados no pedido. Header `x-api-token`,
  `POST https://api.utmify.com.br/api-credentials/orders`.

## Atribuição de campanha

O link do anúncio precisa carregar `?c=<codigo>`, e a campanha precisa ter
esse código cadastrado no painel — campanha sem código não casa com nada e a
venda vira "outro". Isso já aconteceu (as campanhas de 07–12/08 rodaram sem
código). As atuais estão certas.

---

## Como o dinheiro funciona hoje

1. Pessoa atravessa as 26 cenas → `/api/quiz` cria o pedido
2. Vai para `/seu-familiar/[id]` — prévia + oferta (é o que converte)
3. Escolhe produto → `/api/pedido/[id]/escolher` grava produto e cupom
4. `/pagamento/[id]` → Payment Brick do MP, embutido, sem sair do site
5. `/api/pedido/[id]/pagamento` cria a cobrança
6. **O webhook é quem libera** — a resposta síncrona nunca entrega
7. `/obrigado/[id]` faz poll até `entregue`, depois manda para `/revelacao`
8. `processar.ts` gera leitura, artes e PDF, e manda o e-mail

**Regra que não pode quebrar:** só o webhook libera acesso. Cartão aprovado
volta `approved` na hora e Pix volta `pending` — em nenhum dos dois casos o
pedido sai de `aguardando_pagamento`. A exceção é `pagamentoEhFake()`, o modo
sem credencial usado em desenvolvimento.

---

## O que precisa ser decidido / obtido antes de começar

- [ ] `DIRECTPAG_API_TOKEN` — o dono gera no painel deles
- [ ] Criar produto + oferta na conta e pegar `DIRECTPAG_PRODUCT_HASH` e
      `DIRECTPAG_OFFER_HASH`. Marcar como **Área de membros externa**
- [ ] Decidir: checkout embutido (formulário nosso, chamando a API) ou
      checkout hospedado deles. O embutido mantém a pessoa no site — foi por
      isso que o projeto saiu do Asaas — mas exige pedir CPF e, se ligar
      cartão, aceita o número cru
- [ ] Decidir se o Mercado Pago sai ou fica como segundo provedor. A tabela
      `contas_checkout` foi feita para os dois conviverem, e dá para mandar
      uma fatia do tráfego para a DirectPag e comparar taxa e conversão

## Como verificar que funcionou

```bash
npm test                      # 478 testes
npm run build                 # o App Router estoura em erro de tipo em rota
npm run reconciliar -- --horas=48   # pagamento no gateway sem pedido aqui
```

E o teste que importa: fazer uma compra de verdade, com valor baixo, e
conferir que o e-mail chegou com o PDF.

---

## Como o dono trabalha

- Português, direto, sem rodeio. Detesta ser perguntado o que dá para decidir
- Quer as coisas **feitas**, não descritas: "se não está feito, faça"
- Roda tudo em produção rápido; o assistente executa os comandos
- Corrija-o quando ele estiver errado sobre um fato técnico, com a evidência
  na mão — ele aceita e agradece
- Quando um erro for seu, diga qual foi e conserte. Ele já pegou um erro meu
  conferindo o extrato
