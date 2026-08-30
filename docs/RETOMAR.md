# Prompt de retomada — cole isto depois de compactar

Estado congelado em 30/08/2026. Os três planos estão escritos e **nada deles
foi implementado**.

---

## O que dizer

> Vamos implementar os planos em `docs/`. Comece lendo, nesta ordem:
> `PLANO-PAINEL-DE-SAUDE.md`, `PLANO-WIVEN-PRODUTOS.md` e
> `PLANO-FLUXO-UTM.md`. Comece pela Fase 1 de **[qual]**.

---

## Onde as coisas estão

- **Local:** `/home/pedro/Área de trabalho/Micro_Projects/meu_familiar`
- **Produção:** `ssh root@100.126.229.42` → `/root/apps/bruxario`
  (só pela tailnet; a chave já está no agente)
- **Site:** `bruxario.com.br` · pm2 `bruxario` · porta 3000
- **Banco:** `var/data/bruxario.db` (SQLite, better-sqlite3)

## Deploy (não há script)

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

`npm test` (735 passando) · `npm run build` · `npx tsc --noEmit`
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

## O que eu (Claude) preciso pedir, e não tenho

Nada bloqueia começar. Mas em algum ponto vou precisar:

1. **O resultado do teste da Fase 2** do plano de produtos — uma venda real
   com `products` e sem `splits`, para saber se `offerCode` volta, se a
   coprodução divide e se a UTMify recebe da Wiven.
2. **Confirmação da oferta de assinatura**: a tela mostrava recorrência
   R$ 29,90 e primeira cobrança R$ 29,00. Se for para bater, corrigir no
   painel.
3. **Acesso de leitura ao painel da UTMify**, ou prints — para conferir se o
   que mandamos aparece onde deveria. Hoje eu só sei que a API respondeu
   `SUCCESS`, e `SUCCESS` não quer dizer "apareceu na campanha".
