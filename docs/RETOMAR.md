# Prompt de retomada — cole isto depois de compactar

Atualizado em 01/09/2026.

**Tudo que está descrito aqui está em produção.**
`docs/PLANO-REFORMA-ASSINANTES.md` foi implementado inteiro — migrações 038,
039 e 040. O que sobrou está na §7 dele, mais o `.html` do funil para o
marketing.

`products` da Wiven foi **abandonado a pedido do dono** — a assinatura usa as
rotas próprias (`/gateway/card/subscription`), que não precisam de catálogo.

---

## O que dizer

> Leia `docs/RETOMAR.md`. A reforma dos assinantes está pronta e não subiu.
>
> Aberto: o `.html` do funil para o marketing, a §7 de
> `PLANO-REFORMA-ASSINANTES.md`, a §8 de `PLANO-FLUXO-UTM.md` e a Fase 4 de
> `PLANO-PAINEL-DE-SAUDE.md`.

---

## Onde as coisas estão

- **Local:** `/home/pedro/Área de trabalho/Micro_Projects/meu_familiar`
- **Produção:** `ssh root@100.126.229.42` → `/root/apps/bruxario`
  (só pela tailnet; a chave já está no agente)
- **Site:** `bruxario.com.br` · pm2 `bruxario` · porta 3000
- **Teste:** `teste.bruxario.com.br` → `/root/apps/bruxario-teste`,
  pm2 `bruxario-teste`, porta **3003** (a 3001 do plano já era de outra app).
  Fechado por senha (`bruxo`), fora dos buscadores, banco próprio e vazio.
  **`/api/webhook/` passa SEM senha de propósito** — gateway não sabe fazer
  basic auth, e sem essa exceção toda cobrança de teste leva 401 e nunca
  confirma. O `.env` dele tem `MP_MODO=teste` e `UTMIFY_TESTE=1`, então o que
  se faz ali não suja o relatório de ninguém.
- **Banco:** `var/data/bruxario.db` (SQLite, better-sqlite3). Os dois são
  arquivos separados porque o `cwd` de cada processo é outro.

## Deploy

```bash
scripts/subir.sh teste       # espelha o local no teste
scripts/subir.sh producao    # pede confirmação escrita
```

Ele envia por `rsync` (nunca `.env`, nunca `var/`), faz backup do banco,
`npm ci`, `npm run build` e `pm2 restart`. O git da VPS **mente** sobre o que
está no ar, porque o deploy sempre foi por cópia de arquivo — a fonte da
verdade é a árvore local.

## Deploy à mão (o que o script faz)

```bash
scp <arquivos> root@100.126.229.42:/tmp/
ssh root@100.126.229.42 'cd /root/apps/bruxario \
  && cp var/data/bruxario.db /root/backups-deploy/bruxario-$(date +%Y%m%d-%H%M%S).db \
  && mv /tmp/<arquivo> <destino> \
  && npm run build \
  && pm2 restart bruxario --update-env'
```

- **`npm run build` APLICA MIGRAÇÕES no banco real.** Backup antes, sempre.
- Variável `NEXT_PUBLIC_*` só vale depois de novo build.
- Mudança só de `.env` (sem `NEXT_PUBLIC_`): basta `pm2 restart --update-env`.
- Antes de commitar, conferir `git check-ignore .env` — ele é ignorado e
  **nunca** pode entrar no commit.

## Comandos

`npm test` (892 passando) · `npm run build` · `npx tsc --noEmit`
`npm run wiven-fumaca` — cobrança Pix real de R$ 5 contra a API da Wiven

---

## Estado de produção agora

| | |
| --- | --- |
| `GATEWAY` | `wiven` (Mercado Pago é a queda automática) |
| `WIVEN_SPLITS` | **vazio desde 01/09** — tudo cai na conta que cobra (Murilo). A linha antiga está comentada logo acima dela no `.env` |
| `WIVEN_PRODUCER_DO_DONO` | preenchido, mas sem efeito enquanto não houver split |
| `NEXT_PUBLIC_META_PIXEL_ID` | **vazio de propósito** — só a UTMify fala com a Meta |
| `UTMIFY_API_TOKEN` | preenchido · `UTMIFY_TESTE=0` |
| `desconto_visivel` | interruptor ausente = preço riscado escondido |
| `IP_AUTORIZADO` | `72.61.133.109` — o IP de saída da VPS, que a tela de Saúde vigia |

Todas as credenciais estão no `.env` das duas máquinas. **Nunca colar valor de
token no chat** — basta citar o nome da variável.

## Wiven — criado no painel em 28/08

| | Código |
| --- | --- |
| Produto normal | `cmtgczcd20tad01o7u7qd8h9s` |
| Produto assinatura | `cmt6oods718b501ogyvwtdrhu` |
| Oferta Simples | `Z8O1Z1Y` |
| Oferta Completa | `5TWJNHQ` |
| Oferta Upgrade | `XB1T1D1` |
| Oferta Assinatura | `L8RNDJR` |

**Nada disso está em uso.** A coprodução 40/40/20 segue configurada nos
produtos e nunca cobrou nada; os preços das ofertas são os antigos. Ficam
registrados caso o catálogo volte a fazer sentido.

**Preços de verdade** (em `modelo-de-venda.ts`, e no banco para os planos):
Simples R$ 18,90 · Completa R$ 24,90 · Assinatura R$ 29,90/mês.

---

## Regras que não se discutem

- **Só o webhook libera acesso.** Resposta síncrona nunca entrega.
- **Preço passa por `produtoVigente`/`precoVigenteCentavos`**, nunca pela
  tabela estática (`produtos.ts` tem a Revelação zerada).
- **Migração aplicada não se edita** — corrige-se com uma nova. Aconteceu na
  031/032 e está documentado lá.
- **`splits` e coprodução nunca ligados juntos** — descontam duas vezes.
- **`splits` não existe nas rotas de assinatura da Wiven.** A documentação dos
  dois endpoints não lista o campo. Quando o repasse voltar, a divisão da
  assinatura precisa ser resolvida com eles.
- **Renovação de assinatura é idempotente pela transação.** A Wiven reenvia o
  webhook até receber 200, e sem isso cada reenvio dava um mês de graça.
- **O riscado é decoração** (`PRECO_RISCADO_CENTAVOS`). Nunca entra em conta,
  e se for exibido numa tela nova precisa ser um preço que a loja praticou —
  preço de referência que nunca existiu é publicidade enganosa.
- **Reenviar venda para a UTMify gera um `Purchase` novo na Meta.** Foi o que
  inflou o contador para 17. Corrigir no banco sem reenviar, ou aceitar.
- **Não martelar a API da Wiven.** Excesso de chamadas disparou proteção
  antiautomação em 24/08 e derrubou o checkout por 26 horas. A chave tem lista
  de IPs autorizados: só o IP da VPS.
- **Cache de borda na consulta da Wiven:** `GET /gateway/transactions` é
  servido pelo CloudFront e mente sobre o status. `furarCache()` em
  `wiven.ts` contorna; não remover.

## Armadilhas já pagas caro

- A Wiven fala **três vocabulários de dinheiro** (`fee` na criação,
  `commissionAmount` no webhook, `chargeAmount`/`amount` na consulta) e
  **dois de status** (`OK` na criação, `COMPLETED` no webhook).
- `OK` na criação do Pix **não** é venda paga.
- `transaction.identifier` é anulável — a busca tem dois caminhos.
- A Wiven **não** avisa a UTMify em cobrança por API. Quem avisa somos nós.

---

## O que mudou em 01/09 (o dia mais longo)

**Tudo abaixo está em produção.** 865 testes.

- **Preço desmembrado do riscado.** Simples R$ 18,90, Completa R$ 24,90,
  Assinatura R$ 29,90 — o número no código É o preço. O riscado (29,90 /
  39,90 / 39,90) é decoração em `PRECO_RISCADO_CENTAVOS`, não entra em conta
  nenhuma. `LANCAMENTO20` desativado no banco.
- **Splits desligados** — tudo cai na conta que cobra. A linha está comentada
  no `.env`, então voltar é descomentar e reiniciar.
- **Assinatura recorrente de verdade** na Wiven (`/gateway/card/subscription`),
  só cartão. A renovação se reencontra pelo contrato e é idempotente.
- **A cobrança de assinatura passou pelo roteador de gateway** — era Mercado
  Pago fixo, e o split nunca teria incidido sobre assinatura.
- **Atribuição real nas campanhas**: o relatório conta só quem chegou marcado.
  A "Comeccou!" saiu de 2,9% para 8,2% de conversão — parecia três vezes pior.
- **`/painel/midia`**: campanha → conjunto → criativo, com os IDs da Meta.
- **Visão de vendedor** (na barra lateral): Central, Campanhas e Mídia.
- **UTMify recebe os três campos**: preço cheio, taxa do gateway, lucro.
- **MRR conta só quem pagou** — contava dez cortesias como receita.

### Bugs achados em produção, todos corrigidos

| | |
| --- | --- |
| Teto de **99 peças** por campanha | escalando, o 100º anúncio perdia o criativo em silêncio |
| **URL de callback duplicada** | venda paga sem confirmação, 404 seis vezes (só no teste) |
| **Renovação somava 30 dias por reenvio** | um pagamento deu 120 dias de acesso |
| **"pedido não encontrado"** ao assinar | checkout com rota fixa em `/api/pedido/` |
| `clientIp` e CEP | a Wiven recusava a assinatura; o endpoint dela valida mais rígido |
| Redirecionamento para **localhost** | `req.url` atrás do nginx; já tinha acontecido no login |

---

## A reforma dos assinantes — 01/09, em produção

Migrações **038** (campanha, UTM, `renovacao_de` e o espelho da UTMify em
`cobrancas`), **039** (`acesso_enviado_em`) e **040** (custo de IA em
milésimos de centavo). 892 testes.

- **A renovação virou uma linha de cobrança.** Antes ela empurrava
  `assinaturas.fim` e sumia: nenhum valor, nenhuma transação. Um assinante de
  seis meses tinha uma única linha de dinheiro no banco.
- **Nenhuma assinatura jamais foi reportada à UTMify.** O ramo da cobrança
  retorna antes de chegar ao `reportarVenda` do pedido — não faltava só a
  renovação, faltava a primeira também. Agora vão as duas, mais o
  `waiting_payment`.
- **A cobrança guarda de onde veio.** A tela de oferta herda a atribuição do
  PEDIDO, `utm_json` incluído; a rota de dentro do app lê os cookies.
- **Assinatura entra no ROAS da campanha**, com a separação visível na tela.
- **A tela de assinantes responde entrou / usou / custou**, com vermelho em
  quem custa mais de IA do que paga por mês.

Regras novas que saíram daqui:

- **`renovacao_de` aponta sempre para a cobrança RAIZ**, nunca para a
  renovação anterior — senão separar recorrente de primeira venda exigiria
  percorrer a cadeia.
- **A renovação NÃO carrega `assinatura_externa_id`.** `cobrancaDoContrato`
  pega a mais recente do contrato; preenchê-lo faria a renovação achar a si
  mesma no mês seguinte.
- **Receita de assinatura conta por `pago_em`**, não por `criado_em`.
- **Custo de consulta ao Oráculo mora em `custo_microcentavos`.** Uma consulta
  custa 0,17 centavo, e `custo_centavos` arredondava cada uma para zero antes
  da soma — as sete leituras de produção somavam R$ 0,00. Somar na unidade
  menor e arredondar só no fim. `custo_centavos` continua existindo e continua
  sendo zero para leitura: é a verdade arredondada, não um bug a consertar.

---

## O que mudou em 30/08

- **`teste.bruxario.com.br` existe**, com banco próprio e vazio, e
  `scripts/subir.sh` virou o único caminho de deploy.
- **`/painel/saude`**: sinais vitais do fluxo em cinco grupos, cada linha ruim
  com a frase que resolve. Bolinha no menu e faixa vermelha na Central quando
  há o que dizer. Os cinco incidentes de agosto viraram um teste cada.
- **Campanha e peça nascem do `utm_campaign`/`utm_content`** (migração 033). O
  `?c=` continua existindo e ganha quando os dois vêm juntos.
- **O relatório para a UTMify passou a ser espelho**: vai o ID cru da Meta,
  não o nome interno — era isso que criava duas identidades para a mesma
  campanha no painel deles.
- **O script da UTMify não roda mais no `/painel` nem no `/conta`.** Cada vez
  que você abria a Central, era uma visita sem UTM no relatório da agência.
- 778 testes passando (eram 735).

**Produção ainda não recebeu nada disto.** O deploy foi recusado porque eu
estava respondendo sozinho à confirmação que o script pede — que é
exatamente para o que ela existe. É você quem roda `scripts/subir.sh` com o
alvo de produção. Junto vai o `desconto_visivel` (preço riscado escondido),
que já estava commitado e nunca subiu.

---

## O que eu (Claude) preciso pedir, e não tenho

Nada bloqueia começar. Mas em algum ponto vou precisar:

1. **A documentação do endpoint de cobrança da Wiven** — a página com o
   exemplo do corpo da requisição, copiada e colada, ou um print da parte de
   `products`. É o único bloqueio real que sobrou: sem ela não dá para apontar
   a cobrança para produto e oferta, e chutar campo de API de pagamento
   derruba o checkout. A doc deles responde 403 a tudo que não é navegador, e
   os HTMLs salvos na raiz do projeto são só a casca do SPA — não têm texto
   nenhum dentro.

   A Fase 2 já está armada esperando: `var/wiven-formato.jsonl` grava o
   formato de cada webhook (nomes de campo, e os valores de
   `offerCode`/`products`/`subscription` — nunca dado de cliente). A próxima
   venda real responde as três perguntas sozinha.
2. **Confirmação da oferta de assinatura**: a tela mostrava recorrência
   R$ 29,90 e primeira cobrança R$ 29,00. Se for para bater, corrigir no
   painel.
3. **Acesso de leitura ao painel da UTMify**, ou prints — para conferir se o
   que mandamos aparece onde deveria. Hoje eu só sei que a API respondeu
   `SUCCESS`, e `SUCCESS` não quer dizer "apareceu na campanha".
