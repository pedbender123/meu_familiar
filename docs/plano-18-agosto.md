# Plano — 18 de agosto de 2026

> **Documento de intenção, não de execução.** Cada item tem um bloco
> **`? Antes de executar`** com as perguntas que precisam de resposta sua.
> Não comece nenhum item sem passar por elas — vários deles se contradizem
> com o que já está construído, e executar antes de resolver isso significa
> refazer.

---

## Onde estamos (17/08, fim do dia)

A Revelação virou grátis e o modelo passou a ser assinatura. Está funcionando
em local, sem deploy:

- Ritual grátis → conta → assinatura `gratuito`
- Tela de oferta depois do ritual, com saída para o grátis
- E-mail virou a chave da plataforma (o familiar não vai mais por e-mail)
- Oráculo respondendo: leitura ritual (cartas + céu, com animação) e mensagem
- Calendário com 12 meses navegáveis e cadeados
- `/planos` vendendo Revelação (15,90) e Acompanhamento (39,90)

385 testes, build limpo.

---

## ⚠️ A contradição que precisa ser resolvida primeiro

**Os planos novos que você descreveu conflitam com os que estão no ar.**

Hoje no banco:

| plano | preço | o que é |
|---|---|---|
| gratuito | 0 | ritual + familiar + PDF + 1 leitura/mês |
| revelacao_mensal | 15,90/mês | app completo, recorrente |
| acompanhamento_mensal | 39,90/mês | app completo + conselho diário |

O que você pediu hoje:

| plano | preço | o que é |
|---|---|---|
| opção 1 | 7,90 | revelação simples, app limitadíssimo |
| opção 2 | 15,90 | revelação completa, app limitadíssimo |
| Revelação | 29,90/mês | revelação completa + app completo 30 dias, recorrente |

**As perguntas que decidem tudo:**

1. **A Revelação continua grátis, ou volta a ser paga a 7,90?** Se as opções
   1 e 2 são "as revelações do familiar", elas competem com o que hoje é a
   porta de entrada gratuita. Os dois modelos não cabem juntos.
2. **7,90 e 15,90 são compra única ou recorrente?** Pelo texto parecem
   avulsas ("só as revelações"), com o 29,90 sendo o único recorrente.
3. **O que sobra do Acompanhamento (39,90)?** Ele sai, ou vira um quarto
   degrau acima do 29,90?
4. **"App limitadíssimo, mas como perfil e conta"** — limitadíssimo é
   exatamente o quê? Só ver o familiar e o perfil, sem Oráculo e sem
   calendário? Ou com uma amostra de cada?

Sem essas quatro respostas, mexer na tabela de planos é retrabalho garantido.

---

## 1 · Planos de upgrade dentro do aplicativo

Vender de dentro, não só na landing: a pessoa esbarra no limite e sobe ali
mesmo.

**? Antes de executar**
- Resolver a contradição acima — os três planos novos convivem com os dois
  atuais, substituem, ou é reforma completa da tabela?
- Quem já assinou o 15,90 de hoje vira o quê? (a promessa "ninguém perde o
  que pagou" está travada por teste; qualquer mudança precisa respeitá-la)
- O upgrade no meio do ciclo é proporcional, ou a pessoa paga cheio e o prazo
  soma? A segunda é bem mais simples e não engana ninguém — mas é decisão sua.
- Onde a oferta aparece: quando bate o limite, no menu, ou nos dois?

---

## 2 · Coleta de nome e e-mail DEPOIS das perguntas

Hoje o nome e o e-mail são pedidos antes. Movê-los para depois aumenta quem
começa, e é a mudança de funil com maior efeito isolado.

**? Antes de executar**
- Se a pessoa responde tudo e **não** deixa o e-mail, o que acontece com as
  respostas? (guardar e recuperar depois é possível, mas muda o modelo de
  dados)
- Isso mexe no caminho crítico da venda. Vale rodar como teste A/B contra o
  fluxo atual, ou troca direto?
- O funil de anúncio (`/atravessar`) já tem regra própria de e-mail. Muda
  junto ou fica como está?

---

## 3 · Coletar data, hora (opcional) e **cidade** de nascimento

Parcialmente pronto: a conta já tem os campos, já herda data e hora do
ritual, já trata hora desconhecida com meio-dia, e já pede a cidade por
estado.

**Falta:** pedir isso **no ritual**, não depois — hoje é uma pendência que a
pessoa preenche dentro da plataforma.

**? Antes de executar**
- Cidade exata ou só o estado? Hoje é o estado (a coordenada é a da capital,
  precisa o bastante para o ascendente). Cidade exata exige uma base
  geocodificada — mais peso, ganho pequeno.
- Entra como passo do ritual ou como tela logo depois? Cada campo a mais no
  ritual é gente que desiste no meio.

---

## 4 · Três criativos por campanha

**? Antes de executar**
- **Eu não tenho acesso ao Ads Manager**, então não sei o que deu mais
  resultado. Você precisa me passar: quais criativos rodaram, com quais
  números (CTR, CPA, conversão), ou pelo menos qual "ganhou".
- Criativo é imagem/vídeo + copy. Eu escrevo a copy e monto a estrutura; a
  peça visual em si você produz ou eu gero briefing?
- Três por campanha — quantas campanhas?

---

## 5 · Trocar Mercado Pago por **DirectPag**

A arquitetura está pronta: existe a interface `ProvedorPagamento` com 4
métodos, e o Mercado Pago já é um adaptador atrás dela. Backend é implementar
um irmão.

**O trabalho real está no frontend**, e depende do modelo de checkout deles:
- **Redirect hospedado** → simples de integrar, mas tira a pessoa do ritual e
  joga numa tela de terceiro (foi por isso que o projeto saiu do Asaas)
- **Formulário embutido** (tipo o Payment Brick) → mais trabalho, mantém a
  ambientação

**? Antes de executar**
- **Preciso da documentação do DirectPag.** Não conheço a API deles e não vou
  chutar sobre coisa que mexe com dinheiro.
- Fazem Pix? Cartão recorrente? (isso decide se a renovação continua manual)
- **É troca ou adição?** A tabela `contas_checkout` foi feita para conviverem
  dois provedores. Dá para pôr o DirectPag em 10% do tráfego e comparar taxa
  e conversão antes de decidir — bem mais seguro que virar a chave.
- Por que a troca? Taxa, antecipação, coprodutores? A resposta muda o que
  priorizar.

---

## 6 · Documentação da conexão do DirectPag

Sai junto do item 5, depois de ele existir. Vale como documento à parte
porque é o que a equipe de marketing vai usar sem te perguntar.

---

## 7 · Conectar coprodutores

**? Antes de executar**
- Coprodutor de quê: comissão sobre venda, split de pagamento no gateway, ou
  só acesso ao painel para acompanhar?
- Se for split, **isso depende do DirectPag** (item 5) — é ele que precisa
  suportar. Ordem importa.
- Quantos, e a comissão é fixa ou por campanha?

---

## 8 · Acessos a passar (você faz, eu não consigo)

- [ ] DirectPag — credenciais e documentação
- [ ] Dashboard (qual? Utmify, Ads Manager, outro?)
- [ ] Facebook / Meta Business

**Obs:** eu não tenho como acessar nenhuma dessas contas. O que eu preciso é
do que sai delas — chaves de API, IDs, números de campanha — colados aqui ou
no `.env`.

---

## 9 · 🔥 Pixel da Utmify na página de vendas — **URGENTE**

Marcado como urgente por você.

**? Antes de executar**
- Preciso do **ID do pixel / script da Utmify**.
- Em quais páginas: só a landing, ou o funil inteiro (`/atravessar`,
  `/ritual`, `/pagamento`, `/planos`)?
- A Utmify normalmente também quer os parâmetros UTM na URL e o postback de
  venda no servidor. Só o pixel no navegador, ou a integração completa?
- **Atenção:** o pixel da Meta hoje é o único no site e tem dedup por
  `event_id` entre navegador e CAPI. Somar um segundo rastreador não quebra
  isso, mas os dois vão contar números diferentes — é normal e esperado, só
  não vale se assustar depois.

---

## O que já estava pendente e continua

**Do Oráculo (Fase 8):**
- Faltam 3 dos 5 espetáculos (chama, ossos, dias). **Com só 2, existem 2
  combinações — a leitura repete a partir da terceira.** Se a campanha vender
  "ritual sempre diferente", isso vem antes.
- As perguntas-como-cena (o modelo pedindo o que falta)
- Variações de dia de ouro nos espetáculos novos

**Depois:** guia semanal e conselho diário · recorrência automática ·
analytics de MRR, churn e margem.

**Dívidas antigas:** escolha de provedor em runtime (fica junto do item 5),
relocação de arquivos e fusão do `horoscopo.db`.

---

## Antes de qualquer deploy

1. `OPENAI_API_KEY` + trocar o modelo em `src/nucleo/modelos.ts` (hoje roda
   no Gemini)
2. Preencher os preços de token em `modelos.ts` — estão zerados, e sem eles a
   margem sai errada
3. **Conferir a área logada num celular de verdade.** Nunca foi aberta em
   aparelho.

---

## Como usar este documento

Ele está incompleto de propósito. Responda os blocos `?` — de preferência
escrevendo aqui mesmo — e aí ele vira plano de execução. Os itens 1 e 5 são
os que mais mudam de forma dependendo das respostas; os itens 2, 3 e 9 dão
para começar com pouca conversa.
