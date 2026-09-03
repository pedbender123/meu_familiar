# Prompt para escrever um ebook da biblioteca

Cole isto no Antigravity (ou em qualquer agente com acesso a esta pasta),
trocando o que está entre `<>`.

O material extraído dos PDFs está em `biblioteca/texto/*.txt`. Ele é **fonte
de assunto**, não texto a reaproveitar — a razão está na seção "Por que não é
reescrita" no fim deste arquivo.

---

## Antes de colar: a matemática das páginas e o tamanho

O leitor do app quebra o texto em folhas de pergaminho de **~290 palavras**
(`PALAVRAS_POR_PAGINA = 290` em `src/nucleo/biblioteca/formato.ts`).

A primeira leva saiu com 6 a 7 capítulos de ~250 palavras — **um livro de 8
minutos**, onde cada capítulo cabia numa única folha de tela. Isso é um panfleto,
não um livro que justifica alguém pagar R$ 9,90 a R$ 17,90 para ler no pergaminho.

Nosso padrão do produto: **cada capítulo precisa ter pelo menos 8 a 12 páginas de
pergaminho no leitor (alvo: 10 páginas por capítulo)**.

Fazendo as contas:
- 10 páginas de pergaminho × 290 palavras = **2.500 a 3.200 palavras por capítulo**.
- Um livro com 6 a 8 capítulos terá **18.000 a 26.000 palavras** (70 a 90 páginas
  de pergaminho no total).
- Isso dá uma leitura substancial de **90 a 130 minutos** (a 200 palavras por minuto),
  com 12 a 16 minutos por capítulo. É o que transforma o app num grimório de verdade.

### Por que o modelo encolhe e como resolver

Modelos de linguagem resumem por padrão. Se você pedir apenas "escreva um
capítulo longo", ele para com 700 palavras e jura que desenvolveu tudo. Se você
pedir "escreva 3.000 palavras" sem dar o mapa, ele preenche com enrolação e
frases redundantes.

A única forma de produzir 2.500 a 3.200 palavras densas, ricas e sem encher
linguiça é fornecer uma **arquitetura interna com 6 movimentos obrigatórios**,
com objetivos narrativos e sensoriais claros em cada um.

**Peça um capítulo por vez.** Pedir o livro inteiro numa mensagem é o jeito mais
confiável de receber 3.000 palavras rasas divididas por 6 capítulos. O fluxo é
sempre: um capítulo por resposta, conferido no terminal antes de ir para o próximo.
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

## O tamanho obrigatório: 10 páginas por capítulo

O leitor do app quebra o texto em páginas de ~290 palavras. Para que o leitor
tenha a experiência de um livro de verdade, **cada capítulo precisa ter entre
2.500 e 3.200 palavras** (o equivalente a 9 a 12 páginas de pergaminho).

Qualquer capítulo abaixo de 2.200 palavras é considerado incompleto e será
rejeitado para reescrita.

Para atingir essa densidade com profundidade e sem enrolação, **cada capítulo
precisa desenvolver integralmente os 6 movimentos abaixo, nesta ordem exata,
como texto corrido** (sem subtítulos de Markdown — o texto flui contínuo em
parágrafos até o bloco `:::pratica`):

---

### Os 6 movimentos obrigatórios de cada capítulo

1. **A Desmistificação e a Anatomia do Engano** (350–500 palavras | ~1,5 páginas)
   - Desmonte a caricatura da cultura pop, das redes sociais ou do esoterismo
     comercial sobre esse tema.
   - Mostre como as pessoas abordam isso errado: a pressa, a busca por
     espetáculo visual, a expectativa ingênua de que a matéria se dobra ao
     desejo sem esforço.
   - Descreva a frustração concreta de quem tenta fazer do jeito errado (a
     agitação mental, o cansaço, a sensação de que nada aconteceu).
   - Mostre o custo invisível desse engano: como a busca por pirotecnia cega a
     pessoa para a percepção sutil que estava ali o tempo todo.

2. **A Mecânica Subjacente e os Fundamentos Ocultos** (700–900 palavras | ~2,5 a 3 páginas)
   - Aprofunde a técnica real. Como essa força ou princípio funciona de verdade?
     Explique o mecanismo invisível sem recorrer a fé cega: a relação entre
     atenção focada, matéria, silêncio e psicologia profunda.
   - A fisiologia do ofício: o que o corpo físico experimenta (respiração,
     tensão muscular, temperatura das mãos, pulso, o que os órgãos e os sentidos
     percebem antes da mente formular em palavras).
   - As correspondências e a física do ofício: elementos, direções, tempos do
     dia ou da noite, peso da matéria.
   - A gradação: como essa força se manifesta em níveis — do quase imperceptível
     ao evidente, e por que a repetição diária constrói uma trilha na mente.

3. **A Crônica de Ofício: Caso Narrativo em Profundidade** (800–1.000 palavras | ~3 páginas)
   - Uma cena inteira, com densidade de conto literário, ambientada no mundo
     contemporâneo real. Não é um exemplo hipotético de duas frases: é uma
     narrativa completa.
   - A personagem e o cenário: dê nome, profissão ou rotina comum, detalhes
     sensoriais do ambiente (a luz fria da cozinha de madrugada, o café
     esfriando na mesa, o barulho distante de carros na avenida, a poeira
     suspensa no ar).
   - O conflito: uma questão concreta de vida (um desgaste prolongado, uma
     escolha que paralisa, uma perda, uma atmosfera pesada que se instalou na
     casa).
   - O erro inicial: a tentativa da personagem de resolver com impulsividade ou
     da forma superficial que ela achava que funcionava.
   - A virada na prática: ela aplicando com disciplina exata a técnica deste
     capítulo. O silêncio, a resistência interna, a mudança sutil no corpo.
   - O desfecho sóbrio: o que realmente mudou dias depois. Sem milagres de
     cinema; uma mudança de postura firme, um silêncio restaurado, uma
     decisão lúcida executada sem tremor.

4. **As Armadilhas, Alucinações e Contraindicações** (350–500 palavras | ~1,5 páginas)
   - Onde essa técnica vira veneno: a linha exata que separa percepção e
     intuição real de fantasia mental, autoengano ou ansiedade projetada.
   - Sintomas de descompasso: sinais de que a pessoa está exagerando, ficando
     obsessiva ou usando o ofício para fugir dos seus problemas mundanos.
   - Para quem essa prática NÃO serve neste momento: momentos de fragilidade
     psicológica aguda, períodos de desespero financeiro ou emocional onde a
     mente não tem chão para a quietude.
   - O princípio da sobriedade: a magia do Bruxário sempre precisa deixar a
     pessoa mais funcional, lúcida e presente no mundo ordinário, e nunca mais
     alienada.

5. **A Liturgia Doméstica: Transição e Preparação** (250–350 palavras | ~1 página)
   - Como preparar o quarto, a sala ou a mesa antes de começar.
   - Condições mínimas: luz baixa de vela, circulação de ar, roupas confortáveis,
     eliminação de notificações e distrações sonoras.
   - O rito de descompressão: como transitar da agitação mecânica do trabalho ou
     do dia para o estado de vigília e presença que a prática exige.

6. **O Roteiro da Prática (`:::pratica`)** (350–500 palavras | ~1,5 páginas)
   - Instrução minuciosa, direta, na segunda pessoa ("você").
   - Itens necessários: apenas objetos simples de casa (uma tigela com água,
     uma vela comum, um fósforo, papel comum e grafite, etc.).
   - Passo 1 — O Assento e o Ritmo da Respiração: postura física e contagem
     (minutos exatos, ritmo inspirar-reter-soltar).
   - Passo 2 — A Ação Focal: o que fazer com as mãos, com o olhar e com a
     atenção nos primeiros 5 minutos.
   - Passo 3 — O Teste do Silêncio e a Sustentação: como lidar com a enxurrada
     de pensamentos que vai surgir e onde fixar a percepção.
   - Passo 4 — O Selamento e o Registro: o gesto de fechamento (lavar as mãos
     com água fria, apagar o fogo sem sopro violento) e o que anotar exatamente
     no caderno (a hora, a sensação física e o que permaneceu).

---

## Uma mensagem, um capítulo

**JAMAIS escreva o livro todo de uma vez.**

Pedir o livro inteiro numa mensagem só divide o orçamento de tokens do modelo
e produz 3.000 palavras rasas espalhadas por 6 capítulos.

O processo é estritamente sequencial:
1. Escreva o esqueleto primeiro (módulos e títulos dos capítulos).
2. Escreva **um capítulo por resposta**, na íntegra, desenvolvendo os 6
   movimentos completos (2.500 a 3.200 palavras).
3. Ao terminar cada capítulo, acrescente-o ao arquivo `.md` em vez de reescrever
   o arquivo inteiro, e confira a contagem no terminal.

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
  desenvolvendo a fundo os 6 movimentos (especialmente o mecanismo, a crônica
  narrativa em detalhes literários e a prática passo a passo), nunca esticando frases.
  Se você se pegar escrevendo "como vimos anteriormente" ou repetindo em outras
  palavras o que já foi dito, apague e desenvolva a crônica ou o mecanismo — são
  sempre eles que estão curtos quando o capítulo não fecha o tamanho.
- Não escreva subtítulo dentro do capítulo. Os 6 movimentos são estrutura
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

## Depois que o `.md` existir: a conferência de páginas

O arquivo é lido por `lerLivro` e paginado por `paginarCapitulo`. Para conferir
se o formato saiu certo e se atingiu as **10 páginas por capítulo** antes de
publicar:

```bash
npx tsx -e "
import { lerLivro, paginarCapitulo } from './src/nucleo/biblioteca/formato';
import fs from 'fs';

const id = process.argv[1] || 'magia-elemental';
const caminho = 'biblioteca/texto/' + id + '.md';

if (!fs.existsSync(caminho)) {
  console.error('Arquivo não encontrado:', caminho);
  process.exit(1);
}

const l = lerLivro(fs.readFileSync(caminho, 'utf8'));
let totalPaginas = 0;

console.log('\\n======================================================');
console.log(' LIVRO:', l.meta.titulo ?? id);
console.log(' Módulos:', l.modulos.length, '| Palavras:', l.palavras, '| Leitura:', l.minutos, 'minutos');
console.log('======================================================\\n');

for (const m of l.modulos) {
  console.log('#', m.titulo);
  for (const c of m.capitulos) {
    const palavras = c.blocos.reduce((s, b) =>
      s + b.paragrafos.reduce((t, p) => t + p.split(/\\s+/).filter(Boolean).length, 0), 0);
    const paginas = paginarCapitulo(c).length;
    totalPaginas += paginas;
    const praticas = c.blocos.filter(b => b.tipo === 'pratica').length;
    const status = paginas < 8
      ? '  ← CURTO (' + paginas + ' págs, meta: 10 págs / 2.500+ pal)'
      : '  ✓ (' + paginas + ' págs)';

    console.log('   ##', c.titulo);
    console.log('      ' + palavras + ' palavras | ' + paginas + ' páginas | som: ' + (c.som ?? 'nenhum') + ' | ' + praticas + ' prática(s)' + status);
  }
}

console.log('\\nTOTAL DO LIVRO:', totalPaginas, 'páginas de pergaminho.');
if (totalPaginas < 60) {
  console.log('ALERTA: Livro curto demais para o leitor (' + totalPaginas + ' págs)! Expanda os capítulos marcados.\\n');
} else {
  console.log('✓ LIVRO VOLUMOSO: ' + totalPaginas + ' páginas de pergaminho prontas para o leitor.\\n');
}
" <id-do-livro>
```

Se aparecer um capítulo chamado `Abertura` que você não escreveu, sobrou texto
antes do primeiro `##`. Se um capítulo veio sem prática, o modelo esqueceu o
bloco.

**Confira as páginas de cada capítulo.** Menos de 8 páginas num capítulo quer dizer
que ele saiu resumido — mande o agente reescrever aquele capítulo específico,
apontando qual dos 6 movimentos ficou raso (na grande maioria das vezes, foi a
crônica narrativa ou o mecanismo). Reescrever um capítulo é rápido; descobrir
depois que o cliente pagou por um livro de 10 minutos quebra o produto.

Referência do que dá um livro que se paga:

| Classificação | Palavras / Cap. | Páginas / Cap. | Total no Livro (6-8 caps) | Tempo Total de Leitura |
| --- | --- | --- | --- | --- |
| **Inaceitável (panfleto)** | menos de 500 | 1 a 2 páginas | menos de 15 páginas | 7 a 10 min |
| **Abaixo do ideal** | 800 a 1.400 | 3 a 5 páginas | 25 a 40 páginas | 35 a 55 min |
| **Alvo do Bruxário** | **2.500 a 3.200** | **9 a 12 páginas** | **70 a 95 páginas** | **100 a 140 min** |
