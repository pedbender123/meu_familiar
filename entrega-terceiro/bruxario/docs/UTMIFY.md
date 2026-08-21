# Conectar a Utmify

A Utmify diz **de qual campanha veio cada venda**. A ligação tem duas metades,
e as duas precisam estar no ar para o relatório fechar.

## 1 · O pixel (navegador)

Pegue o ID do pixel em **Integrações → Pixel** e ponha no `.env`:

```
NEXT_PUBLIC_UTMIFY_PIXEL_ID=seu-pixel-aqui
```

Ele captura os UTMs da URL do anúncio e os mantém enquanto a pessoa navega.
Sem ele, quem clica no anúncio, atravessa as 26 cenas e só então compra teria
perdido a origem no caminho — a venda apareceria como "direta".

Sem o ID preenchido, nada é carregado. Não há script morto na página.

## 2 · A credencial de API (servidor)

Em **Integrações → Webhooks → Credenciais de API → Adicionar credencial**.

```
UTMIFY_API_TOKEN=seu-token-aqui
```

É ela que permite ao servidor avisar a Utmify quando uma venda acontece. Isso
**não pode sair do navegador**: quem sabe que o pagamento confirmou é o webhook
do gateway, e nesse momento não há aba aberta.

## O que o sistema envia, e quando

O pedido é reportado **duas vezes**:

| quando | status |
|---|---|
| a cobrança é aberta | `waiting_payment` |
| o pagamento confirma | `paid` |

Os dois são necessários. Mandar só a venda paga esconde quem chegou ao
checkout e desistiu — que é metade do que uma taxa de conversão por campanha
significa.

## Sobre o valor reportado

O que vai como receita é o **líquido**: o valor cobrado menos a taxa do
gateway. Mandar o valor cheio inflaria o resultado de toda campanha e faria o
custo por venda parecer melhor do que é.

E o valor sai do que foi **cobrado de verdade** (o gateway informa), não do
preço de tabela.

## Testar sem sujar o relatório

```
UTMIFY_TESTE=1
```

Marca todo pedido como teste. Tire quando for para o ar.

## Se a Utmify estiver fora do ar

Nada acontece com a venda. O envio tem prazo de 6 segundos e o erro é apenas
registrado no log — rastreio quebrado é um relatório com buraco, rastreio que
derruba a compra é dinheiro perdido.
