# Bruxário — estado real e o plano da Wiven

Escrito em 23/08/2026, no fim de uma sessão longa. Serve de memória: quem
pegar isto sem ter estado na conversa precisa conseguir trabalhar.

---

## 1. O que está no ar AGORA

Produção: `bruxario.com.br`, VPS `100.126.229.42` (só pela tailnet), app em
`/root/apps/bruxario` sob pm2.

**Quem cobra: Mercado Pago.** `MP_MODO=producao`, `GATEWAY=mercadopago`.

### Preços — e a armadilha do cupom

O cupom `LANCAMENTO20` (20%) é aplicado **automaticamente a todo pedido**
(`CUPOM_DE_LANCAMENTO`). Então o preço em `PRECOS_DO_MODELO_ANTIGO` é o
**cheio**, não o que entra no caixa:

```
Revelação    cheio 12,25  −20%  →  9,80 cobrado
Completa     cheio 23,62  −20%  →  18,90 cobrado
Assinatura   29,90 (sem cupom)
Upgrade      4,90 (melhoria, sem cupom)
```

**`precoComDesconto` arredonda para CIMA** (`Math.ceil`). Por isso a Completa
é 2362 e não 2363: `2363 × 0,8 = 1890,4` → 1891, um centavo a mais do que o
anunciado. `src/lib/preco-com-cupom.test.ts` trava o que o cliente PAGA, não
o preço cheio — se alguém mexer no cheio sem refazer a conta, quebra na hora.

**Subir preço = desligar ou reduzir o cupom.** Sem deploy.

### Onde o dinheiro aparece

| Tela | O quê |
| --- | --- |
| `/seu-familiar/[id]` | A oferta de compra: **3 cards** (9,80 · 18,90 · 29,90). Pré-selecionado: **Revelação** |
| `/oferta/[id]` | Pós-entrega, 3 degraus (`avulsa_simples` 12,90 · `avulsa_completa` 18,90 · `revelacao_mensal` 29,90) |
| `/melhorar/[id]` | Upgrade de 4,90 — desbloqueia gráficos, link e narração |
| `/planos` | Assinaturas (15,90 · 29,90 · 49,90) |
| `/conta/familiar` | Quem não comprou vê a imagem + "Comprar a revelação" |

### Interruptores (tabela `interruptores`, vazia = desligado)

| Chave | Efeito |
| --- | --- |
| `modelo_novo` | **DESLIGADO.** Ligar zera o preço da Revelação — mataria a campanha |
| `planos_fechados` | Ausente = planos vendendo. Ligar tranca |
| `oferta_fechada` | Ausente = `/oferta` aparece pós-entrega. Ligar volta pra `/revelacao` |

### Cron na VPS

```
0  4 * * *  backup.sh
17 * * * *  npm run resgatar-ritual
37 * * * *  npm run lembrar-carrinho      ← instalado em 23/08
```

---

## 2. O que foi feito nesta sessão

Tudo já está em produção e com teste. **593 testes passando.**

### Bugs que custavam dinheiro

1. **`/api/pedido/[id]/pagamento` cobrava R$ 0,00.** Lia `produtoDe()` (tabela
   estática, Revelação zerada). Trocado por `produtoVigenteDe()`.
2. **O link do anúncio caía na landing.** A raiz só abria na primeira cena com
   `?c=`, `?de=` ou `?s=` — e o anúncio manda `utm_source`. **Todo clique de
   anúncio via a landing.** Corrigido: `utm_source` conta como marcador.
3. **O CTA da oferta vinha marcado na Completa** (R$ 18,90) para quem clicou
   num anúncio de R$ 9,80. 21 pessoas chegaram na tela, **2 clicaram**. Agora
   nasce na Revelação.
4. **O upgrade de 4,90 regerava o texto inteiro.** Nova chamada de IA e um
   texto DIFERENTE do que a pessoa já tinha lido. Agora reaproveita
   `leitura_json`.
5. **`processarPedido` recusava `gerando` em silêncio** — e `pedidosTravados()`
   inclui `gerando` de propósito. `npm run reprocessar` listava, chamava,
   nada acontecia, e imprimia "Concluído". **A rede existia e não pegava
   nada.** Uma cliente ficou 14h presa. Agora distingue "gerando agora" de
   "morreu gerando" pelo relógio (`GERACAO_MORTA_APOS_MS`, 10 min).
6. **O webhook segurava a geração da melhoria** (`await processarPedido`
   dentro da requisição). Agora devolve a promessa, como o caminho da compra.
7. **Planos não vendiam.** `abrirCobranca` começava com
   `if (!modeloNovoLigado()) return null` — e essa chave vive desligada.
   `/planos` anunciava e não vendia. **Zero cobranças de plano no banco,
   sempre.** Separado em `planosVendaveis()`.
8. **O link mágico da equipe rebaixava a pessoa a cliente.** Emitir usava
   `podeVerPainel` (dono + equipe), validar usava `ehAdmin` (só o dono). O
   membro caía em `/conta` e, com pedido pendente, na tela de compra.
9. **O resgate de carrinho mandava um e-mail por PEDIDO**, não por pessoa.
   Quem refez o ritual 3× levaria 3 e-mails.

### Coisas novas

- **Abertura do ritual trocada para `q17`** (o sonho que volta pela terceira
  noite). Era a `q01`, sobre falar numa roda — nada a ver com o anúncio. Mais
  um contrato de uma linha: *"26 cenas, uns 3 minutos. No fim, você vê quem é
  o seu familiar."* Motivo: **71 chegaram, 43 saíram sem responder nada** (61%).
- **Resgate de carrinho automático**, janela 24h–72h (24h porque o Pix vence
  em 24h; lembrar antes é apressar quem já ia pagar). Cupom por rodada, 45%,
  usos limitados, 3 dias — **nunca um código fixo**, que vaza e vira o preço
  real.
- **`familiar.png`** em `/api/storage/[id]/` serve uma das 48 artes prontas
  (familiar × lua) para quem NÃO comprou. Custo zero: a leitura, que custa IA,
  nunca foi gerada.
- **Upgrade de 4,90 divulgado** no e-mail de entrega e na revelação. Antes a
  página existia e **nenhum link levava até ela**.

---

## 3. Cakto — dormente, funcionando, decidida contra

Código inteiro no ar e testado, desligado por `GATEWAY=mercadopago`.
`src/nucleo/checkouts/cakto.ts`, `cakto-ofertas.ts`, `gateway.ts`,
`/api/webhook/cakto`. `npm run cakto-setup` cria produto e webhook por API.

**Provado contra a API real:** autenticação, criação de oferta, leitura de
pedido pago, tradução de status e taxa.

**O que a barrou:**
- **Pix pela API exige conta ativa no Cakto Banking** — não liberou
- **Taxa: 0% + R$ 2,49 no Pix.** Em R$ 9,80 isso é **25%**
- Sem sandbox, mínimo R$ 5,00
- `metadata` sem campo livre: usar `sck` como `external_reference`

Ver `docs/PLANO-CAKTO.md` para o detalhe da API.

---

## 4. Wiven — INTEGRADA, dormente

`https://app.wiven.com.br/docs`. **A documentação é SPA**: `curl` e WebFetch
pegam a casca vazia, `sitemap.xml` e `robots.txt` também. O jeito é salvar a
página no navegador — o schema inteiro vem embutido no HTML.

- Base: `https://app.wiven.com.br/api/v1`
- Auth: headers `x-public-key` e `x-secret-key`
- **Taxa: 5,99% + R$ 1,99** (faixa 0–10k/mês); 4,99% + R$ 1,49 até 100k

### O código

| Arquivo | O quê |
| --- | --- |
| `src/nucleo/checkouts/wiven.ts` | O provedor inteiro |
| `src/app/api/webhook/wiven/route.ts` | O webhook, com duas portas |
| `src/components/checkout/Wiven.tsx` | Pix e cartão, cartão em etapas |
| `scripts/wiven-fumaca.ts` | `npm run wiven-fumaca` — Pix real de R$ 5 |

Rotas usadas: `POST /gateway/pix/receive`, `POST /gateway/card/receive`,
`GET /gateway/transactions?id=|clientIdentifier=`,
`POST /gateway/producer/refunds`, `GET /gateway/producer/credentials`.

### Para ligar

```
WIVEN_PUBLIC_KEY=...
WIVEN_SECRET_KEY=...
WIVEN_WEBHOOK_TOKEN=...      # cadastrado junto do webhook, no painel
GATEWAY_PIX=wiven            # ou GATEWAY=wiven para os dois meios
```

Webhook do painel apontando para `https://bruxario.com.br/api/webhook/wiven`.
`GATEWAY=mercadopago` volta tudo com um restart, sem deploy.

**A meia-configuração falha na entrada.** As chaves da API bastam para cobrar,
mas quem libera acesso é o webhook — e a rota recusa tudo sem o token. Então
`gatewayDe()` recusa a Wiven sem `WIVEN_WEBHOOK_TOKEN` e cai no Mercado Pago.
Sem isso, ela cobraria e nunca entregaria.

### As quatro armadilhas (todas com teste)

**1. Ela fala TRÊS vocabulários de dinheiro.**

| Onde | Campo | Significa |
| --- | --- | --- |
| criação | `fee` | a TAXA |
| webhook | `commissionAmount` | o LÍQUIDO |
| consulta | `chargeAmount` / `amount` | pago pelo cliente / recebido pelo produtor |

A consulta **não tem campo de taxa**. Fica `null` — a diferença entre os dois
é juro de parcelamento, não taxa nossa. Quem alimenta o painel é o webhook.

**2. E dois vocabulários de status.** Criação: `OK · PENDING · FAILED ·
REJECTED · CANCELED`. Webhook: `COMPLETED · PENDING · FAILED · REFUNDED ·
CHARGED_BACK`. Só dois são comuns. Uma tradução que só conhecesse a criação
nunca reconheceria `COMPLETED` — todo mundo pagando, ninguém recebendo.

**3. `OK` na criação do Pix não é venda.** O QR acabou de nascer. Traduzido
como `pending`, sempre.

**4. `transaction.identifier` é anulável** — e o exemplo de payload deles nem
o traz. Por isso a busca tem dois caminhos: o prefixo de `pedidoId--uuid` e o
`transaction.id`, gravado como `pagamento_id` na criação.

E `amount` é **reais decimais**: `emReais` passa por `toFixed(2)`, com teste
varrendo 1 a 5000 centavos.

### O webhook tem duas portas

O `token` viaja no corpo, em texto — não é HMAC. Comparado em tempo constante.
A defesa natural contra token vazado seria reconsultar a API, mas isso esbarra
no item **"Polling bloqueado"** deles. Então a segunda porta é o preço,
recalculado do nosso lado: notificação dizendo ter pago menos é recusada. A
mais passa — `precoComDesconto` arredonda para cima.

### Reconciliação: indisponível, e barulhenta

`listarPagosNoPeriodo` **lança**. `GET /gateway/transactions` não filtra por
data, e varrer uma a uma é o polling que eles desencorajam. `[]` faria a
reconciliação concluir em silêncio que a Wiven não tem venda nenhuma e marcar
como suspeita toda venda que o webhook gravou certo.

### O custo, para ser escolha e não surpresa

| | MP (hoje) | Cakto | **Wiven** |
| --- | --- | --- | --- |
| Revelação R$ 9,80 | ~R$ 0,10 · **1%** | R$ 2,49 · 25% | **R$ 2,58 · 26%** |
| Completa R$ 18,90 | ~R$ 0,19 · **1%** | R$ 2,49 · 13% | **R$ 3,12 · 17%** |

Nas duas vendas reais de R$ 15,12 (20 e 21/08) o MP cobrou **R$ 0,15** cada.
Pela Wiven seriam R$ 12,22 — **R$ 2,75 a menos por venda**. Decisão do dono:
conectar mesmo assim.

### PCI — o que foi feito e o que não dá para fazer

O cartão da Wiven **não tem tokenização**: PAN e CVV chegam em texto no corpo.
Hoje, com o Brick do MP, o número nunca toca a máquina.

Feito: passagem direta. Estado de React que morre com a aba, nada em
`localStorage`, nada em log — o erro ecoa o texto do gateway, nunca o corpo
enviado. **Isso reduz o risco real e não tira o escopo PCI-DSS**, porque a
régua é transmitir ou processar, não armazenar.

**Se aparecer SDK de tokenização no navegador, é a primeira coisa a trocar.**
Enquanto não, `GATEWAY_PIX=wiven` sozinho entrega a plaquinha sem o PAN: o Pix
pede só nome, e-mail, telefone e CPF.

### O que ainda não foi lido da documentação

- `Polling bloqueado` — quero o texto antes de mexer na reconciliação
- `Bucket de vendas pendentes`, `Limite de webhooks via API`
- `Cálculo do valor da transação` (os campos `shippingFee`/`extraFee`/`discount`)
- Assinaturas (`pix/subscription`, `card/subscription`) — o plano de 29,90
- `trackProps` do webhook traz UTMs, `fbc`, `fbp`, IP e user-agent: matéria
  pronta para Meta CAPI e Utmify

## 5. Regras que não se discutem

- **Só o webhook libera acesso.** Cartão volta `paid` na hora e Pix volta
  pendente; em nenhum dos dois o pedido sai de `aguardando_pagamento`
- **Toda decisão de preço passa por `produtoVigente`/`precoVigenteCentavos`**
- **O `event_id` do `Purchase` não sai do lugar** (`${pedidoId}:purchase`)
- **`npm run build` aplica migrações no banco real.** Backup antes, sempre:
  `cp var/data/bruxario.db /root/backups-deploy/bruxario-$(date +%Y%m%d-%H%M%S).db`
- **Produção JÁ está no master.** Meça com md5 antes de assumir o contrário —
  o `git log` da VPS mente

---

## 6. Pendências

### Sem urgência — os e-mails de remarketing

O resgate de carrinho (24h) roda sozinho no cron. **Falta o segundo e-mail**,
o de acesso à conta, que o dono desenhou assim:

> 24h depois — da compra, ou do e-mail de resgate para quem não comprou —
> chega um e-mail dizendo que a conta gratuita já existe. Ele **não manda o
> familiar**: para ver, a pessoa entra no app, e de quebra descobre o resto
> das funções. Quem não comprou vê **só a imagem**; a leitura continua
> trancada.

A tela já está pronta (`/conta/familiar`, com "Comprar a revelação" e "Baixar
a imagem") e a arte sai por `/api/storage/[id]/familiar.png`.

**A parede:** **38 pessoas que abandonaram não têm conta** (só 2 têm). A conta
nasce na compra, e `/api/auth/solicitar` só manda link mágico para conta que
já existe. Mandar "acesse sua conta" para essas 38 as joga numa porta
trancada. O e-mail precisa **criar a conta e levar o link dentro**, via
`entregarChaveDaPlataforma`.

Isso vira o terceiro e-mail para a mesma pessoa. O script tinha uma regra
escrita contra sequência, pelo risco de marcação de spam derrubar junto os
e-mails de entrega. Espaçados de 24h e com assuntos diferentes é aceitável —
mas é troca consciente. O descadastro já existe (`tokenDeDescadastro`).

### Decisões abertas

- `/oferta` pós-entrega mostra `avulsa_simples` a **12,90** enquanto o funil
  vende a **9,80**. Alinhar, ou desligar por `oferta_fechada`
- O upgrade aparece na `/oferta` a 18,90 e no e-mail a **4,90** — mesmo
  produto, dois preços, e a pessoa vê os dois
- **Meta CAPI sem token.** A fila (`fila_capi`) enfileira e nada sai. O dono
  não consegue gerar o token: o pixel não está num portfólio empresarial, ou
  ele não é admin do ativo. Caminho: Business Settings → Fontes de dados →
  Pixels → reivindicar/dar controle total; ou criar Usuário do Sistema. **Isso
  também destrava o pixel da Utmify**, que exige o mesmo token
- **Utmify dormente** (`UTMIFY_API_TOKEN` vazio em produção). O envio de venda
  foi testado e funciona nos dois estágios

### O funil, medido em 21–23/08

```
71  chegaram (= abriram o ritual; para tráfego de anúncio é a mesma coisa)
28  responderam ao menos uma cena     -43  (61% de perda no primeiro toque)
19  preencheram o nome
15  criaram o pedido
13  viram a oferta
 2  clicaram em continuar
```

As duas maiores perdas: o primeiro toque (atacado com a `q17` e o contrato) e
o clique na oferta (atacado com o CTA na Revelação). **Medir
`ritual_aberto → cena` é o número que diz se funcionou.**
