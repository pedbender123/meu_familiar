# Prompt para escrever um ebook da biblioteca

Cole isto no Antigravity (ou em qualquer agente com acesso a esta pasta),
trocando o que está entre `<>`.

O material extraído dos PDFs está em `biblioteca/texto/*.txt`. Ele é **fonte
de assunto**, não texto a reaproveitar — a razão está na seção "Por que não é
reescrita" no fim deste arquivo.

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
Tamanho: <N> módulos, <N> capítulos por módulo, 400 a 700 palavras por capítulo.

Fonte de ASSUNTO (leia para saber do que se trata, não para copiar):
<CAMINHO DO .txt EM biblioteca/texto/>

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
- Não encha linguiça para bater a contagem de palavras: capítulo curto e denso
  é melhor que capítulo longo e diluído.
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
    const praticas = c.blocos.filter(b => b.tipo === 'pratica').length;
    console.log('   ', c.titulo, '·', c.som ?? 'sem som', '·', c.minutos + 'min', '·', praticas + ' prática(s)');
  }
}
"
```

Se aparecer um capítulo chamado `Abertura` que você não escreveu, sobrou texto
antes do primeiro `##`. Se um capítulo veio sem prática, o modelo esqueceu o
bloco.
