# Checkpoint — estado da plataforma

> Arquivo de continuidade, não é documentação (essa é `docs/reestruturacao.md`
> e `docs/oraculo.md`). Serve pra retomar depois de compactar contexto.

## Último commit
`f732b00` — test: o caminho do dinheiro novo, travado

385/385 testes, build limpo, árvore limpa. **Nada foi para produção — só
local, sem deploy.**

---

## A virada do modelo de negócio (17/08/2026)

**A Revelação virou grátis.** Deixou de ser o produto (R$ 9,80) e virou a
porta: faz o ritual, descobre o familiar, cria conta. O que se vende agora é
a plataforma, por assinatura.

| | grátis | Revelação | Acompanhamento |
|---|---|---|---|
| preço | 0 | R$ 15,90/mês · R$ 9,90 no anual | R$ 39,90/mês · R$ 29,90 no anual |
| familiar + PDF + imagens | ✅ | ✅ | ✅ |
| leituras do Oráculo | 1/mês | 2/mês | 4/mês |
| mensagens | 10/mês, 1/dia | 30/mês, 1/dia | 60/mês, 2/dia |
| calendário | semana | mês (ano no anual) | mês (rolante no anual) |
| relatório completo, gráficos, narração | — | ✅ | ✅ |
| conselho diário | — | — | ✅ |

Quem já pagou não perde nada: `direitosLegados` lê as FLAGS do produto e
nunca o preço, e o plano `completa` segue ativo. Travado por teste.

---

## O que funciona hoje (verificado)

- **Funil grátis inteiro** — quiz → pula o gateway → entrega em ~6s → conta →
  assinatura `gratuito`. Testado batendo nas rotas HTTP.
- **Compra de plano** — `/planos` → cobrança → checkout → webhook → assinatura.
  Idempotente contra reenvio do Mercado Pago.
- **Oráculo** — leitura ritual (cartas + céu, com animação e som) e mensagem
  curta. Cota de duas travas. Histórico em `/conta/oraculo/historico`.
- **Calendário** — navegação por 12 meses, cadeados no que o plano não abre,
  cores por domínio, frases por dia/semana/mês.
- **Painel inicial** — retrato em 4 eixos, familiar, céu do dia com a lua
  desenhada na fase real.

## Fases
0 ✅ · 1 ✅ · 2 ✅ · 3 🟡 (falta provedor em runtime) · 4 🟡 (falta relocação de
arquivos e fusão do horoscopo.db) · 5 ✅ · 6 ✅ · 7 ✅ · 8 🟡 · 9 ⬜ · 10 ⬜ · 11 ⬜

---

## O que falta

**Fase 8 (Oráculo), para fechar:**
- Os 3 espetáculos que faltam: chama, ossos, dias. **Hoje só há 2, então só
  existem 2 pares ordenados e a leitura repete a partir da terceira.**
- As perguntas-como-cena (o modelo pedindo o que falta)
- Variações de dia de ouro nos espetáculos novos

**Depois:** guia semanal e conselho diário (9) · recorrência automática (10) ·
analytics de MRR/churn/margem (11)

**Pendências antigas:** escolha de provedor de checkout em runtime (3),
relocação de arquivos e fusão do horoscopo.db (4) — as duas exigem teste em
navegador de verdade.

---

## Antes de dar deploy

1. **`OPENAI_API_KEY` e o modelo.** Hoje roda no Gemini. Para trocar pro
   modelo da OpenAI: `provedor: 'openai'` em `src/nucleo/modelos.ts` + a chave
   no `.env`. O adaptador dos dois provedores já está pronto.
2. **Preencher os preços em `modelos.ts`** — estão zerados, e sem eles a
   margem da Fase 11 sai errada.
3. **`APP_SECRET`** no `.env` (só necessário quando `contas_checkout` for usada).
4. Conferir o visual no celular. A área logada nunca foi aberta em aparelho.

## Armadilhas conhecidas
- **Migração aplica no import** (`db.ts` chama `executarMigracoes`): qualquer
  `npm run build` ou `dev` já aplica migração pendente no banco real.
- **Testes não devem fixar preço comercial.** Já quebrou duas vezes: quando os
  planos mudaram e quando a Revelação virou grátis. Testes de mecanismo criam
  planos próprios.
- **Conta de teste**: usar `*@bruxario.local`, nunca a conta do dono — já
  gastei cota real dele sem querer uma vez.
