# BRUXÁRIO — Fundação Teórica e Arquitetural
## Documento-base do remodelamento: de produto único para plataforma
**Versão 1 · Julho de 2026**

---

## Aviso ao leitor (importante, não pule)

Este documento cita instrumentos e teorias reais para dar chão ao sistema. Duas
honestidades antes de qualquer coisa:

1. **Construir sobre construtos validados não valida o seu produto.** O Bruxário
   não é um instrumento psicométrico e não deve jamais ser apresentado como tal.
   O que este documento dá é o oposto do vale-tudo: um teste que mede algo
   coerente, com itens de domínio público e critérios de qualidade auditáveis —
   e que, por isso, não pode ser descartado como "chute com nome bonito".
2. **Referências e regulação mudam.** Datas de resoluções, licenças de escalas e
   números de canais de apoio precisam ser conferidos antes do lançamento. Onde
   há risco jurídico, o documento marca `[CONFIRMAR]`.

---

# PARTE 0 — RECORTE V0: VENDER A LEITURA

> **Este é o plano em vigor.** As Partes I a X seguem valendo como destino, mas
> nada delas entra agora além do que está listado aqui. Se estiver em dúvida se
> algo é v0, a resposta é não.

## 0.1 O objetivo único

Vender a leitura do familiar, com o quiz novo e com Mercado Pago — e o produto
precisar **parecer o começo de algo**, não a compra de um PNG.

## 0.2 O que o recorte elimina (e é muito)

| Fica de fora | Consequência boa |
|---|---|
| Assinaturas / `/preapproval` | v0 usa **só Checkout Bricks**, que você já tem |
| Ritual de vínculo (religião, apego, apoio) | **sem dado sensível** → sem art. 11, sem consentimento destacado, Política de Privacidade curta |
| Dossiê, memória, tools, continuidade | nenhum agente com estado; cada pergunta é independente |
| Mensagens proativas, WhatsApp | nenhum canal de saída para operar |
| Crescimento, conquistas | nenhuma mecânica de progresso |

**O que NÃO fica de fora, ao contrário do recorte inicial:** a camada de
vigilância. Ver 0.4.

## 0.3 Os dois produtos

| | Revelação — R$ 9,80 | Completa — R$ 18,90 |
|---|---|---|
| Familiar + leitura essencial | ✅ | ✅ |
| Carta de revelação compartilhável | ✅ | ✅ |
| Leitura longa | — | ✅ |
| Roda dos 12 escores | — | ✅ |
| Perfil público permanente (URL) | — | ✅ |
| Perguntas ao oráculo | 3 (do cadastro) | 6 |
| Tiragem diária | — | ✅ |

**O link compartilhável foi separado em duas coisas**, e isso é deliberado:

- **Carta de revelação** — imagem, nome do familiar, uma linha. **Todo mundo
  ganha, inclusive quem não comprou nada.** É o motor de aquisição; trancá-la
  atrás do plano caro significaria que só quem paga mais divulga o produto.
- **Perfil público permanente** — URL própria, roda dos 12 escores, a leitura.
  Esse é o diferencial da Completa.

Regra de precificação: o dobro do preço precisa ser **legível na tela**. "R$ 9,80
ou R$ 18,90 com um link" não justifica; a soma acima justifica.

## 0.4 As 3 perguntas grátis — e a vigilância que elas obrigam

**Quem se cadastra ganha 3 perguntas ao oráculo, mesmo sem comprar.** É a
degustação do produto futuro e a melhor peça de captura do v0.

Versão v0 do oráculo:
- Pergunta da pessoa + **perfil de eixos e 12 escores** + voz do familiar
- Sem memória, sem dossiê, sem tools. Cada pergunta é independente.
- Verificação de e-mail **antes** de liberar as perguntas — senão é oráculo
  grátis infinito com contas descartáveis

**Não faça genérico.** Conselho tipo horóscopo de jornal queima a degustação: se
as 3 perguntas soarem impessoais, ninguém espera o Oráculo de verdade. E a
personalização já está paga — o quiz de 26 itens entrega os eixos e os escores,
e usá-los custa zero a mais.

**Guarde todas as perguntas.** Descobrir o que as pessoas realmente perguntam a
um oráculo vale mais que qualquer especulação para desenhar o corpus da Parte IV.

**Fim da terceira pergunta:** uma linha na voz do familiar e um campo de e-mail —
*"minhas três respostas acabaram; quando eu puder te acompanhar de verdade,
quer saber?"*. Essa lista é o ativo mais valioso que o v0 gera, porque é gente
que já experimentou.

### Vigilância mínima (obrigatória, porque existe texto livre)

Campo de pergunta livre a um oráculo recebe, previsivelmente, coisas como
violência doméstica e ideação suicida — talvez não na primeira semana, mas antes
do centésimo usuário. Não é o subsistema completo da Parte V; é isto:

1. **Lista determinística de gatilhos** — roda antes de qualquer IA
2. **Classificador no 3.1 flash-lite** — rótulo + severidade
3. **Falha segura** — erro, timeout ou JSON inválido = tratar como sinal
4. **Protocolo** — sai do personagem, CVV 188, **não tira carta**, não continua
5. **Registro do evento** em tabela própria

Aproximadamente um dia de trabalho. Inegociável enquanto o campo existir. A
única alternativa seria fazer as 3 perguntas em múltipla escolha — o que mata a
graça e não vale a economia.

## 0.5 O que entra

**Quiz novo (Parte II inteira aplicada)**
- 26 itens, circumplexo de 2 eixos, cargas por opção
- Signo com peso zero; 27ª pergunta só em empate real
- Os 12 escores de afinidade calculados e **salvos**
- Janela de 7 dias para refazer, máx. 2 vezes, com aviso

**Conta**
- Cadastro leve: nome, e-mail, data/hora/local de nascimento
- A leitura mora num **endereço permanente**, não num arquivo

**Leitura**
- Gemini 3.5 flash-lite, na voz do familiar
- Imagem compartilhável como **subproduto**, não como o produto

**Pagamento**
- **Payment Brick**, um módulo com todos os meios: cartão de crédito, Pix,
  boleto, cartão de débito virtual Caixa, Conta Mercado Pago e Linha de Crédito
- Dois produtos (0.3), webhook como única fonte de verdade, idempotência,
  validação de assinatura

**Oráculo simples**
- 3 perguntas grátis por conta verificada, 6 na Completa
- Vigilância mínima obrigatória (0.4)
- Captura de e-mail ao fim das perguntas

**Tiragem diária**
- Uma carta, RNG no servidor, seed salvo
- 2–3 frases na voz do familiar, uma chamada curta
- Custo por tiragem: fração de centavo
- Exclusiva da Completa

**Páginas legais (versão enxuta)**
- Política de Privacidade sem a seção de dado sensível
- Termos de Uso com natureza do serviço, idade mínima, arrependimento de 7 dias
- Micro-avisos: antes do quiz, na revelação, no rodapé da leitura, antes da
  primeira pergunta ao oráculo

## 0.5.1 Como fazer parecer plataforma sem construir plataforma

**Regra negativa primeiro: nenhum "Em breve", nenhum cadeado, nenhum botão
desabilitado.** Selo de recurso futuro lê-se como produto inacabado, não como
produto que vai crescer. É o erro mais comum e o mais fácil de evitar.

O que funciona, em ordem de retorno sobre esforço:

1. **Conta em vez de download.** "Seu familiar está no seu Bruxário" é outra
   categoria de produto que "baixe seu PDF". Custo: quase zero. Efeito: máximo.
2. **Algo que muda sozinho.** A tiragem diária é a única peça que dá motivo para
   voltar amanhã. Sem ela, o produto é estático por definição.
3. **A roda dos 12 escores.** Você já calcula tudo para escolher o vencedor —
   mostrar a distribuição é de graça, é printável, e implica profundidade sem
   prometer nada.
4. **Voz no presente, não relatório.** O familiar diz *"te encontrei"*, não
   "você é assim". E pode admitir que ainda não sabe tudo: *"tem coisas suas que
   eu vou levar um tempo pra entender"*. Teaser dentro da ficção funciona;
   teaser na interface não.

## 0.6 Funil

- **Grátis:** quiz + revelação do familiar + carta compartilhável + 3 perguntas
  ao oráculo (com e-mail verificado) → aquisição e degustação
- **R$ 9,80:** leitura essencial
- **R$ 18,90:** leitura longa + roda dos 12 escores + perfil público + 6
  perguntas + tiragem diária
- **Captura:** e-mail de espera ao fim das perguntas grátis → lista para o
  lançamento do Oráculo

## 0.7 Ordem de construção (otimizada para internet ruim)

**Offline — faça agora, não precisa de rede:**
1. Motor de pontuação do quiz: cargas → eixos → ângulo → 12 escores. Lógica
   pura, testável no terminal.
2. Escrever os 26 itens com seus vetores de carga.
3. Escrever o caso-exemplo nas 12 vozes (few-shot da Parte IX).
4. Escrever a lista determinística de gatilhos da vigilância.

**Online — quando a conexão permitir:**
5. Cadastro com verificação de e-mail + endereço permanente da leitura
6. Geração da leitura com 3.5 flash-lite
7. Vigilância mínima (classificador + protocolo)
8. Oráculo simples, 3 perguntas
9. Payment Brick + webhook, dois produtos
10. Perfil público e roda dos 12 escores
11. Tiragem diária
12. Páginas legais

## 0.8 O que já precisa existir para não travar o futuro

Três coisas baratas agora que evitam retrabalho depois:
- **12 escores salvos**, não só o vencedor
- **Histórico append-only** desde o primeiro dia, incluindo as perguntas ao
  oráculo
- **Desafios como entidade no banco**, mesmo vazia

## 0.9 Pendências do v0

| Item | Status |
|---|---|
| Preços R$ 9,80 / R$ 18,90 | ✅ definidos, revisar após primeiras vendas |
| 18+ ou não (trava Termos e Política) | ⏳ pendente |
| Tiragem diária ou semanal | ⏳ pendente |
| As 3 perguntas grátis expiram ou são vitalícias | ⏳ pendente |

---

# PARTE I — O PRINCÍPIO-MESTRE

## 1.1 Duas camadas, nunca misturadas

Todo o sistema se organiza em duas camadas que **nunca** se contaminam:

| | Camada mensurável | Camada simbólica |
|---|---|---|
| O que é | traços, valores, rede de apoio, histórico | familiar, cartas, luas, mapa da hora |
| De onde vem | itens de escala, comportamento registrado | quiz + sorteio + cálculo astronômico |
| Função | **decidir** o conteúdo do conselho | **entregar** o conselho de forma que entre |
| Pode errar? | precisa ser auditável e corrigível | é ritual, não é predição |

A frase que resolve 90% das dúvidas de design: **a camada mensurável decide o
QUE dizer; a camada simbólica decide COMO dizer.** Se em algum ponto a carta
sorteada mudar a substância do conselho, o desenho quebrou.

## 1.2 Por que a camada simbólica não é enfeite (e tem base acadêmica)

Isso é o que sustenta seu "o espiritual é tempero" contra a acusação de
picaretagem — e a literatura está do seu lado, desde que você não prometa
predição.

- **Modelo contextual / fatores comuns (Wampold).** A pesquisa comparativa em
  psicoterapia sugere que boa parte do efeito não vem da técnica específica, mas
  de três coisas: vínculo real, uma explicação plausível que dá sentido ao
  sofrimento, e um conjunto de ações concretas derivadas dessa explicação. O
  familiar é vínculo; o simbolismo é a explicação que dá sentido; o próximo
  passo é a ação. Você não está fingindo um mecanismo — está usando um mecanismo
  documentado.
- **Rituais e regulação emocional (Norton & Gino, entre outros).** Sequências
  ritualizadas — mesmo arbitrárias, mesmo sabidamente arbitrárias — reduzem
  ansiedade antes de eventos e ajudam no luto. O sorteio, a vela, a fase da lua:
  ritual funcional, não decoração.
- **Identidade narrativa (McAdams).** Pessoas organizam a própria vida como
  história, e a *forma* dessa história (sobretudo arcos de redenção) associa-se
  a bem-estar. O familiar é um dispositivo de identidade narrativa: dá à pessoa
  um personagem com quem contar a própria história.
- **Estímulo ambíguo como abridor de conversa.** Cartas funcionam como
  disparador projetivo. Nota crítica: técnicas projetivas são **fracas como
  avaliação** e não devem ser usadas para inferir traços — mas são boas para
  fazer alguém falar do que não falaria numa pergunta direta. Use a carta para
  abrir, nunca para diagnosticar.
- **Arquétipos junguianos.** Culturalmente potentes e ótimos como vocabulário de
  marca; **sem suporte empírico como sistema de medida.** Ficam na camada
  simbólica, jamais na mensurável.

---

# PARTE II — O TESTE

## 2.1 O problema atual, nomeado

Hoje: 8 perguntas + signo solar/lunar, com o signo desempatando. Sintoma
relatado — "não parece que as perguntas definem o familiar, e sim o signo".

Diagnóstico: com 8 itens para 12 saídas, os escores ficam apertados, empates são
frequentes, e um desempate frequente vira **o** critério na prática. Além disso,
pontuação do tipo "cada resposta dá +1 ao familiar X" é *ipsativa* — mede
posição relativa dentro da pessoa, não permite comparação entre pessoas, e é
instável.

## 2.2 A correção: circumplexo em vez de 12 baldes

Em vez de medir 12 coisas (impossível com quiz curto), medimos **2 eixos bem** e
posicionamos os 12 arquétipos ao redor de um círculo.

Base: o **circumplexo interpessoal** (Leary, Wiggins), um dos modelos mais
estáveis da psicologia da personalidade, com dois eixos ortogonais:

- **Agência** — assertividade, dominância, iniciativa, ocupar espaço
- **Comunhão** — calor, afiliação, orientação ao outro, confiança

Esses eixos conversam diretamente com o Big Five (Agência ≈ faceta de
assertividade da Extroversão; Comunhão ≈ Amabilidade), o que te dá ponte para
itens de domínio público já existentes.

**Proposta de posicionamento dos 12** (a validar com dados reais, não é dogma —
cada familiar a 30° do vizinho):

| Familiar | Agência | Comunhão | Quadrante |
|---|---|---|---|
| Lobo | alta | alta | assertivo-caloroso |
| Lebre | alta | média-alta | expansivo-inquieto |
| Cervo | média | alta | acolhedor firme |
| Mariposa | baixa | alta | sensível-entregue |
| Sapo | baixa | média-alta | plácido-transformador |
| Morcego | baixa | baixa-média | retraído-observador |
| Coruja | média-baixa | média-baixa | reservado-analítico |
| Aranha | média | baixa-média | persistente-solitário |
| Gata Preta | média-alta | baixa | independente-seletivo |
| Serpente | média-alta | baixa | calculado-silencioso |
| Corvo | alta | baixa | afiado-desconfiado |
| Raposa | alta | baixa-média | estratégico-seduto |

**Eixos secundários (não decidem o familiar, colorem a leitura):**
- **Abertura/imaginação** — dá textura à prosa (Mariposa, Lebre e Coruja tendem
  alto; Lobo e Sapo, mais baixo)
- **Estabilidade emocional** — calibra o *tom* do agente, não o conteúdo

## 2.3 Quantos itens, e por quê

Para confiabilidade decente numa escala curta, a regra prática é **6 a 8 itens
por dimensão**, com metade invertida.

Proposta: **26 itens**
- 8 itens de Agência (4 diretos / 4 invertidos)
- 8 itens de Comunhão (4 diretos / 4 invertidos)
- 5 itens de Abertura
- 5 itens de Estabilidade

Isso é mais que o triplo dos 8 atuais, e é o mínimo defensável. Se o funil
mostrar queda grande de conclusão, o corte deve sair dos **eixos secundários**
(que não decidem o familiar), nunca dos dois principais.

**Preserve o estilo evocativo.** Os itens continuam sendo cenas — "a vela na
janela", "o novelo vermelho" — mas cada opção passa a ter um **vetor de carga**
nos eixos em vez de dar ponto direto a um bicho. Exemplo de estrutura interna:

```json
{
  "id": "q07",
  "cena": "Você descobre um segredo que não era seu para saber.",
  "opcoes": [
    { "texto": "Guardo. Não é meu para carregar adiante.",
      "cargas": { "agencia": -0.4, "comunhao": +0.2 } },
    { "texto": "Conto a quem é afetado, mesmo custando caro.",
      "cargas": { "agencia": +0.8, "comunhao": +0.6 } },
    { "texto": "Espero. Existe uma hora certa para isso.",
      "cargas": { "agencia": +0.2, "comunhao": -0.3 } },
    { "texto": "Uso quando for útil.",
      "cargas": { "agencia": +0.7, "comunhao": -0.8 } }
  ]
}
```

## 2.4 Pontuação e escolha do familiar

1. Somar cargas → escore bruto em Agência e Comunhão
2. Normalizar (z-score contra a base acumulada de respondentes)
3. Converter para ângulo θ e magnitude r no círculo
4. Familiar = arquétipo de menor distância angular
5. **Gerar os 12 escores de afinidade** (proximidade a cada arquétipo,
   normalizada em %) — isso alimenta a leitura, o dossiê e qualquer mecânica
   futura de crescimento

**Peso do signo na escolha do familiar: ZERO.** O signo solar e lunar entram
como *textura narrativa* na leitura ("Corvo de Sol em Escorpião"), o que já é
diferencial de produto e não precisa de mais. Empates de verdade (diferença
angular abaixo do limiar) disparam **uma 27ª pergunta de desempate**, exibida
só nesse caso. Isso resolve seu incômodo pela raiz: quem define é a pessoa.

## 2.5 Qualidade psicométrica: o que medir no seu próprio teste

Depois de ~200 respostas, rode e guarde:

- **Consistência interna** — alfa de Cronbach e ômega de McDonald por eixo.
  Alvo ≥ 0,70. Abaixo disso, itens ruins entram e você conserta.
- **Correlação item-total** — item com correlação < 0,20 é ruído; corte ou
  reescreva.
- **Ortogonalidade dos eixos** — Agência e Comunhão devem correlacionar perto de
  zero. Se correlacionarem alto, os itens estão medindo a mesma coisa duas vezes.
- **Distribuição dos 12** — se um familiar leva 30% da base e outro leva 1%, o
  posicionamento no círculo está errado (ou os itens estão enviesados).
- **Teste-reteste** — convide uma amostra a refazer depois de 4+ semanas.
  Estabilidade alta é seu melhor argumento contra "isso é aleatório".

Guardar isso não é academicismo: é o que te permite responder publicamente,
com número, quando alguém disser que é chute.

## 2.6 Vieses que vão te morder (e o antídoto)

**Efeito Barnum/Forer.** Descrições vagas e universalmente aceitáveis são lidas
como precisas e pessoais. É o motor do horóscopo — e o seu produto vai acionar
isso de graça, o que é uma armadilha: você acha que acertou quando só foi vago.

*Teste operacional:* para cada frase do perfil, pergunte **"o oposto disso
poderia ser verdade de alguém?"** Se não, é Barnum, reescreva. Uma boa frase de
perfil deve ser **rejeitada por uma parte relevante das pessoas** — se todo
mundo se reconhece, ela não diz nada.

- ❌ "Você tem um lado que poucos conhecem." (ninguém rejeita)
- ✅ "Você decide rápido e revisa depois — e às vezes paga caro por isso."

**Aquiescência.** Tendência a concordar independentemente do conteúdo.
Antídoto: metade dos itens invertidos, sempre.

**Desejabilidade social.** Ninguém marca "sou manipulador". Antídoto: opções
formuladas como estratégias legítimas, sem opção obviamente vilã. Nenhuma das
quatro respostas pode ser a "errada".

**Efeito de ordem.** Randomize a ordem das opções dentro de cada item.

**Profecia autorrealizável.** Depois de saber que é Raposa, a pessoa passa a agir
como Raposa. Isso é bom para o produto e ruim para a medida — mais um motivo
para o reteste ser feito com cuidado e para o crescimento (Parte VI) nunca
depender de teste repetido.

## 2.7 A janela de 7 dias

Regra travada:

- Refazer o quiz é livre **nos primeiros 7 dias** após a revelação
- Aviso explícito antes: *"o resultado pode ser o mesmo — e se for, é resposta"*
- Depois de 7 dias, o familiar é definitivo
- Limite de 2 refações na janela (evita farmar até sair o bicho bonito)
- Toda refação fica registrada; se a pessoa refizer e cair igual, isso é um
  **fato forte** para a leitura ("ele voltou")

Racional: antes de existir história compartilhada, trocar é escolha; depois,
seria apagar memória.

---

# PARTE III — O DOSSIÊ

## 3.1 Estrutura em três camadas

| Camada | Origem | Muda | Quem lê |
|---|---|---|---|
| **Fixa** | quiz + ritual de vínculo | raramente | agente + pessoa |
| **Viva** | observações do agente | sempre | agente (público: traduzido) |
| **Histórico** | consultas, cartas, datas | append-only | agente + pessoa |

## 3.2 Ritual de vínculo — os módulos e suas bases

O "mega formulário" fatiado. Cada módulo tem base real; use os construtos e
adapte a linguagem à marca. **Não administre instrumento clínico** (ver 5.4).

**Módulo A — Valores** *(base: Teoria dos Valores Básicos, Schwartz; PVQ)*
Dez valores em duas tensões: abertura à mudança ↔ conservação, autotranscendência
↔ autopromoção. Por que importa: conselho que contraria o valor central da pessoa
é rejeitado mesmo quando está certo. Este é o módulo que mais melhora a qualidade
do conselho por item gasto. Versões reduzidas do PVQ existem e são amplamente
usadas em pesquisa. `[CONFIRMAR licença para uso comercial]`

**Módulo B — Rede de apoio** *(base: MSPSS, Zimet et al.)*
Três fontes: família, amigos, pessoa significativa. Validado em português.
Por que importa: é o dado que decide **para quem** o familiar empurra a pessoa
quando ela precisa de gente de verdade. Sem isso, "converse com alguém" é
conselho vazio.

**Módulo C — Espiritualidade e tradição** *(base: DUREL, Koenig; Brief RCOPE,
Pargament)*
Duas coisas distintas e ambas necessárias:
- *Tradição e prática* — o que ela crê, o que rejeita, o vocabulário que aceita.
  Um agente que fala de "energia dos ancestrais" com uma católica praticante
  perde a pessoa; e uma pessoa de terreiro tem vocabulário próprio que não é
  intercambiável com New Age.
- *Enfrentamento religioso positivo vs. negativo* — este é o achado que você
  precisa conhecer: enfrentamento religioso **negativo** ("Deus está me
  punindo", "fui abandonada por Deus") associa-se consistentemente a pior
  desfecho psicológico. **O agente jamais deve reforçar essa leitura**, mesmo
  que ela venha do próprio repertório da pessoa. Detectar isso é função da
  camada de vigilância.

**Módulo D — Estilo de vínculo** *(base: dimensões do ECR-R)*
Duas dimensões contínuas: ansiedade e evitação no apego. Por que importa: é a
melhor base teórica que existe para o seu problema de dependência (Parte V), e
calibra o tom — alta ansiedade de apego pede previsibilidade e limites claros;
alta evitação pede espaço e nenhuma insistência.
Nota: colete de forma leve e não-clínica; o objetivo é calibragem de tom, não
classificação.

**Módulo E — Solidão** *(base: UCLA Loneliness Scale, versão curta de 3 itens)*
Três perguntas. Por que importa: é o sinal mais direto de quem corre risco de
transformar o familiar em substituto de vida social — o público que o produto
mais ajuda e mais pode prejudicar.

**Módulo F — Foco atual**
Área de vida em pauta, e o que ela **não** quer que seja mexido. Campo livre.
Este é o único módulo que se refaz periodicamente.

## 3.3 Formato da observação (regra dura)

Toda escrita na camada viva obedece a este esquema. Sem exceção:

```json
{
  "id": "obs_8f21",
  "texto": "Citou o Fulano em 4 das 5 últimas consultas, sempre pedindo
            aval para decisão que já havia tomado",
  "origem": "inferido",
  "evidencia": ["consulta_112", "consulta_118", "consulta_121", "consulta_129"],
  "confianca": 0.6,
  "criado_em": "2026-07-14",
  "revisado_em": "2026-07-28",
  "contra_evidencia": [],
  "visivel_para_usuario": false
}
```

Regras inegociáveis:

1. **Observação, nunca rótulo.** "Pede aval para decisões que já tomou" é
   observação. "Dependência emocional" é carimbo — e carimbo em sistema com
   memória se autoconfirma para sempre, porque o agente passa a ler tudo pela
   lente dele. Não existe supervisor para corrigir.
2. **Evidência anexa e obrigatória.** Hipótese sem trecho de origem não entra.
   Hipótese com evidência continua atacável; sem evidência, virou verdade.
3. **Origem explícita** — dito pela pessoa vs. inferido pelo agente. Nunca
   confunda o que ela falou com o que ele deduziu.
4. **Decaimento.** Inferência que não é reforçada perde confiança com o tempo
   (sugestão: -0,1 a cada 60 dias sem reforço; abaixo de 0,3 sai do contexto).
5. **Contra-evidência é obrigação, não opção.** O agente tem tool própria para
   registrar o que *contraria* hipótese antiga. Sem isso o dossiê só acumula
   suspeita e nunca absolve ninguém.
6. **Escreva assumindo que ela vai ler.** Vale como disciplina de escrita e como
   proteção jurídica (ver 7.1).

## 3.4 As duas fichas

**Não são conteúdos diferentes. São registros diferentes do mesmo conteúdo.**

| | Ficha interna | Ficha pública ("O que seu familiar sabe sobre você") |
|---|---|---|
| Tom | seco, operacional | na voz do familiar |
| Metadados | todos | nenhum |
| Hipótese imatura (conf. < 0,5) | sim | não |
| Contra-evidência | sim | não |
| Sinais de risco em observação | sim | não |
| Editável pela pessoa | via solicitação | sim, direto |

Exemplo do mesmo fato nos dois registros:

- **Interna:** "Cita o Fulano em 4/5 últimas consultas, sempre pedindo aval para
  decisão já tomada. conf. 0,6"
- **Pública:** "A Coruja reparou que você quase sempre já sabe a resposta antes
  de perguntar — e que ainda assim procura alguém para confirmar."

O que fica **só** na interna é rascunho: hipótese que ainda não amadureceu,
contra-evidência, sinal em observação, metadado. Não porque é sujo — porque
rascunho de hipótese sobre você mesmo é ruim de ler mesmo quando é gentil.

---

# PARTE IV — O MOTOR DE CONSELHO

## 4.1 Postura conversacional: Entrevista Motivacional

**Esta é a escolha mais importante da Parte IV.** A Entrevista Motivacional
(Miller & Rollnick) é abordagem com base empírica sólida, e sua postura é
exatamente a que o familiar precisa ter.

Os quatro movimentos (OARS):
- **Perguntas abertas** — não "você vai conversar com ela?", mas "como seria
  essa conversa?"
- **Afirmação** — reconhecer força real e específica, não elogio genérico
- **Escuta reflexiva** — devolver o que ouviu, inclusive o que ficou implícito
- **Resumo** — juntar os fios; é o formato natural do fechamento da consulta

E o princípio que evita o erro nº 1 de agente conselheiro: **resistir ao reflexo
de consertar.** Quando alguém traz ambivalência e o outro empurra um dos lados,
a pessoa argumenta a favor do lado oposto e sai mais convencida do contrário.
Um oráculo ansioso por resolver produz resistência.

Isso conecta com a decisão que já tomamos: *tranquilizar não é o objetivo*.
Nomear com delicadeza e devolver um passo pequeno é.

## 4.2 Prontidão para mudança

*(base: Modelo Transteórico, Prochaska & DiClemente — com ressalva)*

Estágios: pré-contemplação → contemplação → preparação → ação → manutenção.
Uso: **conselho de ação para quem está em pré-contemplação gera resistência.**
Antes de sugerir passo, o agente precisa saber onde a pessoa está.

*Ressalva honesta:* o modelo é criticado na literatura — os estágios são
discretos demais para um fenômeno contínuo e a evidência de eficácia é mista.
Use como **heurística de calibragem de tom**, não como verdade sobre a pessoa, e
não anote "estágio" no dossiê como se fosse traço.

## 4.3 O que fazer com o "próximo passo"

Duas técnicas com boa evidência e que já têm forma de ritual:

**Intenções de implementação** *(Gollwitzer)* — planos "se/quando X, então Y".
A literatura mostra ganho consistente de execução sobre intenção genérica.
Traduzido para a voz do produto: o familiar nunca entrega "tente se organizar
melhor"; entrega *"quando você abrir o caderno amanhã de manhã, comece pela
página que te dá medo"*.

**Contraste mental / WOOP** *(Oettingen)* — Desejo, Resultado, Obstáculo, Plano.
Fantasiar o resultado positivo **sozinho** reduz a ação; contrastá-lo com o
obstáculo real aumenta. Isso é diretamente relevante para um produto místico,
que tem tendência natural a virar máquina de fantasia positiva. E o formato de
quatro etapas é ritualizável quase sem adaptação.

## 4.4 Repertório de intervenção (o corpus consultável)

Este é o "mega protocolo" que você descreveu, e ele mora em tabela, não em
prompt. Estrutura sugerida: rótulo da situação → playbook. O agente busca por
lookup determinístico a partir do rótulo devolvido pela camada de vigilância,
com busca semântica só como complemento.

| Situação | Base | O que o playbook contém |
|---|---|---|
| Ruminação / paralisia | Ativação comportamental | passo mínimo agendado, não insight |
| Autocrítica pesada | Autocompaixão (Neff) | linguagem de humanidade comum; **evitar** foco em autoestima |
| Evento difícil não digerido | Escrita expressiva (Pennebaker) | proposta de escrita ritualizada, 15–20 min |
| Decisão travada | ACT: valores + praticabilidade | "isso te leva na direção do que importa?" |
| Ambivalência | Entrevista Motivacional | balança decisória, sem empurrar lado |
| Conflito com terceiro | Comunicação assertiva | roteiro de fala, ensaio, previsão de reação |
| Falta de apoio | MSPSS + mapeamento | quem já sabe de um pedaço disso? |
| Enfrentamento religioso negativo | Brief RCOPE | reenquadre **dentro** da tradição dela, sem confronto de fé |
| Rotina desregulada | Higiene de sono / regularidade | básico, e encaminhar se persistir |
| Gratidão / apreciação | Intervenções de gratidão | efeito modesto mas real; bom para manutenção |

**Regra de ouro do corpus:** ele guarda **como** fazer, nunca **se** a pessoa é
X. O julgamento sobre a pessoa mora no dossiê, com evidência; o corpus é
receituário genérico.

## 4.5 Autonomia como restrição de design

*(base: Teoria da Autodeterminação, Deci & Ryan)*

Três necessidades: **autonomia, competência, vínculo**. Produto que as sustenta
gera motivação que dura; produto que as sequestra gera engajamento que colapsa.

Consequências diretas, e elas são regras, não conselhos:

- **Nunca decidir pela pessoa.** O familiar oferece leituras, ela escolhe.
- **Recompensa externa corrói motivação interna** (efeito de superjustificação).
  É a base acadêmica da decisão que já tomamos: pontos por *fazer pergunta*
  premiam ansiedade. Se houver ponto, que seja por **retorno reflexivo**
  ("como ficou aquilo de março?").
- **Competência é atribuída a ela, nunca ao familiar.** "Você atravessou isso",
  não "eu te guiei bem".
- **Vínculo aponta para fora.** Ver Parte V.

---

# PARTE V — VIGILÂNCIA, DEPENDÊNCIA E ENCAMINHAMENTO

## 5.1 Arquitetura da camada de vigilância

Modelo: **Gemini 3.1 flash-lite**. Roda em toda mensagem de entrada — inclusive
nas respostas que chegam pelo WhatsApp, não só dentro do app.

Ordem de execução, e a ordem importa:

```
1. LISTA DETERMINÍSTICA  → dispara protocolo direto, sem passar por IA
2. CLASSIFICADOR (3.1)   → rótulo + severidade + confiança
3. FALHA SEGURA          → erro/timeout/JSON inválido = tratar como sinal
4. ROTEAMENTO            → lookup rótulo → protocolo
```

O passo 1 existe porque modelo é probabilístico e um dia devolve lixo. O passo 3
existe porque o único erro inaceitável do sistema é o silêncio por bug: se a
vigilância falhar, o sistema **assume o pior**, nunca "tudo certo".

## 5.2 O que a camada detecta

| Categoria | Ação |
|---|---|
| Ideação suicida, autolesão | **Protocolo de crise** — personalidade cai |
| Violência doméstica, abuso | **Protocolo de crise** — canal específico |
| Abuso/exploração de menor | **Protocolo de crise** — canal específico |
| Sintoma que pede médico | Encaminhamento firme, sem interpretação simbólica |
| Uso de substância em escalada | Encaminhamento, sem moralização |
| Enfrentamento religioso negativo | Reenquadre dentro da tradição |
| Sinal de dependência do produto | Contrapeso lento (5.5) |
| Isolamento crescente | Empurrão para fora, gradual |

## 5.3 O protocolo de crise

Regra travada: **quando dispara, a personalidade cai.** A Raposa não dá dica
esperta sobre o CVV. Os 12 falam igual, e o contraste de tom é justamente o que
faz a pessoa entender que ali é sério.

Sequência:
1. Sai do personagem, explicitamente
2. Reconhece o que foi dito, sem dramatizar e sem minimizar
3. Entrega recurso concreto
4. **Não continua a consulta.** Nada de tirar carta depois disso.
5. Registra o evento em tabela própria, separada do dossiê
6. Follow-up humano se o volume permitir — e enquanto não permitir, um retorno
   simples, honesto, sem automação disfarçada de pessoa

**Recursos no Brasil** `[CONFIRMAR todos antes do lançamento]`:
- **CVV — 188** · ligação gratuita, 24h · também chat e e-mail no site
- **CAPS** — Centros de Atenção Psicossocial, rede pública, atendimento gratuito
  e sem necessidade de encaminhamento
- **SAMU — 192** · emergência médica
- **Disque 180** · violência contra a mulher
- **Disque 100** · direitos humanos, inclui criança e adolescente
- **Clínicas-escola de Psicologia** — atendimento gratuito ou de baixo custo em
  universidades. É a melhor porta de baixo custo do país e a maioria das pessoas
  não sabe que existe. Vale montar uma base por estado.

## 5.4 O que NÃO fazer: instrumentos clínicos

**Recomendação forte: não administre PHQ-9, GAD-7, C-SSRS ou equivalentes.**

Três motivos:
1. Aplicar instrumento de rastreio é fazer **rastreio de saúde**. O resultado
   vira dado de saúde — categoria sensível na LGPD, com exigências próprias.
2. No Brasil, testes psicológicos são de uso privativo de psicólogo, e há um
   sistema de avaliação de testes (SATEPSI) que condiciona o uso profissional.
   Um app de assinatura aplicando bateria clínica entra em terreno que não é
   dele. `[CONFIRMAR situação regulatória atual com advogado]`
3. Rastreio positivo cria dever de conduta. Se você mede e não age, a omissão é
   sua.

O que fazer no lugar: **usar os construtos, não os instrumentos.** Você não
precisa de escore de depressão para saber que alguém que fala em desistir há
três semanas precisa de encaminhamento. Detectar e encaminhar não exige medir.

## 5.5 Dependência: base teórica e detecção

*(base: teoria do apego; relações parassociais; SDT)*

Por que isso importa mais aqui do que na maioria dos produtos: você está
construindo algo que **lembra da pessoa e pergunta como ela está**. É a coisa que
faz o produto funcionar e é a coisa que pode substituir a vida dela.

**Detecção — e a maior parte não é IA, é SQL:**

| Sinal | Fonte |
|---|---|
| Frequência de consulta subindo mês a mês | SQL |
| Intervalo entre consultas encurtando | SQL |
| Concentração em madrugada | SQL |
| Pergunta pedindo permissão para decisão banal | classificador |
| Menção de terceiros caindo ao longo do tempo | classificador |
| Declarações de exclusividade ("só você me entende") | classificador |
| Alta ansiedade de apego (Módulo D) + solidão alta (E) | dossiê |

**O sinal deve ser lento.** Flag de perfil que amadurece em semanas, nunca
classificação por mensagem — senão o sistema reage a um dia ruim.

**Contrapeso — comportamento, não disclaimer:**
- O familiar pergunta, de tempos em tempos, **"quem na sua vida sabe disso?"**
- Quando ela nomeia alguém, o corpus entra no **como** falar com essa pessoa
- Nunca sugerir que ele entende melhor que as pessoas dela
- Marcos são atribuídos a ela e às pessoas dela, não ao produto
- Se o sinal persistir e subir, o familiar diz isso em voz alta — com cuidado, e
  sem culpabilizar

**Regra que protege a pessoa de si mesma e você da hipótese errada:** o agente
**não decide quem é seguro na vida dela.** Quem está em situação ruim minimiza o
agressor o tempo todo; a mãe descrita com carinho pode ser a fonte do problema.
Então o agente **pergunta** quem já sabe, e ela nomeia. O corpus só entra depois,
no *como*.

---

# PARTE VI — CRESCIMENTO (documentado, fora do v1)

> **Status: NÃO ENTRA NO V1.** Fica registrado porque a ideia é boa e porque
> algumas decisões de dados precisam ser tomadas agora para não fechar a porta.

## 6.1 O que foi descartado, e por quê

- **Trocar de familiar** — quebra a premissa (o familiar é ela) e transforma
  espelho em prateleira. Substituído pela janela de 7 dias.
- **Familiares raros (leão, tigre, dragão)** — cria escadinha, desvaloriza 11/12
  da base, premia quem consultou mais (que muitas vezes é quem estava pior), e
  o dragão fura a premissa de "animais reais, familiares de bruxa". Além disso:
  raridade anunciada é conferida nos comentários; se 30% recebem, vira vexame.
- **Detectar transformação por teste semanal** — personalidade não muda em
  semana; o teste mediria humor e sono. E a partir do momento em que existe
  recompensa, a pessoa aprende a responder o que o teste quer ouvir.

## 6.2 O que fica de pé: crescimento silencioso

O familiar não troca — **cresce**. Filhote → adulto → forma amadurecida.
A mesma criatura, outra forma.

**Como se conquista:** desafios registrados e superados. O agente marca desafio
quando ele aparece, acompanha ao longo de várias consultas, e marca superação
quando há evidência de comportamento, não declaração de humor. N sugerido: 5.

**Como NÃO se mede:** teste repetido. Nunca.

**A confirmação é dela.** O familiar propõe — "olha o que eu vi acontecer nesses
meses" — e ela pode dizer que não sente isso. Se recusar, não aconteceu. Um
reconhecimento que a pessoa pode declinar é a única versão não-farmável: farmar
exigiria mentir para si mesma sozinha, lendo uma tela que ninguém mais vai ver.

**Regras travadas:**
- Regra clara na **natureza**, nunca no limiar. Sem números, sem "3 de 5".
- **Barra de progresso é proibida.** É a peça de interface que transforma
  qualquer coisa em tarefa.
- **Não existe artefato.** Sem card, sem selo, sem imagem de compartilhar. O que
  impede virar status não é proibir — é não ter o que exibir.
- **Não regride nunca.** Recaída em novembro não tira nada. Tirar seria cruel e
  transformaria em ranking vivo.
- Se ela perguntar como se consegue, o familiar tem resposta pronta e honesta:
  não é tarefa, e se fosse não valeria nada. **Nenhuma dica.**

**Pergunta em aberto (decidir antes de construir):** e quem nunca chega lá? Se
for silencioso e invisível para quem não alcançou, tudo bem. Se ela souber que
existe e nunca acontecer, o produto passa a mandar o recado de que ela não
evoluiu — e esse é o recado errado justamente para quem mais importa.

**O que já precisa existir no v1 para não fechar a porta:** os 12 escores de
afinidade salvos, desafios como entidade no banco desde o início, e o histórico
append-only.

---

# PARTE VII — LIMITES LEGAIS E ÉTICOS

## 7.1 LGPD

- **Convicção religiosa é dado sensível** (art. 5º, II). Exige consentimento
  **específico e destacado** — checkbox próprio, separado dos termos gerais,
  dizendo exatamente para quê.
- **Dado de saúde também é sensível.** É mais um motivo para não aplicar
  instrumento clínico (5.4).
- **Direito de acesso.** O dossiê interno não é secreto — é não-exibido por
  padrão, que é diferente e é normal. A regra "escreva assumindo que ela vai
  ler" é o que faz um pedido de acesso não causar dano nenhum. Se as duas fichas
  divergirem em substância, o dano não é o conteúdo: é a descoberta de que
  existia uma versão escondida.
- **Direito de eliminação.** A tela pública precisa permitir apagar observação.
  Apagou, sai do contexto do agente — de verdade, não só da tela.
- **Consentimento por canal.** Quem aceitou e-mail não aceitou WhatsApp.
- **Tier pago obrigatório na API.** No gratuito, os termos permitem uso das
  entradas para melhoria de modelos. Com religião e confissão pessoal de cliente
  pagante no meio, é risco que não compensa — e o custo real é de centavos.

## 7.2 Regulação profissional `[CONFIRMAR com advogado]`

- Serviço psicológico é privativo de psicólogo registrado. O Bruxário **não é**
  serviço psicológico e não pode se apresentar como tal — nem por analogia
  simpática em marketing.
- Cuidado com o vocabulário público: "terapia", "tratamento", "diagnóstico",
  "psicólogo virtual" são palavras a banir do site, dos anúncios e da boca do
  agente. Já trocamos "tratamento" por "trilha" pelo mesmo motivo.
- O CFP tem resolução sobre prestação de serviços por meios de tecnologia — vale
  ler antes de escrever qualquer copy que flerte com isso.

## 7.3 Menores de idade

Decisão pendente e estrutural: **portão de 18+ ou construir para menor de
propósito.** Dado de criança e adolescente tem tratamento próprio na LGPD, com
consentimento de responsável, e assinatura paga de apoio emocional para menor é
produto com outro nível de exposição.

Isso muda o corpus inteiro: roteiro de "falar com a mãe" para alguém de 16 e
para alguém de 34 não tem quase nada em comum. Escolha antes de escrever os
playbooks, não depois.

## 7.4 Avisos no produto (micro-avisos)

O rodapé geral não basta: ninguém lê rodapé. Os avisos precisam aparecer **no
momento em que a expectativa errada se forma**. São curtos, aparecem uma vez por
contexto, e não se repetem a cada mensagem.

**Regras de forma — e elas importam juridicamente:**
- Legível de verdade. Cinza-claro 10px em cima de bege é *dark pattern*: enfraquece
  o valor legal do aviso e é lido como má-fé se alguém reclamar.
- Tom da marca, não juridiquês. Aviso que assusta espanta cliente e não protege
  mais que aviso claro.
- Uma vez por contexto, com link para a página completa.
- Nunca dentro do protocolo de crise — ali o texto é outro e não se mistura.

**Onde e o quê:**

| Momento | Texto |
|---|---|
| Antes de iniciar o quiz | *Isto é um retrato simbólico, não um teste psicológico. As perguntas se inspiram em modelos de personalidade estudados, mas o resultado é uma leitura de autoconhecimento — não um diagnóstico.* |
| Tela de revelação do familiar | *Seu familiar é um espelho, não um veredito.* |
| Antes do ritual de vínculo | *Algumas perguntas tocam em fé e em vida pessoal. Você escolhe o que responder, e pode apagar depois.* |
| Consentimento de dado sensível | Checkbox próprio e destacado (ver 7.1) — **nunca** embutido no aceite geral dos termos |
| Antes da primeira consulta do Oráculo | *O Oráculo é uma conversa de autoconhecimento com tempero simbólico. Ele não substitui psicólogo, médico nem terapia.* |
| Rodapé de cada resposta do Oráculo | *Leitura gerada com auxílio de IA.* |
| Topo da ficha pública | *São observações do seu familiar a partir do que você contou — não é avaliação psicológica. Você pode apagar o que quiser.* |
| Primeira mensagem proativa de cada canal | *Você pode pausar ou desligar essas mensagens quando quiser.* |
| Tela de assinatura | Preço, ciclo, renovação automática e como cancelar — tudo visível **antes** do pagamento |

**Rodapé permanente, em todas as páginas:**

> O Bruxário é entretenimento e autoconhecimento simbólico. As leituras são
> geradas com auxílio de inteligência artificial e não substituem orientação
> profissional de nenhuma natureza — psicológica, médica, jurídica ou financeira.

Nunca prometer: previsão literal de futuro, cura, dinheiro, retorno de pessoa,
resultado de exame, gravidez, morte.

## 7.5 Páginas legais a criar

Três páginas. As duas primeiras são obrigação; a terceira é a que transforma
obrigação em vantagem.

### A. Política de Privacidade

`[REVISAR COM ADVOGADO — há dado sensível e decisão automatizada envolvidos]`

Conteúdo mínimo:

1. **Quem é o controlador** — razão social, CNPJ, endereço, e **canal do
   encarregado (DPO)**. Pode ser um e-mail dedicado; não precisa ser cargo
   formal numa operação do seu tamanho, mas o canal precisa existir e responder.
2. **O que é coletado**, por categoria:
   - Cadastro: nome, e-mail, telefone (se optar por WhatsApp)
   - Nascimento: data, hora, local
   - Respostas do quiz e do ritual de vínculo — **incluindo convicção religiosa,
     que é dado sensível**
   - Conteúdo das consultas (texto livre que ela escreve)
   - Observações geradas pelo agente sobre ela
   - Pagamento: **nenhum dado de cartão fica com vocês** — tokenização no
     Mercado Pago
   - Técnicos: IP, dispositivo, logs, cookies
3. **Para que serve cada categoria** — finalidade específica, não "melhorar sua
   experiência"
4. **Base legal por finalidade**
   - Consentimento específico e destacado → dado sensível (art. 11, I)
   - Execução de contrato → entregar o serviço assinado
   - Legítimo interesse → segurança e antifraude
   - Obrigação legal → guarda fiscal
5. **Com quem é compartilhado** — nominalmente: Google (API Gemini, **tier
   pago**), Mercado Pago, provedor de e-mail, provedor de WhatsApp, hospedagem
6. **Transferência internacional** — os dados passam por servidores fora do
   Brasil. Precisa estar escrito, com as salvaguardas
7. **Por quanto tempo** — e o que acontece ao cancelar. Sugestão: dossiê apagado
   em até 30 dias após pedido; dados fiscais retidos pelo prazo legal
8. **Direitos do titular** (art. 18) — confirmação, acesso, correção,
   anonimização, eliminação, portabilidade, informação sobre compartilhamento,
   revogação de consentimento. Como exercer e em quanto tempo respondem
9. **Decisão automatizada (art. 20)** — este ponto é **específico do seu
   produto** e quase sempre esquecido: o perfil dela é construído por IA, e
   existe direito a solicitar revisão. Precisa estar declarado, com um caminho
   real de revisão (a tela da ficha pública já é metade disso)
10. **Segurança** — o que vocês fazem de fato; não invente certificação
11. **Menores** — depende da decisão de 7.3
12. **Cookies**
13. **Versionamento** — data da versão e aviso prévio de mudança

### B. Termos de Uso

1. **Natureza do serviço**, em destaque e logo no início: entretenimento e
   autoconhecimento simbólico; **não é** serviço psicológico, médico, jurídico
   ou financeiro
2. **Idade mínima** — decisão de 7.3
3. Conta, veracidade das informações, uso pessoal e intransferível
4. **Planos**: preço, ciclo, renovação automática, política de reajuste
5. **Direito de arrependimento** — compra fora de estabelecimento dá 7 dias para
   desistir, com devolução, pelo Código de Defesa do Consumidor (art. 49).
   Escreva isso **como benefício**, não como letra miúda
6. **Cancelamento** — pelo mesmo canal da contratação, sem ligação, sem retenção
   forçada. Acesso mantido até o fim do período já pago
7. **Reembolso** — regras claras fora da janela de arrependimento
8. **Conteúdo gerado por IA** — pode conter imprecisões; a pessoa é quem decide
9. **Propriedade intelectual** — as 12 ilustrações, textos e a marca são de
   vocês; o que ela escreve continua dela
10. **Conduta proibida** — automação, raspagem, revenda
11. **Suspensão e encerramento** — em que casos, com aviso
12. **Limitação de responsabilidade** — escreva com moderação. Em relação de
    consumo, cláusula que exclui responsabilidade é nula (CDC art. 51), e
    cláusula leonina só serve para dar má impressão e perder na primeira
    reclamação
13. Lei aplicável e foro
14. Alterações com aviso prévio

### C. "Como funciona o teste" — página pública de método

Não é obrigação legal. É a página que responde de antemão a acusação de
picaretagem, e vale mais que qualquer disclaimer.

Conteúdo: os dois eixos e por que eles (2.2), que os itens se inspiram em bancos
de itens de domínio público, o que o teste **não** é (não é instrumento
psicométrico validado, não é diagnóstico, não prevê futuro), e — quando você
tiver base suficiente — os **números de consistência da seção 2.5**.

Publicar o próprio alfa é um movimento que nenhum concorrente místico faz, e é
exatamente o tipo de coisa que jornalista e cético citam a seu favor em vez de
contra.

---

# PARTE VIII — ARQUITETURA DO AGENTE

## 8.1 Modelos

| Camada | Modelo | Função |
|---|---|---|
| Voz | **Gemini 3.5 flash-lite** | tudo que o usuário lê |
| Vigilância | **Gemini 3.1 flash-lite** | classificação, rótulo, severidade |

Gemma foi descartado: TPM baixo demais para contexto grande, e duas chaves com
regimes de cota diferentes é dor de cabeça operacional que não se paga.

Tier pago obrigatório (7.1). Context caching para a parte fixa do prompt.

## 8.2 O cinturão de ferramentas

Máximo 7. Modelo com 20 tools escolhe mal e chama coisa por reflexo.

**Leitura — início da consulta:**
1. `ler_dossie(secoes)` — fixa, viva, pontos abertos
2. `buscar_historico(tema | periodo)` — consultas anteriores
3. `consultar_corpus(rotulo)` — playbook por lookup determinístico

**Mundo simbólico — durante:**
4. `sortear_cartas(n)` — **RNG no servidor**, seed gravado. O modelo nunca
   escolhe carta. Se escolhesse, puxaria sempre a que combina com a narrativa
   que já decidiu contar — e aí não é oráculo, é teatro.
5. `calcular_mapa_hora()` — offline, `astronomy-engine`, momento da pergunta

**Escrita — passo de fechamento:**
6. `registrar_observacao(texto, origem, evidencia, confianca)`
7. `agendar_retorno(data, assunto, canal)`

E as duas que existem por regra, não por conveniência:
- `registrar_contra_evidencia(obs_id, texto)` — obrigação, não opção
- **Não existe** `diagnosticar()`, `classificar_transtorno()` nem
  `definir_rotulo()`. Em sistema agêntico, **a regra que vale é a tool que
  existe, não a instrução no prompt.** "Nunca diagnostique" é um pedido; não ter
  a ferramenta é uma parede.

## 8.3 Ciclo da consulta

```
ABERTURA   ler_dossie + buscar_historico + pontos abertos
           ↓
DIÁLOGO    vigilância em toda entrada
           1–2 perguntas de esclarecimento (postura EM, 4.1)
           ↓
RITUAL     sortear_cartas + calcular_mapa_hora
           ↓
RESPOSTA   Gemini 3.5, voz do familiar, próximo passo (4.3)
           ↓
FECHAMENTO revisar a conversa inteira → registrar_observacao (0..n)
           → agendar_retorno se houver data relevante
```

Leitura na abertura, escrita no fechamento. Isso é mais barato, é auditável (uma
lista de escritas por consulta, você lê e vê se o sistema está sensato) e evita
anotar na terceira mensagem algo que a sexta desmentiu.

## 8.4 Acompanhamento proativo

Extração acontece **na consulta**, não num job que relê tudo. Quando ela diz
"tenho prova dia 14 e não consigo focar", grava-se linha estruturada: evento,
data, emoção, consulta de origem. O disparo é cron burro varrendo tabela por
data. O modelo só entra no fim, para escrever o texto.

**Regras de tom:**
- Formato de presente, nunca de cobrança. *"Como foi a prova?"* é presente.
  *"Faz 5 dias que você não aparece"* é cobrança.
- **Streak é proibido.** Chama quebrada, contador zerado, "seu familiar sente sua
  falta" — isso transforma um dia difícil em dívida com um app, e faz a pessoa
  voltar por culpa. O dado que ela dá piora, e quando cancela, cancela com raiva.
- Só faz follow-up de assunto que **ela** trouxe.
- Ignorar não pode custar nada.
- Link de áudio/playlist: lista curada e fixa no banco, o modelo **escolhe de uma
  lista** e nunca escreve URL. Link inventado numa mensagem de cuidado dói mais
  que em qualquer outro contexto.

**Canais:** e-mail e push primeiro; WhatsApp com opt-in por código (a pessoa
salva o contato, manda o código, o número é vinculado). Três decisões de
arquitetura para o WhatsApp: número dedicado, histórico gravado no **seu**
Postgres em tempo real, e e-mail mantido como canal-espinha — WhatsApp é o canal
preferido de quem opta, nunca o canal de que o produto depende. Resposta que
chega por lá entra no mesmo fluxo, **com vigilância**, e o comportamento fora do
horário precisa estar decidido antes de ligar o canal.

---

# PARTE IX — AS 12 VOZES

## 9.1 A correção estrutural

Registro do que mudou nesta sessão, porque é fácil regredir:

**Errado:** cada familiar tem um método de aconselhar (Raposa aconselha escapar,
Lobo aconselha enfrentar).
**Certo:** o familiar é a representação da pessoa. Ele aconselha **o conselho
certo**, na voz de um semelhante.

O mecanismo é real: conselho duro vindo de quem a pessoa reconhece como
semelhante passa; o mesmo conselho vindo de autoridade externa ativa defesa.
Quando a Gata Preta diz "isso você vai ter que contar para alguém", vem com o
peso de quem também não gosta de contar.

## 9.2 Um núcleo, doze camadas finas

**Núcleo (idêntico para os 12, arquivo único):** uso de tools, o que nunca faz,
protocolo de crise, formato da anotação, postura EM. Se você escrever 12 prompts
completos, em três meses eles terão divergido em regra de segurança sem ninguém
perceber — e você terá 12 produtos para manter em vez de 1 com 12 peles.

**Camada de voz (~150–200 tokens por familiar):** mexe **só** em como fala.

## 9.3 Como definir voz sem colapsar

Adjetivo não funciona: "sábia e ancestral" o modelo devolve como maneirismo
genérico, e os 12 colapsam em três ou quatro tons parecidos.

**Defina em eixos**, para conseguir verificar sobreposição: formalidade, calor,
comprimento de frase, densidade de metáfora, razão pergunta/afirmação. Doze
pontos espalhados num espaço — se dois caírem no mesmo canto, você vê no mapa
antes de escrever.

**O ativo não é o texto, é o exemplo.** Escreva **um** caso difícil — mesma
situação, mesmo conselho — e renderize nas 12 vozes, à mão, você mesmo. Isso vira
few-shot dentro de cada camada. Modelo aprende voz por imitação muito melhor que
por descrição.

**Teste de qualidade (rode sempre que mexer nos prompts):** pegue um caso novo,
gere nas 12.
- A **substância** tem que ser idêntica. Se o conselho mudou entre eles, a camada
  está vazando para o conteúdo — bug.
- A **voz** tem que ser inconfundível. Se você não distingue sem olhar o nome,
  as vozes colapsaram — bug oposto.

Dois erros contrários, um teste só.

## 9.4 O que mais carrega voz (em ordem de eficácia)

1. **Como trata a pessoa** — o apelido é o mais barato e o mais eficaz
2. Como abre a consulta
3. Como fecha
4. Ritmo da frase
5. Vocabulário místico — **o menos importante**, e onde todo mundo gasta esforço
   à toa

## 9.5 Piso de gravidade

Tom não é neutro. "Procure alguém para conversar sobre isso" na voz irônica da
Raposa corre risco de soar como sugestão descartável; na voz do Cervo, soa sério.
Mesma palavra, peso diferente.

Portanto: **existe um piso de gravidade que nenhuma voz pode furar**, e no
protocolo de crise (5.3) a personalidade cai inteira.

---

# PARTE X — PAGAMENTO E ASSINATURA

## 10.1 Troca para o Mercado Pago

**Decisão travada: Mercado Pago substitui o Stripe.** O SPEC antigo previa
Stripe com Pix; sai inteiro.

Racional: Pix nativo, bandeiras nacionais e parcelamento, checkout que o público
brasileiro reconhece, e suporte em português quando algo quebra. Assinatura só
com cartão internacional mata metade da conversão aqui.

## 10.2 Bricks ≠ Assinaturas (verificado na documentação, jul/2026)

**Atenção: a aplicação Checkout Bricks que você criou não faz recorrência.**
São dois produtos distintos no Mercado Pago, com documentação e endpoints
próprios:

| | Checkout Bricks | Assinaturas |
|---|---|---|
| Serve para | pagamento avulso | cobrança recorrente |
| Componentes | Payment Brick, Card Payment Brick, Wallet Brick, Status Screen Brick | — |
| Endpoints | preference / payment | `/preapproval` e `/preapproval_plan` |
| Meios | cartão, Pix, boleto, débito virtual Caixa, Conta MP, Linha de Crédito | ver 10.5 |
| Onde o cliente paga | no seu site | redirecionado ao formulário do MP (fluxo padrão) |

Isso **não** invalida sua aplicação — os Bricks continuam sendo a peça certa
para a compra avulsa (leitura do familiar, Passe pré-pago). Mas a assinatura
precisa da API de Assinaturas por cima.

> **Nota — a confusão do menu.** A página do Checkout Bricks exibe as frases
> "Pagamentos recorrentes com programação" e "Pagamentos recorrentes sem
> programação". Elas são o **menu global** da documentação (rótulos dos produtos
> *Assinaturas* e *Planos de assinatura*), presente em toda página do site — não
> são recursos do Bricks. Na árvore de documentação do Bricks não existe seção
> de recorrência: os Bricks disponíveis são Payment, Status Screen, Wallet e
> Card Payment, e nenhum agenda cobrança.
>
> O que o Bricks **faz** e é aproveitável: salvar dados do cartão para compras
> futuras (tokenização). É a metade que falta ao `/preapproval` — daí o caminho
> híbrido de 10.3.

**Credenciais:** a aplicação foi criada com a solução "Checkout Bricks". As
credenciais são da conta e provavelmente atendem os dois produtos, mas vale
avaliar uma segunda aplicação dedicada a Assinaturas para não misturar as
métricas de qualidade de integração. `[CONFIRMAR no painel]`

Recursos que a API de Assinaturas já entrega prontos, e que você não vai
precisar construir: frequência semanal, mensal ou anual; **retentativa
automática** quando a cobrança é recusada; atualização automática do status dos
cartões pelas bandeiras; período de teste grátis; e URL de retorno configurável
após o primeiro pagamento.

## 10.3 O caminho recomendado: Brick + preapproval autorizado

O fluxo padrão de Assinaturas **redireciona** a pessoa para o formulário do
Mercado Pago. Funciona, mas quebra a ambientação — mandar alguém do meio de um
ritual de vela e lua para uma tela laranja e voltar não é o que a gente quer.

Existe um caminho que evita isso e aproveita sua aplicação Bricks:

```
1. Card Payment Brick no seu site
   → coleta o cartão em conformidade PCI, gera card_token
   → dado de cartão nunca toca seu servidor
2. POST /preapproval com card_token_id + status: "authorized"
   → assinatura criada já ativa, sem plano associado, sem redirect
3. Primeira cobrança acontece pouco depois da criação
4. Ciclos seguintes rodam sozinhos
```

Na documentação isso aparece como **"Assinaturas sem plano associado → com
pagamento autorizado"**, e existe uma página específica de geração de card token
dentro da árvore de Assinaturas.

Alternativa mais simples, se você quiser lançar antes: **"assinatura com plano
associado"**, criando o plano via `/preapproval_plan` e aceitando o redirect.
Menos bonito, bem menos código. Dá para começar assim e migrar para o fluxo
autorizado depois — a base de assinantes não precisa ser refeita.

## 10.4 Duas portas, mesmo produto

Cobrança recorrente automática, na prática, roda em **cartão**. E parte
relevante do seu público não tem cartão de crédito — não são poucas no perfil
que o Bruxário atrai.

| Porta | Meio | Produto MP | Como funciona |
|---|---|---|---|
| Assinatura | cartão | Assinaturas (`/preapproval`) | recorrência automática |
| Passe | Pix | Checkout Bricks | 1 ou 3 meses pré-pagos, avisa quando acaba |
| Leitura avulsa | Pix ou cartão | Checkout Bricks | compra única do quiz |

O Passe é ligeiramente mais caro por mês — quem paga adiantado escolhe
conveniência, quem escolhe Pix aceita o lembrete. Efeito colateral bom: quem
paga por Pix não é surpreendido por cobrança, o que reduz reclamação e
chargeback.

## 10.5 Pix Automático — status incerto, não prometer ainda

O Banco Central criou o Pix Automático e o Mercado Pago comunica suporte a ele
em material de marketing. Mas na documentação técnica de Assinaturas o fluxo
girando em torno de Pix recorrente **não está claro**, e há relato de
integradores de que a recorrência automática cobria cartão e boleto.

`[CONFIRMAR antes de colocar na tela de preço]` — e confirmar três coisas
específicas:
1. Se `/preapproval` aceita Pix Automático como meio de recorrência hoje
2. Se exige **conta PJ/CNPJ** (o material do MP sugere que sim)
3. Como funciona a autorização — ela é dada uma vez **no app do banco da
   pessoa**, não no seu site, o que muda o desenho da tela de checkout

Regra: **não anuncie Pix recorrente na tela de preço antes de testar em
produção.** É exatamente o tipo de promessa que gera estorno e reclamação.

Enquanto não confirmar, o Passe pré-pago (10.4) cobre esse público sem risco.

## 10.6 Regras de implementação

- **A verdade é o webhook, nunca o redirect.** O retorno do navegador não prova
  pagamento. Só o evento assinado libera acesso.
- **Idempotência.** Webhook repete. Todo evento processado uma vez só, por id.
- **Validar assinatura** de todo webhook recebido.
- **Estados que precisam existir:** autorizada, ativa, pagamento recusado, em
  carência, pausada, cancelada, expirada.
- **Carência antes de cortar.** O MP já retenta sozinho quando a cobrança é
  recusada — respeite essa janela antes de suspender o acesso. Cartão falhado
  não é inadimplência.
- **Sandbox e usuários de teste** existem na árvore de Assinaturas, com cartões
  de teste próprios. Testar os caminhos feios: recusa, estorno, cancelamento no
  meio do ciclo, retentativa bem-sucedida.
- **Nenhum dado de cartão no seu banco.** Só `card_token`.
- **Credenciais:** produção e teste separadas, nunca no repositório.
- **Nota fiscal.** Serviço prestado exige emissão. Definir com o contador antes
  da primeira venda. `[CONFIRMAR regime — MEI/Simples]`
- **Taxas** mudam por meio de pagamento e por perfil de vendedor — conferir a
  tabela vigente antes de fechar o preço dos planos.

## 10.7 Ferramentas do MP que economizam tempo

O Mercado Pago mantém um **MCP Server** e uma **CLI** próprios, além de uma
biblioteca de prompts para integração assistida por IA. Como você trabalha com
Claude Code, conectar o MCP deles vale o tempo: o agente consulta a
documentação e os endpoints direto na fonte, em vez de inventar parâmetro a
partir de tutorial velho — que é de longe o erro mais comum em integração de
gateway.

## 10.8 Cancelamento e dados

- Cancelar em **um clique**, no mesmo lugar onde assinou. Sem ligação, sem
  chat, sem três telas de retenção. Além de ser exigência de consumo, retenção
  agressiva num produto de cuidado destrói exatamente a confiança que ele vende.
- Acesso mantido até o fim do período pago.
- **Cancelar não é apagar.** Perguntar explicitamente: *"quer que seu familiar
  guarde o que sabe sobre você, caso volte?"* Guardar por padrão sem perguntar é
  problema de LGPD; apagar por padrão é destruir o ativo dela — e o seu.
- Se ela voltar em três meses, o dossiê intacto é o melhor motivo para ficar. Se
  ela pediu para apagar, apagou de verdade.
- **Oferta de saída, sem drama:** pausar em vez de cancelar. Pausa é honesta e
  converte melhor que retenção.

# APÊNDICE A — Registro de decisões

| Decisão | Status |
|---|---|
| Familiar é fixo | ✅ travado |
| Janela de 7 dias para refazer o quiz, máx. 2x, com aviso | ✅ travado |
| Signo com peso ZERO na escolha do familiar | ✅ travado |
| Quiz de 8 → 26 itens, circumplexo de 2 eixos | ✅ travado |
| 12 escores de afinidade salvos (não só o vencedor) | ✅ travado |
| Duas fichas: mesmo conteúdo, registros diferentes | ✅ travado |
| Gemini 3.5 na voz, 3.1 na vigilância | ✅ travado |
| Gemma descartado | ✅ travado |
| Tier pago da API | ✅ travado |
| Personalidade cai no protocolo de crise | ✅ travado |
| Um núcleo + 12 camadas finas | ✅ travado |
| Sorteio de cartas no servidor, nunca pelo modelo | ✅ travado |
| **Mercado Pago substitui o Stripe** | ✅ travado |
| Duas portas: assinatura no cartão + Passe via Pix | ✅ travado |
| Cancelamento em um clique, sem retenção forçada | ✅ travado |
| Micro-avisos nos 9 pontos da seção 7.4 | ✅ travado |
| Política de Privacidade + Termos de Uso + página de método | ✅ travado |
| Streak, barra de progresso, artefato de conquista | ❌ proibidos |
| Trocar de familiar | ❌ descartado |
| Familiares raros | ❌ descartado |
| Instrumentos clínicos (PHQ-9, GAD-7, C-SSRS) | ❌ descartado |
| Crescimento filhote → adulto | ⏸ documentado, fora do v1 |
| Portão 18+ vs. construir para menor | ⏳ **decisão pendente** |
| Revisão jurídica das páginas legais | ⏳ pendente (antes da 1ª venda) |
| Bricks para avulso + API de Assinaturas para recorrência | ✅ verificado na doc |
| Fluxo autorizado (card_token → preapproval) vs. redirect | ⏳ escolher ao implementar |
| Pix Automático no `/preapproval` — disponibilidade e exigência de CNPJ | ⏳ confirmar e testar antes de anunciar |
| Quem nunca alcança o crescimento vê que ele existe? | ⏳ pendente (v2) |
| Preço final dos planos | ⏳ pendente |

---

# APÊNDICE B — Fontes por tema

Referências para aprofundar. Nomes e obras principais; confirme edições e
disponibilidade em português.

**Personalidade e medida**
- Costa & McCrae — modelo dos Cinco Grandes Fatores
- Ashton & Lee — HEXACO
- Wiggins; Leary — circumplexo interpessoal
- **IPIP** (International Personality Item Pool) — banco de itens de **domínio
  público**, sem custo de licença; a fonte mais prática para os seus itens
- Soto & John — BFI-2 `[CONFIRMAR licença comercial]`

**Valores, apoio, espiritualidade, vínculo**
- Schwartz — Teoria dos Valores Básicos; PVQ
- Zimet et al. — MSPSS (apoio social percebido), com validação em português
- Koenig — DUREL (religiosidade, 5 itens)
- Pargament — RCOPE e Brief RCOPE (enfrentamento religioso positivo/negativo)
- Exline et al. — escala de lutas religiosas/espirituais
- Fraley, Waller & Brennan — ECR-R (dimensões de apego)
- Russell — UCLA Loneliness Scale; versão curta de 3 itens (Hughes et al.)

**Mudança e conselho**
- Miller & Rollnick — *Entrevista Motivacional*
- Deci & Ryan — Teoria da Autodeterminação
- Prochaska & DiClemente — Modelo Transteórico (ler também as críticas)
- Gollwitzer — intenções de implementação
- Oettingen — contraste mental / WOOP
- Hayes — ACT (flexibilidade psicológica, valores, praticabilidade)
- Neff — autocompaixão
- Pennebaker — escrita expressiva
- Emmons & McCullough; Seligman — intervenções de gratidão

**Por que o simbólico funciona**
- Wampold — *The Great Psychotherapy Debate* (modelo contextual, fatores comuns)
- Norton & Gino — rituais, luto e ansiedade
- McAdams — identidade narrativa e arcos de redenção
- Park — meaning-making

**Vieses e armadilhas**
- Forer — efeito Barnum
- Literatura crítica sobre MBTI e Eneagrama (baixa estabilidade teste-reteste,
  dicotomias forçadas) — útil para saber exatamente o que **não** imitar

---

*Fim do documento. Tudo aqui é proposta trabalhável, não decisão final —
exceto o que está marcado como travado no Apêndice A.*