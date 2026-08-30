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

- **Não migrar para produtos da Wiven só para a integração nativa dela
  funcionar.** O problema que ela resolveria já está resolvido do nosso lado,
  com mais controle e com os números certos. Coprodução em vez de `splits` é
  uma discussão separada e legítima — mas as duas não podem coexistir, sob
  risco de descontar duas vezes.
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
