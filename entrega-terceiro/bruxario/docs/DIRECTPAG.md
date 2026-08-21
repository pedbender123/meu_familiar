# Conectar o DirectPag

## O que você precisa ter antes

1. Conta no DirectPag com **token de API** emitido
2. Uma **conta bancária ou chave Pix** cadastrada lá (é para onde o saque vai)

## 1 · A chave da API

No painel do DirectPag, gere o token e ponha no `.env`:

```
DIRECTPAG_API_TOKEN=seu-token-aqui
```

> **Atenção ao formato.** O DirectPag autentica por **query string**
> (`?api_token=...`), não por header. Consequência prática: o token aparece em
> log de proxy e em histórico de requisição. O código nunca o escreve em log —
> `semSegredo()` em `src/nucleo/checkouts/directpag.ts` limpa toda mensagem de
> erro antes de ela subir. Se você adicionar log novo ali, use a mesma função.

## 2 · Produto e oferta

O DirectPag **não cobra contra um valor solto** — toda transação aponta para
uma `offer_hash`. Então o produto e a oferta precisam existir na conta antes
da primeira venda.

Crie pelo painel (Produtos → Novo) ou pela API, e copie os dois hashes:

```
DIRECTPAG_PRODUCT_HASH=prod...
DIRECTPAG_OFFER_HASH=offer...
```

No cadastro do produto, escolha **Tipo de entrega: Área de membros externa**.
É o que diz ao DirectPag que quem entrega é este sistema, não a plataforma
deles.

O `amount` de cada transação continua vindo daqui, do servidor, com o cupom já
aplicado — a oferta define o produto, não o preço final.

## 3 · O postback

O sistema já manda `postback_url` apontando para `BASE_URL + /api/webhook` em
toda transação. Não há nada a configurar no painel deles.

> **O DirectPag não assina o postback.** Não há HMAC nem header assinado — a
> documentação não descreve verificação nenhuma, então qualquer um que
> descubra a URL pode fingir um pagamento aprovado.
>
> Por isso o corpo da notificação é tratado como **aviso**, não como verdade:
> dele só se aproveita o id da transação, e o status real vem de uma consulta
> nossa à API, autenticada com o nosso token. Notificação forjada não entrega
> nada. Não mexa nisso sem entender o que sustenta.

## 4 · Métodos de pagamento

Por padrão, **Pix e boleto**. Cartão está desligado em
`METODOS_HABILITADOS` (`src/nucleo/checkouts/directpag.ts`), e a razão está
escrita lá:

> A API recebe o número do cartão em texto (`card.number`), sem tokenização no
> navegador e sem cofre. O número passa pelo servidor desta aplicação, o que
> move a operação de **SAQ A para SAQ D** no PCI-DSS — outra categoria de
> responsabilidade, e um vazamento aqui vira vazamento de cartão.
>
> No Payment Brick do Mercado Pago (o gateway anterior) isso não acontecia: o
> número era tokenizado no navegador e nunca tocava o servidor.

Ligar é uma linha. Ligar sem decidir isso conscientemente é o tipo de coisa
que se descobre tarde.

## 5 · O CPF

`customer.document` é **obrigatório** em toda transação. O checkout desta
versão pede CPF por isso — não é escolha de produto, é exigência da API. Se o
campo sair do formulário, a cobrança não nasce.

## 6 · Conferir que funcionou

```
npm run reconciliar -- --horas=48
```

Compara o que o DirectPag registrou como pago com o que este banco tem. Se
aparecer pagamento aprovado lá sem pedido entregue aqui, é webhook perdido —
alguém pagou e não recebeu. O comando reprocessa.

Vale rodar em cron diário.

## O que a API do DirectPag NÃO faz

Levantado da documentação oficial, para não haver surpresa:

| não tem | consequência |
|---|---|
| Assinatura no postback | Ver a seção 3 |
| Tokenização de cartão | Ver a seção 4 |
| Sandbox documentado | Teste com valor baixo em produção |
| Endpoint de assinatura recorrente na API pública | Recorrência existe no painel (`payment_type`), mas não há endpoint documentado para criar, consultar ou cancelar — nem evento de renovação. Irrelevante nesta versão, que é produto único |
