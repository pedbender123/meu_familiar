# Prompt de retomada — cole isto depois de compactar

Atualizado em 30/08/2026, à noite.

**O que foi feito:** o ambiente de teste, o painel de saúde (fases 1–3) e o
fluxo UTM (§4 inteiro do plano). **O que falta:** `products` na cobrança da
Wiven, travado por falta da documentação deles — ver o fim deste arquivo.

---

## O que dizer

> Leia `docs/RETOMAR.md`. O que falta está na §8 de `PLANO-FLUXO-UTM.md` e na
> Fase 4 de `PLANO-PAINEL-DE-SAUDE.md`.

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

`npm test` (778 passando) · `npm run build` · `npx tsc --noEmit`
`npm run wiven-fumaca` — cobrança Pix real de R$ 5 contra a API da Wiven

---

## Estado de produção agora

| | |
| --- | --- |
| `GATEWAY` | `wiven` (Mercado Pago é a queda automática) |
| `WIVEN_SPLITS` | `<joão>:40,<pedro>:20` — o resto fica com a conta que cobra |
| `WIVEN_PRODUCER_DO_DONO` | o producerId do Pedro (sai do lucro reportado) |
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
| Oferta Simples (9,80) | `Z8O1Z1Y` |
| Oferta Completa (18,90) | `5TWJNHQ` |
| Oferta Upgrade (4,90) | `XB1T1D1` |
| Oferta Assinatura (29,90) | `L8RNDJR` |

Coprodução 40/40/20 configurada nos produtos. **Ainda não usada em cobrança
nenhuma** — hoje quem divide é `WIVEN_SPLITS`.

---

## Regras que não se discutem

- **Só o webhook libera acesso.** Resposta síncrona nunca entrega.
- **Preço passa por `produtoVigente`/`precoVigenteCentavos`**, nunca pela
  tabela estática (`produtos.ts` tem a Revelação zerada).
- **Migração aplicada não se edita** — corrige-se com uma nova. Aconteceu na
  031/032 e está documentado lá.
- **`splits` e coprodução nunca ligados juntos** — descontam duas vezes.
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
