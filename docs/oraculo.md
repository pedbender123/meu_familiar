# O Oráculo — desenho das Fases 8 e 9

> Documento de desenho, escrito antes de existir código. Nada aqui está
> implementado ainda. A Fase 8/9 de `docs/reestruturacao.md` aponta pra cá.

## 1. A inversão que faz tudo funcionar

O ritual **não é enfeite em volta da IA**. A IA é o prêmio no fim de um ritual
que é quase todo determinístico e de graça: cartas com semente, posições
planetárias calculadas offline, trânsitos do calendário que já existem. Custo
zero.

Isso resolve duas coisas de uma vez: fica barato de rodar e fica *caro de
sentir*. Uma resposta que aparece em 2 segundos parece ChatGPT; a mesma
resposta depois de 40 segundos de cartas virando parece um oráculo.

---

## 2. As duas moedas

Duas cotas separadas, e a separação é o produto.

| | Mensagem | Leitura |
|---|---|---|
| Frequência | ~1/dia | 1–4/mês |
| Contexto | arquivo dela (com teto de consultas) + o texto que mandou + horóscopo do dia/semana | mapa + trânsitos + espetáculos + respostas do ritual + histórico |
| Experiência | chat direto, sem cerimônia | ritual cinematográfico |
| Tamanho | curta, duas linhas | longa |
| Custo | 1 chamada, contexto curto | 1 chamada (às vezes 2–3), contexto gordo |

A escassez da leitura é o que a torna valiosa. Se desse 30 por mês, não era
oráculo — e é a mensagem barata do dia a dia que faz a leitura parecer rara.

**A mensagem serve pra:** tirar dúvida sobre uma leitura anterior ("o que você
quis dizer com aquilo da Torre?") ou pedir um conselho curto. Ela pesa
**o que já sabe da pessoa + o horóscopo do dia/semana dela** — não é um chat
genérico, é o familiar respondendo com o céu de hoje na mão.

---

## 3. Os espetáculos

Cinco (ou seis), e a cada leitura **sorteia 2, em ordem qualquer**. Isso dá 20
pares ordenados — variedade suficiente pra um ano de leituras mensais sem
repetir a sensação.

O motivo de não ser sempre tarô: tarô toda vez vira decoração na terceira
leitura.

| Espetáculo | O que sorteia / lê | Por que este |
|---|---|---|
| **As cartas** | 3 cartas em posições | o clássico, o mais fácil de animar |
| **O céu de agora** | onde os planetas estão neste minuto, contra o mapa dela | **é real** — `astronomy-engine` já calcula. Ancora o resto na verdade |
| **A chama** | como a vela se comportou (curvou, estalou, quase apagou) | amarra no pedido de acender a vela; `Chama.tsx` já existe |
| **Os ossos** | punhado de runas/ossos lançados, lê a posição | o mais físico, o mais "jogo" |
| **A água** | o que sobe na superfície — presságios, imagens | o mais onírico, bom pra pergunta afetiva |
| **Os dias** *(candidato)* | puxa os dias de ouro e fechados do calendário dela | dado real e **já calculado** |

Cada espetáculo é um módulo que devolve **símbolos nomeados**, e é isso que
entra no prompt. A semente do sorteio fica registrada: leitura tem que ser
reproduzível.

---

## 4. Como garantir que o show entre na resposta

Isto é engenharia, não prompt. Pedir "cite as cartas" e torcer não basta — o
modelo esquece ou cita de raspão, e aí fica na cara que o show era enfeite.

A saída é **resposta estruturada com um campo por símbolo**:

```json
{
  "abertura": "...",
  "simbolos": [
    { "simbolo": "A Torre", "oQueDiz": "..." },
    { "simbolo": "Vênus em Escorpião", "oQueDiz": "..." }
  ],
  "conselho": "...",
  "fechamento": "..."
}
```

Se o campo existe, ele foi preenchido — a citação fica **impossível de
faltar**. De quebra a tela fica trivial: cada símbolo aparece com a animação
dele ao lado do texto que fala dele. Show e resposta costurados por
construção, não por sorte.

---

## 5. As perguntas — cena, não formulário

Não são passo fixo do ritual. São o **modelo pedindo o que falta**, no máximo
2 vezes, enfeitado como cena:

> *"A carta virou de costas. Antes de eu continuar — quando você pensa nisso,
> é mais medo de perder ou de nunca ter tido?"*
> · perder · nunca ter tido

Custo: uma chamada a mais **só quando ele pede**. Na maioria das leituras, uma
chamada só.

**Por que isso é o produto de verdade:** o tarô é fachada; as perguntas são
coleta de perfil psicológico com consentimento e prazer. A pessoa responde
porque é gostoso, não porque é formulário. E elas compõem — leitura após
leitura, o perfil engorda, e em seis meses o Oráculo sabe coisas que nenhum
chatbot sabe. É o que ninguém clona copiando o funil.

*Ponto em aberto:* pergunta gerada na hora é mais mágica, mas o dado nunca se
repete, então não dá pra comparar ao longo do tempo. Banco fixo escolhido por
tema dá dado comparável e custa zero. Provavelmente híbrido.

---

## 6. Dia de ouro muda o espetáculo

**A ideia mais forte deste desenho.** Quando a leitura cai num dia, semana ou
mês de ouro (`ehDiaDeOuro`, já implementado em
`src/modulos/calendario/pontuacao.ts`), o show muda visivelmente:

- **As cartas** — um "plim" de sorte dourada, e sai uma **quarta carta**, com
  moldura de ouro
- **O céu** — acende uma **constelação a mais**, a Constelação da Fortuna
- **A chama** — a vela dá um estalo e cresce
- **Os ossos** — um osso cai em pé
- **A água** — a superfície fica dourada por um instante

Sempre a mesma regra: **é um símbolo A MAIS**, nunca um símbolo diferente. O
extra também entra na resposta estruturada, então a leitura de dia de ouro é
mensurável e visivelmente mais rica.

### Por que isso vale mais que o efeito visual

Vira **motor de marketing e de retorno**:

- Post de Instagram: uma leitura feita num dia de ouro, com a quarta carta
  saindo
- E-mail no dia: *"hoje é o seu dia de fortuna — faça uma leitura"*
- **Inclusive para quem não tem crédito de leitura.** É o gatilho de upgrade
  mais honesto que existe: não é desconto artificial, é uma data que o mapa
  dela realmente marcou

E o dia de ouro é raro por construção (tem teste travando isso), então o
e-mail não vira ruído.

---

## 7. O arquivo e a memória

Cada leitura vira linha: espetáculos sorteados, semente, símbolos, respostas
das perguntas, trânsitos do dia, texto gerado.

O modo mensagem ganha uma **ferramenta de consulta com teto** (ex.: 3 buscas)
nesse arquivo. É isso que faz a mensagem barata continuar parecendo que ele
lembra de você.

Junto entram os guias semanais e conselhos, na mesma prateleira.

---

## 8. O ritmo, e o truque da latência

1. Preparo — vela, chuva, luz baixa (`AudioAmbiente`, `Chama.tsx`)
2. **Espetáculo 1** — animação completa
3. **Espetáculo 2** — animação completa
4. *(se o modelo pedir)* a cena-pergunta
5. A leitura longa, símbolo por símbolo, texto aparecendo escrito
   (`TextoEscrito.tsx`)

**O truque:** a chamada dispara no fim do passo 2, quando os símbolos já
existem. Os passos 3 e 5 cobrem a espera. Se a resposta chega antes, segura;
se demora, ainda há teatro pra gastar. **Pode levar tempo, mas nunca pode
parecer parado.**

---

## 9. Aleatoriza o show, nunca o prêmio

Regra de desenho, e ela é deliberada.

As cartas caem de qualquer jeito, a animação tem suspense, o dia de ouro
surpreende — mas a pessoa **sempre recebe a leitura dela**. No dia em que o
sorteio decidir *se* ela ganha algo, o produto vira outra coisa: uma que dá
problema com loja de aplicativo, com processador de pagamento e com regulação.

Dopamina de antecipação: ótima e é o objetivo.
Dopamina de aposta: não vale o risco.

---

## 10. Modelos

`src/nucleo/modelos.ts` já existe e resolve isto: modelo **por tarefa**,
trocável por variável de ambiente, sem redeploy.

```
BRUXARIO_MODELO_LEITURA=<...>        # a leitura paga
BRUXARIO_MODELO_ORACULO=<...>        # a mensagem diária
BRUXARIO_MODELO_ORACULO_FILA=<...>   # o free, se existir
```

Intenção declarada pelo dono (ago/2026): modelo da OpenAI para leitura e
mensagem paga, Gemma para o free, Gemini Flash Lite em chave gratuita para a
leitura grátis mensal — **se** o free existir. A prioridade é o pago
funcionar primeiro.

**Preços por milhão de tokens continuam zerados** em `modelos.ts` e precisam
ser preenchidos com a fatura real antes de a margem da Fase 11 significar
alguma coisa.

---

## 11. Ordem de construção

1. **Cota de duas travas** — mensagens/dia e leituras/mês, em transação
2. **Uma leitura ponta a ponta, só no pago** — dois espetáculos (cartas + céu),
   resposta estruturada, uma chamada
3. **O arquivo** + a ferramenta de consulta com teto
4. Os outros três espetáculos
5. As variações de dia de ouro
6. **A mensagem diária** (a parte simples)
7. O free — por último, ou nunca

Sobre o 2 antes do 1: é mais rápido olhar uma leitura de verdade rodando e
dizer "é isso" ou "não é isso" do que construir os cinco espetáculos e
descobrir que o ritmo está errado.
