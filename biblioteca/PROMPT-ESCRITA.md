# Prompt para escrever um ebook da biblioteca

Cole isto no Antigravity (ou em qualquer agente com acesso a esta pasta),
trocando o que está entre `<>`.

O material extraído dos PDFs está em `biblioteca/texto/*.txt`. Ele é **fonte
de assunto**, não texto a reaproveitar — a razão está na seção "Por que não é
reescrita" no fim deste arquivo.

---

## Antes de colar: o tamanho

A primeira leva saiu com 6 a 7 capítulos de ~400 palavras — **um livro de 15
minutos**. Está no formato certo e é curto demais para o preço.

Modelo de linguagem encolhe sozinho quando você pede "um capítulo": ele
entrega a versão resumida do que sabe. A correção não é pedir "escreva mais",
que produz enchimento — é dar **estrutura suficiente para o tamanho ser
consequência**. Por isso o prompt abaixo pede seções nomeadas dentro de cada
capítulo, e um capítulo por vez.

Alvo: **3 a 5 módulos, 4 a 6 capítulos por módulo, 900 a 1.400 palavras por
capítulo.** Isso dá um livro de 60 a 90 minutos de leitura, que é o que
justifica R$ 9,90 a R$ 17,90.

O leitor quebra capítulo longo em folhas de ~290 palavras sozinho — um
capítulo de 1.200 vira quatro páginas de pergaminho, com o título só na
primeira. Você não precisa paginar nada.

**Peça um capítulo por vez.** Pedir o livro inteiro numa mensagem é o jeito
mais confiável de receber 5.000 palavras rasas: o modelo divide o orçamento
que ele acha que tem e cada capítulo sai pela metade.

---

## O prompt

````
Você vai escrever um ebook original para o Bruxário, em português do Brasil.

## O que é o Bruxário

Um produto que faz um ritual de 26 cenas e revela qual dos doze familiares de
bruxa caminha com a pessoa. O tom é sério, íntimo e concreto: pergaminho, vela,
noite. **Nunca** é astrologia de revista, nunca promete sorte, nunca usa
"energias positivas" nem "universo conspirando".

A regra de voz que vale acima de todas: **o Bruxário não promete resultado, ele
descreve prática.** Onde um livro de autoajuda diria "você vai atrair
abundância", aqui se diz "faça isto por sete noites e repare no que muda na
forma como você acorda". A diferença é entre vender milagre e ensinar ofício.

Trate quem lê como adulta. Ela escolheu isso, pagou por isso, e já ouviu
promessa vazia demais.

## O que escrever

Título do ebook: <TÍTULO>
Assunto: <ASSUNTO EM UMA FRASE>

Fonte de ASSUNTO (leia para saber do que se trata, não para copiar):
<CAMINHO DO .txt EM biblioteca/texto/>

## O tamanho, que é a parte que costuma sair errada

3 a 5 módulos. 4 a 6 capítulos por módulo. **900 a 1.400 palavras por
capítulo** — e essa faixa não é sugestão, é o piso do produto.

Um capítulo abaixo de 900 palavras é um resumo, e resumo é o que sai por
padrão quando ninguém pede o contrário. Se você chegar ao fim de um capítulo
com 600 palavras, o problema não é falta de espaço: é que faltou desenvolver
alguma das quatro seções abaixo.

**Cada capítulo tem estas quatro partes, nesta ordem, sem subtítulo nenhum
separando — o texto corre inteiro:**

1. **O erro comum** (150–250 palavras). Como quase todo mundo entende essa
   matéria errado, e o que isso custa na prática. Sempre comece por aqui: é o
   que faz quem já sabe alguma coisa continuar lendo.
2. **O que é de verdade** (300–450). A explicação, com o mecanismo. Não basta
   afirmar que funciona — diga *por que*, mesmo que o porquê seja
   psicológico e não sobrenatural. O Bruxário nunca pede fé.
3. **Um caso concreto** (200–350). Uma situação inteira, com pessoa, contexto
   e desfecho. Inventada, e escrita como cena — não como exemplo hipotético
   em uma frase. É o pedaço que a pessoa vai lembrar daqui a um mês.
4. **O aviso** (100–200). Onde essa técnica falha, para quem ela não serve, ou
   o excesso que ela produz. Um livro que só elogia a própria matéria é
   panfleto, e o leitor sente.

Só então vem o bloco `:::pratica`.

## Uma mensagem, um capítulo

Não escreva o livro todo de uma vez. Escreva o esqueleto primeiro — módulos e
títulos de capítulo — e depois **um capítulo por resposta**, na íntegra.

Livro inteiro numa mensagem só produz 5.000 palavras rasas: o orçamento é
dividido e cada capítulo sai pela metade. Um por vez, cada um com as quatro
partes completas.

Ao terminar cada capítulo, acrescente-o ao arquivo `.md` em vez de reescrever
o arquivo inteiro.

## A regra mais importante

**Não reescreva a fonte. Escreva sobre o mesmo assunto.**

Leia a fonte para aprender a matéria — os nomes, as correspondências, a ordem
em que as coisas se ensinam. Depois feche e escreva do zero, com as suas
palavras e a voz do Bruxário.

Concretamente:
- Nenhuma frase da fonte aparece no seu texto, nem parafraseada de perto.
- A estrutura dos capítulos é sua, não a da fonte.
- Os exemplos são seus.
- Fato e técnica podem vir da fonte (ninguém é dono de "o fogo corresponde à
  vontade"). A maneira de dizer é sua.

Se um trecho seu ficaria reconhecível ao lado da fonte, reescreva do zero.

## Prática e som

Todo capítulo termina num bloco `:::pratica` — a coisa que a pessoa FAZ.
Sem isso o livro vira teoria e ninguém volta ao capítulo dois.

A prática precisa ser executável hoje, sem comprar nada, em cinco a quinze
minutos, num quarto normal. "Acenda uma vela e observe a chama por três
minutos" é uma prática. "Alinhe seus chakras" não é.

Cada capítulo pede uma trilha de fundo com `som: <id>`. Use um destes:

    respiracao   silencio-com-vento   fogo-crepitar   agua-corrente
    chuva-longe  floresta-noite       tigela-tibetana  batida-lenta

Escolha pelo que a prática pede, não pelo tema do capítulo: uma prática de
concentração pede `respiracao`, uma de visualização longa pede `agua-corrente`.
Capítulo só de teoria pode ficar sem som.

**As trilhas ainda não existem.** Escreva como se existissem — o texto nunca
pode depender do som para fazer sentido, porque quem ler antes de elas
subirem vai ler em silêncio e não pode perceber falta nenhuma.

## O formato do arquivo

Grave em `biblioteca/texto/<id>.md`, exatamente assim:

```markdown
---
id: <id-em-minusculas-com-hifen>
titulo: <título do ebook>
promessa: <uma linha, o que a pessoa sai sabendo fazer>
---

# Módulo 1 — <nome do módulo>

## <título do capítulo>
som: fogo-crepitar

Parágrafos normais. Quebra de linha dentro do parágrafo é livre — o que
separa dois parágrafos é a linha em branco.

:::pratica
O que a pessoa faz agora. Instrução direta, na segunda pessoa.
:::

## <próximo capítulo>
som: respiracao

...
```

Regras do formato, todas checadas por `lerLivro` em
`src/nucleo/biblioteca/formato.ts`:

- `#` é módulo, `##` é capítulo. Nada de `###`.
- `som:` vem imediatamente abaixo do `##`, antes de qualquer texto.
- `:::pratica` abre e `:::` fecha, cada um sozinho na linha.
- Sem imagens, sem tabelas, sem links.

## O que não fazer

- Não invente que o Bruxário tem função que não foi citada aqui.
- Não prometa cura, dinheiro, amor ou proteção contra nada.
- Não trate o leitor como iniciante burro nem como iniciado que já sabe tudo.
- **Não encha linguiça para bater a contagem.** A meta de palavras se atinge
  desenvolvendo as quatro partes, nunca esticando frases. Se você se pegar
  escrevendo "como vimos anteriormente" ou repetindo em outras palavras o que
  já foi dito, apague e desenvolva o caso concreto — é sempre ele que está
  curto quando o capítulo não fecha o tamanho.
- Não escreva subtítulo dentro do capítulo. As quatro partes são estrutura
  para VOCÊ, não seções na tela: o texto corre inteiro, e é o `:::pratica` que
  quebra a folha.
````

---

## Por que não é reescrita

Técnica e ideia não têm direito autoral; **texto tem**. Um capítulo que
parafraseia de perto continua sendo obra derivada, e ninguém precisa provar
plágio palavra por palavra para causar problema — basta o texto ser
reconhecível.

Escrever do zero sobre o mesmo assunto resolve as duas coisas ao mesmo tempo:
sai do risco e produz um livro que soa como o resto do produto, em vez de um
PDF de outra pessoa com a nossa capa.

## Depois que o `.md` existir

O arquivo é lido por `lerLivro`. Para conferir se o formato saiu certo antes de
publicar:

```bash
npx tsx -e "
import { lerLivro } from './src/nucleo/biblioteca/formato';
import fs from 'fs';
const l = lerLivro(fs.readFileSync('biblioteca/texto/<id>.md','utf8'));
console.log(l.meta, l.modulos.length + ' módulos', l.palavras + ' palavras', l.minutos + ' min');
for (const m of l.modulos) {
  console.log('#', m.titulo);
  for (const c of m.capitulos) {
    const palavras = c.blocos.reduce((s, b) =>
      s + b.paragrafos.reduce((t, p) => t + p.split(/\\s+/).length, 0), 0);
    const praticas = c.blocos.filter(b => b.tipo === 'pratica').length;
    const curto = palavras < 900 ? '  ← CURTO' : '';
    console.log('   ', c.titulo, '·', palavras + ' palavras ·', c.som ?? 'sem som', '·', praticas + ' prática(s)' + curto);
  }
}
"
```

Se aparecer um capítulo chamado `Abertura` que você não escreveu, sobrou texto
antes do primeiro `##`. Se um capítulo veio sem prática, o modelo esqueceu o
bloco.

**Confira o tamanho, que é o que costuma vir errado.** O comando imprime as
palavras de cada capítulo. Menos de 900 num capítulo quer dizer que ele saiu
resumido — mande reescrever aquele capítulo específico, citando qual das
quatro partes ficou curta. Reescrever um capítulo é barato; descobrir na hora
de publicar que o livro inteiro tem 2.000 palavras não é.

Referência do que dá um livro que se paga:

| | palavras | leitura |
| --- | --- | --- |
| Curto demais | menos de 8.000 | menos de 40 min |
| Alvo | 18.000 a 30.000 | 90 a 150 min |
