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

## 4. Wiven — o plano

`https://app.wiven.com.br/docs` (o `curl` toma **403 do CloudFront** sem
User-Agent de navegador — não é falta de documentação, é WAF).

### O que já se sabe

- Base: `https://app.wiven.com.br/api/v1`
- Auth: headers **`x-public-key`** e **`x-secret-key`**, geradas no painel
- Webhook: configurável no painel (Configurações > Webhooks) **ou por API**,
  com `callbackUrl`, por produto e por eventos
- Rate limit: depende do plano contratado
- **Taxa: 5,99% + R$ 1,99** (faixa R$ 0–10k/mês); 4,99% + R$ 1,49 até 100k

### ⚠️ O número que precisa ser encarado antes de escrever código

| | MP (hoje) | Cakto | **Wiven** |
| --- | --- | --- | --- |
| Revelação R$ 9,80 | ~R$ 0,10 · **1%** | R$ 2,49 · 25% | **R$ 2,58 · 26%** |
| Completa R$ 18,90 | ~R$ 0,19 · **1%** | R$ 2,49 · 13% | **R$ 3,12 · 17%** |

Nas duas vendas reais de R$ 15,12 de 20 e 21/08, o Mercado Pago cobrou
**R$ 0,15** cada (líquido R$ 14,97 — conferido no extrato). Pela Wiven seriam
**R$ 12,22**: **R$ 2,75 a menos por venda**.

É a mesma armadilha da Cakto, um pouco pior: a parte fixa destrói ticket
baixo. O dono já viveu isso — foi por causa dos R$ 2,49 que o preço subiu
para 12,90 em 22/08, e as vendas pararam (voltou para 9,80 no mesmo dia).

**Decisão do dono: conectar mesmo assim.** Este documento registra o custo
para que ele seja escolha, não surpresa no extrato.

### Como conectar — o caminho já está pavimentado

A troca de gateway **já foi feita uma vez** (Cakto) e a arquitetura aguenta:

1. **`src/nucleo/checkouts/wiven.ts`** implementando `ProvedorPagamento`:
   `criarPagamento`, `consultarPagamento`, `estornar`,
   `listarPagosNoPeriodo`. Copiar a forma de `cakto.ts`.
2. **Traduzir o status para o vocabulário do sistema.** O resto do projeto
   fala `approved`/`pending`/`rejected` desde o Asaas. `webhook-pagamento.ts`
   não pode ganhar uma linha sobre Wiven.
3. **Achar o `external_reference`.** É o ponto que mais dói: sem um campo
   livre que volte na consulta, o webhook não reencontra o pedido. Na Cakto
   foi o `sck`. **Descobrir isso ANTES de escrever o resto.**
4. **`/api/webhook/wiven`** — rota nova, separada. O webhook do MP continua
   de pé durante a virada.
5. **Registrar no roteador** (`src/nucleo/checkouts/gateway.ts`): basta
   acrescentar `'wiven'` a `NomeDoGateway` e ao `provedorDe`. O roteamento
   por meio (`GATEWAY_PIX` / `GATEWAY_CARTAO`) já existe e vale de graça.
6. **Nasce desligado.** `GATEWAY=mercadopago` até uma compra real de valor
   baixo passar ponta a ponta.

### O que conferir na documentação assim que ela estiver em mãos

- [ ] Existe **sandbox**? (a Cakto não tinha, e isso mudou todo o plano)
- [ ] O corpo aceita **valor livre** ou exige produto/oferta cadastrada?
      (a Cakto exigia oferta — foi o que obrigou `cakto-ofertas.ts`)
- [ ] Qual campo carrega a **nossa referência** e ele volta na consulta?
- [ ] O webhook é **assinado** (HMAC) ou tem segredo no corpo?
- [ ] Prazo de resposta do webhook e política de retentativa
- [ ] **Checkout embutido ou hospedado?** O SPEC 10.3 proíbe redirecionar
      para tela de terceiro — foi o que tirou o Asaas
- [ ] A resposta traz **taxa** por transação? (o painel financeiro depende)
- [ ] `GET` de pedidos aceita **filtro por data**? (a Cakto não aceitava, e a
      reconciliação virou paginação)

---

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
