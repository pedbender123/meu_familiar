# A reforma dos assinantes

Escrito em 01/09/2026, no dia da primeira assinatura paga de verdade.
**Implementado e em produção em 01/09/2026, no mesmo dia.** As cinco etapas da
§4 estão prontas e testadas; o que sobrou está na §7.

O que mudou no banco: migração **038** (campanha, UTM, `renovacao_de` e o
espelho da UTMify em `cobrancas`), **039** (`acesso_enviado_em`) e **040**
(custo de IA em milésimos de centavo — sem ela, o item 4 mediria zero para
sempre).

---

## 1. O que aconteceu hoje

Uma venda de assinatura de R$ 29,90 entrou, cobrada pela Wiven no cartão, com
contrato de recorrência criado. Ela funcionou — e ao procurá-la no painel
apareceram quatro buracos, todos do mesmo tipo: **assinatura existe num canto
separado do resto do sistema.**

| O que se procurou | O que se achou |
| --- | --- |
| A venda na Central | não está: a Central conta `pedidos`, assinatura vive em `cobrancas` |
| A venda na campanha | não está, e não tem como estar: `cobrancas` não guarda `campanha_id` |
| O valor na UTMify | chegou o da primeira cobrança; os meses seguintes ninguém reporta |
| O MRR | contava dez cortesias como receita — **corrigido no mesmo dia** |

Nenhum deles é um bug isolado. São a mesma coisa vista de quatro ângulos: o
funil de produto foi construído inteiro, e o de assinatura foi pendurado ao
lado dele.

---

## 2. O princípio

**Assinatura é venda.** Onde o sistema diz "venda", ela precisa estar.

Isso não significa somar tudo num balde só — receita que se repete e receita
que acontece uma vez são coisas diferentes, e misturá-las é como se comemora
um mês excepcional que não volta. Significa que toda tela que responde "quanto
entrou" precisa responder incluindo assinatura, **com a separação visível**.

---

## 3. As quatro frentes

### 3.1 A venda aparece onde as vendas aparecem

`relatorioDoPeriodo` lê só `pedidos`. Precisa ler também `cobrancas` pagas, e
devolver os dois separados: `vendas` e `assinaturas`, `receitaUnica` e
`receitaRecorrente`.

**O cuidado:** a Central pode somar; a tela de campanha **não pode**, enquanto
a cobrança não tiver atribuição. Somar uma receita sem campanha ao relatório de
uma campanha específica é creditar a ela dinheiro que talvez não seja dela — o
mesmo erro que a atribuição real acabou de consertar do outro lado.

Entregável menor primeiro: um cartão "Assinaturas" na Central, separado.

### 3.2 A assinatura ganha campanha

`cobrancas` não guarda `campanha_id` nem `peca_id`. Quem assina veio de algum
lugar — e hoje esse lugar se perde no caminho entre o pedido e a cobrança.

A atribuição existe: o cookie `bx_at` está no navegador de quem clica em
assinar. Falta gravá-la na cobrança, como já se faz no pedido.

**Só vale para vendas novas.** As antigas não têm como ser recuperadas, e
inventar atribuição para elas seria fabricar histórico.

### 3.3 A UTMify recebe todo mês, não só o primeiro

Hoje `reportarVenda` é chamada no caminho do pedido. A renovação passa pelo
webhook, estende o acesso, e **não reporta nada** — para quem lê o painel
deles, um assinante de seis meses rendeu uma venda.

Precisa reportar a renovação como venda nova, com o mesmo rastreio da original
(a campanha que trouxe a pessoa é a mesma que está pagando o sexto mês).

**A pergunta a decidir:** renovação é venda da campanha ou receita de base? As
duas leituras são defensáveis, e a escolha muda o CPA que a agência vê. É
decisão do dono, não do código — mas o dado precisa existir para permitir as
duas.

### 3.4 Monitorar o que acontece depois da compra

Hoje o sistema sabe que a pessoa pagou e que a chave foi enviada. Não sabe se
ela **entrou**, e não sabe se **usou**.

Isso importa em assinatura de um jeito que não importa em produto avulso: quem
compra um PDF e some já pagou; quem assina e some **cancela no mês seguinte**.
Uso é o único indicador antecedente de churn que existe aqui.

O que medir, por assinante e no agregado:

| Sinal | Responde |
| --- | --- |
| Recebeu o acesso | o e-mail saiu? |
| Entrou alguma vez | ou o acesso morreu na caixa de entrada? |
| Último acesso | está vivo ou já foi embora? |
| Consultas ao Oráculo | está usando o que paga |
| Custo de IA por assinante | **quanto essa pessoa custa por mês** |
| Uso agregado | a plataforma se paga no agregado? |

O custo de IA é o que fecha a conta: `custo_ia_centavos` já existe por pedido,
mas assinatura consome por uso, todo mês, sem pedido novo. Um assinante de
R$ 29,90 que gasta R$ 40 de IA é prejuízo com cara de crescimento — e hoje
nada mostraria isso.

---

## 4. A ordem — feita

1. ✅ **Cartão de assinaturas na Central.** Quatro cartões: assinaturas novas,
   renovações, receita de assinatura e "entrou no total". `relatorioDoPeriodo`
   passou a ler `cobrancas` pagas por `pago_em` — a data em que o dinheiro
   entrou, não a em que a cobrança nasceu. Aparecem mesmo em zero: esconder
   quando não há nada é o que faria a receita voltar a ser invisível no mês
   em que ela parasse.
2. ✅ **Atribuição na cobrança** (migração 038). `/api/oferta/[id]/comprar`
   herda a atribuição **do pedido** — inclusive o `utm_json` cru; a rota de
   dentro do app lê os cookies. Só vale para venda nova: o que é anterior tem
   a coluna nula e não aparece em campanha nenhuma, que é a resposta honesta.
3. ✅ **Renovação reportada à UTMify.** A renovação virou uma linha de
   `cobrancas` (`renovacao_de` aponta para a raiz), com valor, taxa e
   transação — e é reportada como venda própria. `waiting_payment` também vai,
   do ponto em que o meio de pagamento é conhecido, senão não há denominador
   de conversão.

   Descoberta no caminho: **nenhuma assinatura jamais tinha sido reportada.**
   O ramo da cobrança retorna antes de chegar ao `reportarVenda` do pedido —
   não era só a renovação que faltava, era a primeira também.
4. ✅ **Painel do assinante** (`nucleo/uso-do-assinante.ts`). Três estados de
   acesso na tabela (chave não saiu / não entrou / data do último acesso),
   uso, custo de IA no mês, e vermelho em quem custa mais do que paga. Em
   cima, quatro cartões: nunca entraram, entraram e não usaram, sumidos há
   mais de 14 dias, e o custo de IA como percentual do MRR.

   **O que quase passou:** o custo por assinante nasceu estruturalmente zero.
   Uma consulta ao Oráculo custa 0,17 centavo, `custo_centavos` é inteiro, e
   0,17 arredondado é zero — as sete leituras que existiam em produção somavam
   R$ 0,00. Não era imprecisão: era a informação inteira desaparecendo antes
   de entrar na soma. Migração 040 guarda em milésimos e refaz a conta do
   histórico a partir dos tokens, que sempre estiveram gravados.

   Catorze dias porque o ciclo é de trinta: quem sumiu há duas semanas ainda
   dá tempo de reconquistar antes da renovação. Um mês inteiro de silêncio já
   é o cancelamento, só que ainda não digitado.
5. ✅ **Assinatura no relatório de campanha.** ROAS, lucro, custo por venda e
   conversão passaram a incluí-la — deixá-la de fora fazia a campanha que
   vende plano aparecer com uma fração do resultado que teve, e a decisão que
   sai de um ROAS subestimado é pausar o que está funcionando. A separação
   fica na linha logo abaixo: avulsas, novas, renovações e quanto da receita
   bruta é assinatura.

**A decisão que ficou aberta de propósito:** renovação é venda da campanha ou
receita de base? A tela hoje soma as duas, com o detalhe visível. `renovacao_de`
existindo permite separar a qualquer momento — o que não dava para fazer era
decidir sem o dado.

---

## 5. O que já foi feito hoje, e não precisa ser refeito

- A cobrança de assinatura passa pelo roteador de gateway (era Mercado Pago fixo)
- Recorrência de verdade na Wiven, cartão, com o contrato guardado
- A renovação se reencontra pelo contrato, com transação nova e identificador
  que não é o nosso
- Renovação idempotente — um reenvio de webhook dava um mês de graça
- MRR conta só quem pagou

---

## 6. A régua

O plano acabou quando o dono puder abrir a Central, ver quanto entrou de
assinatura no mês, saber de qual campanha veio, e — abrindo um assinante —
dizer se aquela pessoa está usando o que paga e quanto ela custa.

E quando a agência, no painel dela, vir a renovação do sexto mês aparecer
sozinha.

---

## 7. O que sobrou

- **`gateway` na cobrança.** `plataformaDe` sai do pedido; em assinatura o
  nome vai fixo (`Wiven`, ou `UTMIFY_PLATAFORMA`). Enquanto só a Wiven cobrar
  recorrência, está correto — e passa a mentir no dia em que não for.
- **Uso por assinante ao longo do tempo.** Hoje a tela responde "está usando?"
  e "custa quanto?". Não responde "está usando MENOS que no mês passado", que
  é o sinal mais cedo de todos.
- **Aviso ativo.** Os três estados de saída aparecem em quem abre a tela.
  Ninguém é avisado. É a mesma Fase 4 de `PLANO-PAINEL-DE-SAUDE.md`.
- **As 8 cortesias de 20/08** continuam com acesso. Elas não somam receita
  desde a correção do MRR, e agora aparecem marcadas na lista. Tirar o acesso
  de gente real é decisão do dono, não do código.
