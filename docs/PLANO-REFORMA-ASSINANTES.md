# A reforma dos assinantes

Escrito em 01/09/2026, no dia da primeira assinatura paga de verdade.
**Nada aqui foi implementado.**

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

## 4. A ordem

1. **Cartão de assinaturas na Central** — a receita para de estar invisível.
2. **Atribuição na cobrança** — sem isso, nada do resto pode ser por campanha.
3. **Renovação reportada à UTMify** — o painel deles para de subestimar.
4. **Painel do assinante** — entrou, usou, custou.
5. **Assinatura no relatório de campanha** — só depois de 2, e com a separação
   entre única e recorrente visível na tela.

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
