# O funil precisa falar UTM, não o nosso dialeto

Escrito em 28/08/2026, depois de duas semanas explicando ao parceiro de
marketing uma coisa que ele não deveria precisar saber.

---

## 1. O erro de premissa

Este projeto tem um rastreio próprio, bom, e mais preciso que o padrão do
mercado: `?c=XXYY` identifica campanha e criativo, `bx_at` guarda a atribuição
por um ano, `toques` registra cada contato, e a dash por peça mostra onde as
pessoas de cada vídeo desistem.

E ele é **irrelevante para quem compra a mídia**.

O time de marketing não pensa em "código de peça". Ele pensa assim:

> Conectei a UTMify ao Meta e à Wiven. Logo, está rastreado.

Nessa cabeça, **quem rastreia é a UTMify**. O site é uma página burra que
recebe o clique e cobra. Se o dado não aparece no painel da UTMify, o problema
é do site — e essa leitura está certa, porque é assim que 95% das páginas de
venda do mercado funcionam, e é com elas que as ferramentas dele foram feitas
para conversar.

Até agora eu vinha pedindo o inverso: que ele colasse o nosso `?c=` no link
para o nosso rastreio funcionar. Isso é **incorporar o fluxo dele ao nosso**.
O correto é o oposto: **adaptar o nosso ao dele**.

O sintoma concreto foi a venda de 27/08 — R$ 18,90, criativo identificado
internamente, e invisível no painel deles, porque o link não trazia `utm_*` e
a UTMify arquivou como venda direta.

---

## 2. O contrato novo

**O link do anúncio carrega apenas o que a Meta preenche sozinha.** Nada de
código nosso, nada de parâmetro que alguém precise lembrar de colar.

```
bruxario.com.br/?utm_source={{site_source_name}}
                &utm_medium=paid
                &utm_campaign={{campaign.id}}
                &utm_content={{ad.id}}
                &utm_term={{adset.id}}
```

Essas macros a Meta substitui sozinha em toda entrega. É o que o time já sabe
montar, é o que a UTMify espera, e é a única coisa que passa a ser exigida
dele.

**O `?c=` continua existindo**, para links de bio, indicação e testes
internos. Ele deixa de ser o caminho principal e passa a ser o caminho
alternativo.

---

## 3. O que muda no sistema

### 3.1 Campanha e criativo nascem do UTM

Hoje `campanha_id` e `peca_id` só existem se alguém cadastrou a campanha no
painel e colou o código no anúncio. Passam a ser **descobertos**:

- Chegou visita com `utm_campaign=120248890724340044` que não conhecemos?
  Cria-se a campanha automaticamente, com esse ID como chave.
- Chegou `utm_content=120248978282210044`? Cria-se a peça, com esse ID como
  chave.

O painel passa a deixar **renomear** o que foi criado assim: o ID numérico
identifica, o nome humano é conforto nosso. Quem compra a mídia nunca precisa
abrir o painel.

**Por que criar sozinho:** a alternativa é o dado chegar e ser descartado por
falta de cadastro prévio — que é exatamente o que vinha acontecendo. Campanha
criada a mais é ruído que se apaga; venda sem campanha é dinheiro que ninguém
sabe de onde veio.

**O risco:** o painel enche de linhas com nome numérico. Aceitável — e some
com um botão de renomear e um filtro de "sem venda".

### 3.2 A atribuição passa a ter duas chaves

`bx_at` guarda hoje `campanhaId` e `pecaId` internos. Passa a guardar também
o `utm_campaign` e o `utm_content` crus, como vieram.

Assim o relatório para a UTMify usa **exatamente a string que a Meta mandou**,
sem tradução. Traduzir é o que cria duas identidades para a mesma campanha no
painel deles — uma com o ID, outra com o nome.

### 3.3 O que reportamos passa a ser espelho, não interpretação

Hoje, quando falta UTM, nós preenchemos com a campanha interna. Isso foi um
remendo correto para o problema de ontem e continua valendo como **rede de
segurança** — mas deixa de ser o caminho normal.

Regra: **o que veio no link sempre ganha.** O nosso só entra quando não veio
nada.

### 3.4 O pixel da UTMify é o único tracker do navegador

Já está assim desde 28/08. Fica registrado que é decisão, não acaso:

- O nosso pixel da Meta está desligado (`NEXT_PUBLIC_META_PIXEL_ID` vazio)
- A fila CAPI não envia
- Quem fala com a Meta é a UTMify, com o pixel e o token deles

Falta garantir que o script da UTMify carregue **em todas as telas do funil**,
inclusive nas 26 cenas e no checkout — se ele não roda numa etapa, os cookies
`_fbp`/`_fbc` daquela sessão podem não existir quando a venda acontece.

### 3.5 A cobrança continua nossa

Nada muda: Wiven cobra, split reparte, Mercado Pago é a queda. O time de
marketing não precisa saber de gateway — e é justamente por isso que a
integração nativa Wiven↔UTMify não pode ser a fonte da verdade: ela não
dispara em cobrança por API, e depender dela é depender de algo que já falhou.

**Nós avisamos a UTMify.** Sempre. É o que está funcionando.

---

## 4. Por onde começar

Em ordem de valor, e cada passo é entregável sozinho:

1. **Aceitar `utm_content` como criativo** no rastreio, com criação
   automática de peça. É o que destrava a dash por vídeo sem exigir nada
   deles.
2. **Criação automática de campanha** por `utm_campaign`.
3. **Guardar os UTMs crus no `bx_at`** e usá-los no relatório, sem tradução.
4. **Renomear no painel** o que nasceu com nome numérico.
5. **Conferir o script da UTMify** em todas as telas do funil.

---

## 5. O que NÃO fazer

- **Não deixar `splits` e coprodução ligados ao mesmo tempo.** As duas
  descontariam da mesma venda, e o dinheiro sairia dobrado. Ao migrar para
  produtos, `WIVEN_SPLITS` é esvaziado no mesmo restart.
- **Não pedir nada ao time de marketing além do link com macros.** Cada
  exigência a mais é um lugar onde o dado vai se perder, e a culpa vai voltar
  para cá — com razão.
- **Não desligar o rastreio interno.** Ele é mais preciso e é o que sustenta
  a dash por criativo e a decisão de gateway por campanha. Ele só deixa de ser
  a porta de entrada.

---

## 6. A régua

O plano está pronto quando o time de marketing puder:

1. Criar a campanha no gerenciador com o link de macros padrão
2. Subir o anúncio
3. Ver a venda aparecer na UTMify, dentro da campanha e do criativo certos

**Sem abrir o painel do Bruxário uma única vez.**

---

## 7. O link único, e a UTMify ligada como qualquer um ligaria

### 7.1 O link

Um só, para tudo:

```
https://bruxario.com.br/vendas?utm_source={{site_source_name}}
   &utm_medium=paid&utm_campaign={{campaign.id}}
   &utm_content={{ad.id}}&utm_term={{adset.id}}
```

`/vendas` já é a porta do tráfego pago — só o formulário, sem preço, sem
explicação, sem menu. É a "PV" no vocabulário deles.

### 7.2 A UTMify ligada do jeito padrão

O time conecta a UTMify à página de vendas como conecta em qualquer outra:
cola o pixel, aponta o webhook da Wiven, e pronto. **Nada de configuração
nossa, nada de código de campanha.**

Do nosso lado isso exige três garantias, e nenhuma delas aparece para ele:

1. **O script da UTMify carrega em toda tela do funil** — `/vendas`, as 26
   cenas, a oferta, o checkout e o obrigado. Se faltar numa etapa, os cookies
   `_fbp`/`_fbc` daquela sessão podem não existir na hora da venda, e a Meta
   perde o casamento com o clique.
2. **Os `utm_*` sobrevivem à navegação inteira.** Já sobrevivem, via a própria
   UTMify e via `utm_json` no pedido.
3. **A venda chega à UTMify com os mesmos `utm_*` que entraram.** Sem
   tradução, sem substituição pelo nome interno.

### 7.3 Produtos e ofertas na Wiven

Decisão de 28/08: **passar a usar produtos e ofertas**, não cobrança avulsa.

É o que faz a integração nativa Wiven↔UTMify disparar (ela escuta venda de
produto — o `offerCode` do webhook é descrito como "vendas via checkout
interno", e o nosso vem sempre nulo), e é o que permite coprodução no painel
em vez de `WIVEN_SPLITS` no `.env`.

**Não há API de produtos.** Sondado em 28/08:

| Rota | Resposta |
| --- | --- |
| `GET /gateway/producer/products` | `404 NOT_FOUND` |
| `GET /gateway/checkout` | `405` — existe, aceita **POST** |
| `GET /gateway/subscriptions` | existe, exige parâmetro |

Então os produtos são criados **à mão, no painel**, uma vez. O que precisa
existir:

| Produto | Preço cheio | Com o cupom de 20% |
| --- | --- | --- |
| Revelação | R$ 12,25 | R$ 9,80 |
| Revelação Completa | R$ 23,62 | R$ 18,90 |
| Melhoria (upgrade) | R$ 4,90 | — |
| Assinatura mensal | R$ 29,90 | — |

Em cada um, os coprodutores nos percentuais combinados (40/40/20).

**O preço cadastrado não pode virar a fonte da verdade do preço cobrado.** É
o cupom que hoje permite ajustar de 12,90 para 9,80 sem deploy, e essa
alavanca não se abre mão. Se a Wiven exigir que a cobrança bata com o preço do
produto, a saída é uma oferta por preço praticado, e aí o cadastro passa a ser
manutenção — a ser medido antes de migrar tudo.

### 7.4 A ordem de migração, produto a produto

Migrar tudo de uma vez é apostar. A ordem:

1. **Só a Completa**, que é a que mais vende. Cobrança com `products` apontando
   para o produto do catálogo, **sem `splits`**.
2. Conferir três coisas na venda de teste: a coprodução dividiu? o `offerCode`
   veio preenchido? a UTMify recebeu **da Wiven**?
3. Se as três derem certo, migrar os outros e esvaziar `WIVEN_SPLITS`.
4. Se a coprodução não pegar em cobrança por API, o caminho é o **checkout
   interno** (`POST /gateway/checkout`) — e aí entra em conflito com o SPEC
   10.3, que proíbe mandar a pessoa para tela de terceiro. Essa troca é
   decisão do dono, não minha.

**Enquanto o teste não passar, `WIVEN_SPLITS` continua ligado.** Ele está
pagando corretamente hoje, e não se desliga o que funciona antes de o
substituto provar que funciona.

### 7.5 O que eu preciso, e o que é você quem faz

**Você, no painel da Wiven:**
- Criar os produtos da tabela acima
- Adicionar você e o João como coprodutores, 40/40/20
- Me passar **o id de cada produto**

**Você, no gerenciador de anúncios:**
- Trocar o link para o de macros da §7.1

**Eu, no código:**
- Mandar `products` na cobrança
- Garantir a UTMify em todas as telas do funil
- Campanha e criativo nascendo do UTM (§3.1)
- Esvaziar `WIVEN_SPLITS` quando a coprodução provar que funciona
