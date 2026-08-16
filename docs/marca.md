# Marca e marketing do Bruxário

> Companheiro de `reestruturacao.md`. Aquele diz como o sistema muda; este diz o
> que a marca passa a prometer — e o que ela não pode parar de prometer.

## 1. O problema

Hoje o site se apresenta assim (`src/app/layout.tsx:41-44`):

> **Bruxário — O familiar de bruxa que te escolheu**
> *Toda bruxa tem um familiar. O seu já te escolheu. Você só ainda não sabe qual é.*

É uma promessa excelente — e **inteiramente sobre o produto de entrada**. Ela
promete uma revelação: uma coisa que acontece uma vez, você descobre, acabou.

Só que o Bruxário está virando um lugar de **voltar**: Oráculo, Calendário
Astrológico, testes novos, guia semanal, assinatura. Ninguém assina uma revelação.
Você não renova um "descobri qual é o meu".

Se a marca continuar prometendo o momento, a assinatura vai parecer cobrança por
algo que já foi entregue. A marca precisa passar a prometer **a prática**.

## 2. A tese

O nome sempre prometeu mais do que o produto entregava.

Um **bruxário** é o caderno da bruxa. Não é um resultado, é um lugar onde se
escreve, se consulta e se volta. Ele acumula. Ele te acompanha.

A reforma não inventa uma marca nova: **ela faz o produto alcançar o nome.**

Isso é sorte, e é sorte que economiza dinheiro — não tem rebrand, não tem nome
novo, não tem público reeducado do zero. Tem uma promessa que finalmente cabe.

## 3. O que o Bruxário é agora

Três coisas, e elas se encaixam numa frase:

| | O que é | O que responde |
|---|---|---|
| **Perfil** | familiar + testes | **quem você é** |
| **Oráculo** | o conselho | **o que fazer** |
| **Calendário** | os trânsitos dos seus dias | **quando agir** |

> **Quem você é. O que fazer. Quando.**

Essa é a espinha. Toda peça de comunicação deve caber em uma das três, e o funil
de entrada continua sendo a primeira — porque descobrir quem você é é a pergunta
mais fácil de fazer alguém querer responder.

**O familiar deixa de ser o produto e vira a porta.** Não some, não perde
importância — muda de função. Ele é o que te reconhece na entrada; o resto é o que
faz você ficar.

## 4. A voz

Ela já existe, está em `docs/copy-vendas.md` e em `src/lib/teaser.ts`, e funciona.
Só nunca foi escrita como regra. Está aqui pra não se perder quando outra pessoa
escrever.

**1 · Fala com ela, sobre ela.** Nunca sobre o produto, nunca sobre a empresa.
> *"O que quase ninguém percebe em você?"* — não "nosso teste identifica traços".

**2 · Frases curtas. Ponto final.**
> *"Você decide antes de ter certeza."*

**3 · Sonega.** A copy sempre segura alguma coisa. É o que faz clicar.
> *"…e tem um nome que só dá pra quem perguntar."*

**4 · Nomeia o custo, não só o bonito.** É o que faz soar verdadeiro em vez de
bajulador.
> *"Cuidar vem antes de perceber que está cuidando, e isso cansa mais do que você
> admite."*

**5 · Nunca explica a mística.** Não diz "energia", "vibração", "universo",
"frequência". Diz o que aconteceu.
> *"Alguma coisa te reconheceu."*

**6 · Honesta na letra miúda — e isso aumenta a confiança.**
> *"É um retrato simbólico, não um teste psicológico."*

**O que nunca aparece:** emoji em profusão, CAPS de urgência, contagem regressiva
falsa, "GARANTA JÁ", promessa de resultado material ("vai ficar rico", "vai casar"),
linguagem de coach. O Bruxário não grita. Ele sabe de você — quem sabe não precisa
gritar.

## 5. Instagram

### O campo `nome` (não é o @)

Hoje provavelmente está só "Bruxário". Esse campo é **buscável dentro do
Instagram** e a maioria das marcas desperdiça ele.

```
Bruxário · autoconhecimento e astrologia
```

Quem procura "astrologia" ou "autoconhecimento" passa a poder achar. É a mudança
de maior retorno por menor esforço da lista inteira.

### A bio

**Recomendada:**

```
Alguma coisa já te reconheceu.
Seu familiar, seus dias e um oráculo que lembra de você.
↓ comece pelo teste
```

Ela faz as três coisas que a bio precisa fazer: mantém o gancho que já converte
(*reconheceu*), anuncia que existe mais que a revelação (*seus dias*, *lembra de
você*), e diz o próximo passo sem pedir. E "um oráculo que **lembra** de você" é a
única frase de bio que a concorrência não pode copiar sem ter a memória do
Oráculo — ela vende a arquitetura, não o adjetivo.

**Alternativas, com apostas diferentes:**

*Mais direta, aposta em clareza sobre mistério:*
```
Descubra seu familiar. Leia seus dias. Pergunte ao Oráculo.
Autoconhecimento com astrologia de verdade.
↓ o teste é grátis
```

*Mais fechada, aposta na curiosidade pura:*
```
Toda bruxa tem um familiar.
Descobrir o seu é só a porta.
↓
```

A primeira é a recomendada; a segunda converte melhor com público frio que ainda
não conhece a marca; a terceira, com quem já ouviu falar.

### Destaques

Na ordem, porque a ordem é o funil:

1. **Seu familiar** — os 12, o que cada um significa
2. **Os dias** — recortes do Calendário, "essa semana"
3. **O Oráculo** — perguntas reais e o que ele respondeu (com permissão)
4. **Quem já viu** — prints, depoimentos, o mural
5. **Como funciona** — preço, o que vem em cada plano, é seguro

O 5º existe pra tirar objeção sem gastar post. Quem chegou lá já quer comprar.

### O link

Um link só, pra `/` com código de campanha (`?c=`) — o rastreio já existe e já
funciona (`src/lib/campanhas.ts`). **Não usar agregador de links:** ele adiciona um
clique, come o dado do pixel e não converte nada. Se precisar de mais destinos, é
sinal de que falta uma landing, não um agregador.

## 6. A escada de conteúdo

Cada degrau tem um trabalho. Publicar sem saber qual é o degrau é publicar por
publicar.

| Degrau | Trabalho | Formato |
|---|---|---|
| **Reconhecimento** | Ela se ver no post e salvar | "As que ficam de vigília fazem isso sem perceber" |
| **Utilidade** | Ela voltar sem ser vendida | O calendário da semana, aberto e grátis |
| **Prova** | Ela acreditar | Print de conselho do Oráculo, reação de quem recebeu |
| **Convite** | Ela clicar | O teste, e só o teste |

A proporção que funciona pra isso: muito do primeiro e do segundo, algum do
terceiro, pouco do quarto. **O calendário aberto é o melhor conteúdo orgânico que
esse negócio pode ter** — é útil, é recorrente, é diferente todo dia, custa ~R$ 0
de gerar (é determinístico, `astronomy-engine`), e o que ele mostra de graça é
exatamente o que a assinatura personaliza. A versão grátis é genérica por signo; a
paga é do mapa dela. A distância entre as duas é o argumento de venda, e ela se
explica sozinha.

## 7. O que muda no site

**Metadados** (`src/app/layout.tsx:41-54`), quando a plataforma existir:

```
title:       Bruxário — quem você é, o que fazer, quando
description: O familiar que te escolheu, o calendário dos seus dias e um oráculo
             que lembra de você.
```

**OG do domínio** — hoje a imagem é do familiar. Passa a ser da plataforma, quando
ela existir. Os OG por pedido (`src/lib/og.ts`, `public/og/`) continuam do familiar,
porque ali o que circula é o resultado dela.

## 8. O que NÃO muda

Vale a mesma regra de `reestruturacao.md`: **a venda não para.**

- **A copy do funil de entrada não se toca** enquanto estiver convertendo. O
  gancho do familiar é o melhor que existe pra tráfego frio, e nada aqui autoriza
  mexer nele. Marca nova entra por cima, não por dentro.
- **Mudança de posicionamento entra medida.** Bio, metadados e OG são grátis de
  testar e reversíveis. Copy de funil é A/B (Fase 6), nunca troca direta.
- **Nada de rebrand.** Mesmo nome, mesma paleta, mesmas fontes (Cormorant, Sora,
  Pinyon), mesmos sigilos. O que muda é o escopo da promessa, não a cara.

## 9. Ordem de execução

Nada aqui depende da reforma do sistema, e nada aqui pode atrapalhar venda. Dá pra
fazer hoje:

1. Campo `nome` do Instagram — **cinco minutos, maior retorno da lista**
2. Bio nova
3. Destaques reorganizados na ordem do funil
4. Link direto com `?c=` (tirar agregador, se houver)
5. Começar o calendário semanal aberto como conteúdo — antes mesmo do produto
   existir, ele já ensina o público a esperar isso do Bruxário

Metadados e OG do site esperam a plataforma existir: prometer na aba do navegador
o que ainda não abre é o único jeito de essa mudança custar confiança.
