# Uma tela que responde "está tudo de pé?"

Escrito em 30/08/2026. **Nada aqui foi implementado ainda.**

---

## 1. O problema

Nas últimas duas semanas, toda falha deste sistema foi descoberta do mesmo
jeito: **o dono percebeu que um número estava errado e me chamou.**

- A Wiven passou 26 horas devolvendo 403 e o checkout teria parado. Ninguém
  saberia até um cliente reclamar que não consegue pagar.
- A venda de 27/08 entrou na UTMify como venda direta. Só apareceu porque o
  dono foi procurar e não achou.
- O split apareceu como taxa de gateway por três dias. Descoberto porque o
  dono estranhou o lucro.
- O pixel da Meta ficou com a variável vazia. Descoberto quando ele reparou
  que nenhum evento chegava.
- Depois, o mesmo pixel contou 17 vendas onde havia 5. Descoberto olhando o
  Ads Manager.

Nenhuma dessas coisas apareceu num alarme. Todas apareceram no olho de quem
tem outra coisa para fazer.

O sistema **já sabia** de quase todas: o log tinha `token não confere` oito
vezes, o `403` estava lá, o `taxa=1257` estava gravado no banco. A informação
existia e não tinha para onde ir.

---

## 2. O que a tela precisa responder

Uma pergunta, em três segundos, sem interpretar nada:

> **Está tudo de pé, e o dinheiro está chegando onde deveria?**

Não é um painel de métricas — esse já existe. É um painel de **sinais
vitais**: cada peça do fluxo com uma luz, e a luz vermelha dizendo o que
fazer.

---

## 3. As peças, e como saber que cada uma está viva

### 3.1 Cobrança

| Sinal | Como medir | Vermelho quando |
| --- | --- | --- |
| Gateway ativo | `gatewayDe()` por meio | — (informativo) |
| Wiven responde | a sonda que já existe (`sondarWiven`) | última sonda falhou |
| Disjuntor | `segundosAteVoltar('wiven')` | há gateway em quarentena |
| Cobrança criada | pedidos com `pagamento_id` nas últimas 24h | tentativas > 0 e nenhum id |

O disjuntor e a sonda **já guardam esse estado na memória** — falta só
mostrá-lo. É a peça mais barata do plano inteiro.

### 3.2 Entrega

| Sinal | Vermelho quando |
| --- | --- |
| Pedidos pagos e não entregues | algum há mais de 15 min |
| Pedidos travados em `gerando` | algum além de `GERACAO_MORTA_APOS_MS` |
| Webhook recebido | nenhuma notificação há mais de 24h **com venda no período** |

A terceira é a que teria pego a Wiven fora do ar: silêncio de webhook não é
prova de silêncio de vendas — é suspeita.

### 3.3 Rastreio

| Sinal | Vermelho quando |
| --- | --- |
| Pedidos sem campanha | mais de X% nas últimas 24h |
| Pedidos sem UTM | idem, e é o que denuncia link de anúncio sem macro |
| Pixel da UTMify na página | variável vazia |
| Nosso pixel da Meta | **ligado junto com o da UTMify** — é dupla contagem |

A última é literalmente o bug das 17 vendas, virado alarme.

### 3.4 Relatório

| Sinal | Vermelho quando |
| --- | --- |
| Último envio aceito à UTMify | falhou, ou nenhuma venda reportada com venda no período |
| Taxa proporcional | taxa > 30% do bruto numa venda |
| Split conferido | `bruto − taxa − split ≠ líquido` |

A "taxa proporcional" é o alarme que teria pego o split contado como taxa: 66%
de custo de gateway não é um número plausível, e um computador sabe disso.

### 3.5 Contas e credenciais

| Sinal | Vermelho quando |
| --- | --- |
| Credenciais da Wiven | a sonda voltar 401/403 |
| IP autorizado | o IP público mudar em relação ao cadastrado |
| Token do webhook | vazio |
| Token da UTMify | vazio |

O IP é o mais silencioso de todos: a chave da Wiven tem lista de IPs
autorizados, e o dia em que a VPS mudar de IP a cobrança para com 403 sem
nenhum aviso prévio.

---

## 4. Como construir

### 4.1 Onde mora

`/painel/saude`, com o resumo — **quantos vermelhos** — carimbado na
`/painel/central`. Ninguém abre uma tela para descobrir que está tudo bem; a
tela existe para quando não está, e o caminho até ela precisa ser um número
piscando em outra tela que já se abre todo dia.

### 4.2 A forma de cada sinal

Um tipo só, e ele é o que faz a tela ser útil em vez de decorativa:

```
nome        o que é, em português
estado      ok | atencao | quebrado | desconhecido
valor       o número medido, quando existe
desde       há quanto tempo está assim
oQueFazer   a frase que resolve
```

**`oQueFazer` não é opcional.** Um alarme que diz "webhook parado" e não diz
"confira WIVEN_WEBHOOK_TOKEN no .env" é um alarme que vai me chamar às 3h da
manhã. O objetivo desta tela é o dono resolver sozinho o que dá para resolver
sozinho.

### 4.3 `desconhecido` é um estado de primeira classe

Sem venda no período, "0 vendas reportadas" não é falha — é falta de dado.
Pintar isso de vermelho ensina a ignorar vermelho, e alarme ignorado é pior
que alarme nenhum. É o erro mais comum em painel de saúde e o mais caro.

### 4.4 A Sentinela já existe

`src/nucleo/sentinela/` já roda invariantes e tem `resumoDaFilaCapi` e
`checarValorCobrado`. Esta tela é a **cara** dela, não um sistema paralelo. Os
sinais novos entram como invariantes lá, e a tela lê o resultado.

Duplicar seria criar duas verdades sobre a saúde do mesmo sistema — e o dia em
que discordassem, ninguém saberia qual acreditar.

---

## 5. As fases

1. **A tela, com o que já é medível sem nada novo:** sonda, disjuntor,
   pedidos travados, variáveis vazias. Isso sozinho teria pego três dos cinco
   incidentes das últimas semanas.
2. **Os alarmes de proporção:** taxa alta demais, split que não fecha,
   pedidos sem campanha. São contas sobre dado que já está no banco.
3. **O carimbo na `/painel/central`**, que é o que faz a tela ser vista.
4. **O aviso ativo** — e-mail ou push quando um sinal vira vermelho, para as
   falhas que acontecem enquanto ninguém está olhando. Última fase de
   propósito: alarme que dispara errado ensina a ignorar, então ele só entra
   depois de as regras terem passado um tempo sendo observadas na tela.

---

## 6. O que esta tela não é

**Não é métrica de negócio.** Vendas, receita, conversão e funil já têm lugar.
Misturar as duas coisas faz o vermelho de "a Wiven caiu" competir por atenção
com "as vendas caíram hoje" — e são urgências de natureza diferente.

**Não é log.** O log tinha oito `token não confere` e ninguém viu. Uma tela
que exige leitura de log falhou antes de começar.

---

## 7. A régua

Está pronta quando, para cada um dos cinco incidentes das últimas duas
semanas, existir uma linha nesta tela que teria ficado vermelha **antes** de o
dono perceber sozinho.

É uma régua verificável: os cinco estão listados na §1.
