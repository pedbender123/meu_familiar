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

## ✅ Respondido em 18/08 — o modelo de venda

**Não havia contradição: são duas telas diferentes.** A tela de oferta logo
depois do ritual e a página `/planos` vendem coisas distintas, e é por isso que
os preços não batiam.

### A tela de oferta (depois do ritual) — produto de entrega rápida

O objetivo declarado dela é **arrecadar caixa**, não montar assinatura. Ela
mostra três coisas e mais nada:

| oferta | preço | recorrente? | o que entrega |
|---|---|---|---|
| opção 1 | R$ 7,90 | não | revelação simples do familiar |
| opção 2 | R$ 15,90 | não | revelação completa |
| Revelação | R$ 29,90 | **sim, a única** | revelação completa + app completo por 30 dias |

As duas avulsas dão acesso ao app **igual ao do grátis**, com uma diferença
só: o calendário mostra a **semana inteira** em vez de só o dia de hoje.

**Nada de "grátis" aparece nessa tela.** As opções são apresentadas como
produtos pagos. O grátis existe, mas não é oferecido ali.

### O grátis chega por e-mail, ~4h depois

Quem passou pela oferta e não comprou recebe *"acesse sua conta free do
Bruxário"*. A intenção é fazer a pessoa entrar, explorar e ver valor — e a
partir daí ela **não vê mais as avulsas de 7,90 e 15,90**, só os planos
recorrentes.

O que a conta grátis tem:
- imagem e nome do familiar (a **revelação completa não**, e o texto também não)
- as métricas do teste
- horóscopo e calendário **só até o dia de hoje**
- 5 mensagens/mês no Oráculo · 1 leitura

Tudo isso acessível **só pela plataforma** — a imagem do familiar é grátis, o
texto da revelação não.

### Os planos recorrentes (`/planos`)

| plano | preço/mês | leituras | mensagens | calendário | extra |
|---|---|---|---|---|---|
| — | 15,90 | 1 por semana | 30 | 1 mês | — |
| — | 29,90 | 10 | 60 | 6 meses | guia espiritual semanal por e-mail |
| — | 49,90 | 30 | 200 | 1 ano | conselho |

**Regra de apresentação:** cada plano mostra **tudo do anterior + a
diferença**. Não repetir a lista inteira como se fosse independente.

**A revelação (o textão) está inclusa em todos os planos.**

> ? **O que ainda falta decidir:** os nomes dos três planos, e o que acontece
> com quem já assinou o 15,90 e o 39,90 de ontem. A promessa "ninguém perde o
> que pagou" está travada por teste.

---

## 1 · A porta de entrada sem landing — ✅ **feito em 18/08**

Commit `5c24ed0`. Tráfego de campanha cai direto na primeira das 26 cenas;
`/` sem marcador continua sendo a landing (é a única porta de login do site).
Junto foi a inversão da ordem: as 26 cenas primeiro, formulário no fim.

**Falta:** subir para produção. Não há remote git configurado aqui e eu não
tenho acesso à VPS — o deploy é seu.

---

## 2 · Nome e e-mail depois das perguntas — ✅ **feito em 18/08**

Mesmo commit. Um formulário só no fim: nome, e-mail, data, hora (opcional) e
cidade. Quem abandona no meio não deixa nada — decisão sua, "descarta".

---

## 3 · Data, hora e cidade de nascimento — ✅ **feito em 18/08**

Tudo no formulário do fim. A cidade é busca por texto sobre os 5.571
municípios, com o estado vindo junto do resultado. A coordenada usada é a da
capital do estado (o erro cabe dentro do erro da hora informada de memória —
ver `src/lib/coordenadas.ts`), e a conta passa a nascer completa: a pendência
de mapa natal só sobra para as contas antigas.

---

## 4 · Três criativos por campanha

**? Antes de executar** — continua bloqueado: eu não tenho acesso ao Ads
Manager. Preciso que você diga quais criativos rodaram e qual ganhou, com
números se tiver.

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

**Documentação:** https://docs.directpag.com.br/ — a cobertura é para ser
total (Pix, cartão, recorrência, webhook, split).

**? Antes de executar** — falta só a credencial. E vale decidir se é troca ou
adição: `contas_checkout` foi feita para dois provedores conviverem, então dá
para pôr o DirectPag em 10% do tráfego e comparar taxa e conversão antes de
virar a chave.

---

## 6 · Documentação da conexão do DirectPag

Sai junto do item 5, depois de ele existir. Vale como documento à parte
porque é o que a equipe de marketing vai usar sem te perguntar.

---

## 7 · Conectar coprodutores — ❌ **fora do escopo**

Você faz direto no painel do gateway. Nada a construir aqui.

---

## 8 · Acessos a passar (você faz, eu não consigo)

- [ ] **DirectPag — credenciais** (a documentação já veio: docs.directpag.com.br)
- [ ] Ads Manager — os números dos criativos que rodaram (item 4)

O dashboard da Utmify e o Meta Business ficam adiados junto do item 9.

**Obs:** eu não tenho como acessar nenhuma dessas contas. O que eu preciso é
do que sai delas — chaves de API, IDs, números de campanha — colados aqui ou
no `.env`.

---

## 9 · Pixel da Utmify — ⏸️ **adiado, por último**

Deixou de ser urgente: ainda não está claro qual necessidade a Utmify resolve
que o pixel da Meta + o painel próprio já não resolvem. Fica junto do item 8
(quais números acompanhar), para ser decidido com dado na mão.

**? Quando voltar**
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

## A ordem daqui pra frente

1. **Deploy do que foi feito hoje** (itens 1, 2 e 3). É seu — não tenho acesso
   à VPS e não existe remote git configurado. Ver o checklist acima antes.
2. **A tela de oferta com as três opções** (7,90 · 15,90 · 29,90 recorrente),
   e o app limitado que as duas avulsas abrem — igual ao grátis, com a semana
   inteira no calendário em vez de só hoje.
3. **O e-mail de conta grátis em ~4h** para quem viu a oferta e não comprou, e
   a regra que esconde as avulsas de quem já entrou por ele.
4. **Os três planos recorrentes** com os limites novos (15,90 · 29,90 · 49,90),
   com a `/planos` mostrando "tudo do anterior + a diferença".
5. **DirectPag**, quando a credencial chegar.
6. Criativos, Utmify e analytics, com dado na mão.
