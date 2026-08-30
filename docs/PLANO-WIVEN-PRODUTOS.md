# A adaptação: o fluxo burro na frente, o nosso atrás

Escrito em 28/08/2026. **Nada aqui foi implementado ainda.**

---

## 1. A frase que o dono quer poder dizer

> "A UTMify está conectada e funcionando. A Wiven está conectada e mandando
> as vendas pra ela."

Duas frases, sem asterisco, sem "mas". É essa a régua do plano inteiro.

Hoje ele não pode dizer isso, porque a verdade é: *"a Wiven não manda, quem
manda é o meu sistema, e ele manda porque eu adaptei o rastreio interno para
suprir o UTM que o link não trazia."* Tudo verdade, tudo irrelevante para
quem compra mídia, e tudo virando conversa que não devia existir.

---

## 2. O princípio: dois trilhos, um visível

O rastreio deste projeto é melhor que o padrão do mercado — atribuição de um
ano, funil por criativo, escolha de gateway por campanha, disjuntor de
gateway. **Nada disso sai.**

Mas ele deixa de ser o trilho por onde a informação viaja para fora. Passa a
ser o trilho de dentro: o que sustenta as nossas decisões, o painel, a
reconciliação e o resgate de carrinho.

| | Trilho de fora (deles) | Trilho de dentro (nosso) |
| --- | --- | --- |
| Rastreio | UTMify, pixel padrão | `bx_at`, `toques`, marcos |
| Identidade da campanha | `utm_campaign` da Meta | `campanha_id` |
| Venda → UTMify | **Wiven, por produto** | nosso envio, em silêncio |
| Venda → Meta | UTMify | nada |
| Divisão do dinheiro | coprodução no painel | `WIVEN_SPLITS` desligado |

A regra: **quando o trilho de fora funcionar, o de dentro cala a boca** — mas
continua rodando, medindo e pronto para reassumir.

---

## 3. O que já existe na Wiven

Criado por Pedro em 28/08:

| | Código |
| --- | --- |
| Produto normal | `cmtgczcd20tad01o7u7qd8h9s` |
| Produto assinatura | `cmt6oods718b501ogyvwtdrhu` |

| Oferta | Código | Preço |
| --- | --- | --- |
| Simples | `Z8O1Z1Y` | R$ 9,80 |
| Completa | `5TWJNHQ` | R$ 18,90 |
| Upgrade | `XB1T1D1` | R$ 4,90 |
| Assinatura | `L8RNDJR` | R$ 29,90/mês |

**Conferir na oferta de assinatura:** a tela mostrava "valor da recorrência
R$ 29,9" e "valor da primeira cobrança R$ 29". Se for para cobrar 29,90 desde
a primeira, os dois campos precisam bater — um centavo de diferença na
primeira cobrança vira divergência permanente na conciliação.

---

## 4. As fases

Cada uma é entregável sozinha e reversível sozinha.

### Fase 1 — a cobrança aponta para o produto

Mandar `products` no corpo da cobrança, com o id do produto e o código da
oferta correspondente ao que a pessoa está comprando.

O mapa mora ao lado dos preços, em `modelo-de-venda.ts`, e não espalhado:
produto interno → `{ produtoWiven, ofertaWiven }`. Um lugar só decide preço e
identidade externa, como já é a regra aqui.

**Ainda sem mexer no split.** Esta fase só faz a venda passar a existir como
venda de produto do lado deles.

### Fase 2 — o teste que decide o resto

Uma compra real da Completa. Três perguntas, e as respostas mudam tudo que
vem depois:

1. **O `offerCode` volta preenchido no webhook?** Hoje vem nulo. Se voltar, dá
   para gravar qual oferta a pessoa comprou — e aí o relatório interno passa a
   falar a mesma língua do painel deles.
2. **A coprodução dividiu sozinha?** Se sim, `WIVEN_SPLITS` está aposentado.
   Se não, a divisão por API continua sendo a única que funciona.
3. **A UTMify recebeu da Wiven?** É a pergunta que justifica a migração
   inteira.

Enquanto o teste não passar, **nada é desligado**. O que paga hoje continua
pagando.

### Fase 3 — desligar o nosso envio, se o deles funcionar

Se a resposta 3 for sim, `UTMIFY_PULAR_WIVEN=1` — o interruptor já existe.
Nosso envio da venda paga cala; o `waiting_payment` continua, porque a Wiven
não manda pré-venda e é ele que dá o denominador da conversão.

Se a resposta for não, o interruptor fica desligado e nós seguimos mandando —
e a frase da §1 passa a ser "a UTMify está conectada e funcionando", só.

### Fase 4 — trocar `splits` por coprodução

Só se a resposta 2 for sim. `WIVEN_SPLITS` esvaziado no mesmo restart em que a
coprodução assume.

**As duas nunca podem estar ligadas juntas.** Split por API e coprodução por
produto descontariam da mesma venda, e o dinheiro sairia dobrado. É o risco
mais caro deste plano inteiro e merece uma conferência explícita no extrato
depois da primeira venda.

### Fase 5 — campanha e criativo nascendo do UTM

Independente das anteriores, e é o que tira o painel do Bruxário do caminho
deles de vez: `utm_campaign` e `utm_content` passam a criar campanha e peça
automaticamente, com o ID da Meta como chave, renomeáveis depois.

Detalhado em `docs/PLANO-FLUXO-UTM.md`.

---

## 5. O que fica desligado, e por que não é apagado

| O quê | Estado | Por que fica |
| --- | --- | --- |
| Preço riscado no checkout | escondido (`desconto_visivel`) | Black Friday e resgate vão querer de volta |
| Nosso pixel da Meta | desligado (env vazia) | se a UTMify falhar, é o único caminho que resta |
| Fila CAPI | enfileira, não envia | o dia em que houver token, ela liga sozinha |
| `WIVEN_SPLITS` | ligado até a Fase 4 | é o que paga hoje |
| Rastreio por `?c=` | ativo | link de bio, indicação, teste interno |
| Escolha de gateway por campanha | ativa | é o que separa a conta do dono da conta da agência |

Nada disso é dívida técnica: é **plano B ligado à tomada**. A diferença entre
código morto e rede de segurança é ter escrito por que ele existe — e é isto
aqui.

---

## 6. O que pode dar errado

**A oferta não existir em cobrança por API.** O `offerCode` é descrito como
"vendas via checkout interno". Se ele continuar nulo, a alternativa é o
checkout hospedado deles — e aí a pessoa sai da nossa tela no meio do ritual,
que é exatamente o que tirou o Asaas (SPEC 10.3). **Essa troca é decisão do
dono, não do código.**

**O preço do produto brigar com o nosso.** Nossos preços mudam sem deploy. Se
a Wiven exigir que a cobrança bata com o preço da oferta, essa alavanca fecha
e passa a existir cadastro a manter em dois lugares. Medir antes de migrar o
resto.

**Coprodução e split juntos.** Já dito, e vale repetir: dinheiro dobrado.

**A assinatura.** Rota própria (`/gateway/subscriptions`), ciclo próprio,
webhook com `subscription` preenchido — nada disso foi exercitado ainda. É a
fase que merece ser a última.

---

## 7. A régua final

O plano acabou quando o dono puder dizer as duas frases da §1 e elas forem
verdade — e quando, se alguém desligar a UTMify amanhã, ele descobrir pelo
nosso painel antes de descobrir pelo extrato.
