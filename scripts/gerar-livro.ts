import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { lerLivro, paginarCapitulo } from '../src/nucleo/biblioteca/formato';

// Carrega .env
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Erro: GEMINI_API_KEY não encontrada no .env ou no ambiente.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

interface CapituloSpec {
  titulo: string;
  som: string;
  diretrizes: string;
}

interface ModuloSpec {
  titulo: string;
  capitulos: CapituloSpec[];
}

interface LivroSpec {
  id: string;
  titulo: string;
  promessa: string;
  modulos: ModuloSpec[];
}

const LIVROS: Record<string, LivroSpec> = {
  'magia-elemental': {
    id: 'magia-elemental',
    titulo: 'Aprenda Magia Elemental em 7 Dias',
    promessa: 'Um elemento por dia, com o ritual de cada um.',
    modulos: [
      {
        titulo: 'Módulo 1 — O que os elementos são',
        capitulos: [
          {
            titulo: 'Antes de acender qualquer vela',
            som: 'silencio-com-vento',
            diretrizes: `
Tema: Desmistificação dos quatro elementos. Não são química, física elementar de ficção nem superpoderes. São categorias arquetípicas de comportamento da mente e da matéria (o que consome, o que adapta, o que separa, o que sustenta).
O erro comum: acender vela esperando efeitos visuais, pirotecnia ou atalhos milagrosos, e a consequente decepção.
Caso concreto (crônica de ~900 palavras): Helena em São Paulo, advogada esgotada em um processo judicial desgastante, tentando rituais pomposos e apressados de madrugada sem resultado, até compreender que o problema é sua afobação e desacelerar diante do silêncio.
Prática: Treino de atenção pura sem tarefa, com copo de água e fósforo comum.
`
          },
          {
            titulo: 'O elemento que você já é',
            som: 'respiracao',
            diretrizes: `
Tema: O elemento de casa / temperamento natural de cada pessoa. Fogo (ação imediata, resolução impulsiva, destruição do que poderia ser salvo), Água (permeabilidade emocional, absorção do clima alheio), Ar (racionalização fria, distanciamento analítico para não sentir a dor), Terra (permanência teimosa, carregar fardos por anos).
O erro comum: tentar trocar de elemento ou achar que existe elemento 'superior'. A virtude em excesso vira o próprio veneno.
Caso concreto (crônica de ~900 palavras): Marcos, programador e empresário tipicamente de Ar, que analisa interminavelmente a ruptura de uma sociedade em vez de agir ou sentir o luto, paralisado pela análise, até ser confrontado pela necessidade da terra e da ação sóbria.
Prática: Mapeamento dos próprios padrões de estresse sob pressão e a sentença de equilíbrio com o elemento oposto.
`
          }
        ]
      },
      {
        titulo: 'Módulo 2 — Os quatro, um por dia',
        capitulos: [
          {
            titulo: 'Dia do fogo',
            som: 'fogo-crepitar',
            diretrizes: `
Tema: O Fogo como princípio de ignição, transmutação e encerramento. Serve para começar o que está inerte ou queimar o que já devia ter morrido; fora disso, ele devora quem o maneja.
O erro comum: alimentar a raiva ou a empolgação passageira achando que é poder mágico; o fogo desgovernado gera esgotamento e cinzas.
A mecânica: por que a vela é o objeto de concentração ideal (chama viva, movimento sem repetição mecânica, treino da atenção focada sem tarefa).
Caso concreto (crônica de ~900 palavras): Beatriz, designer que há seis meses não consegue iniciar seu projeto autoral, tomada por apatia e procrastinação; o primeiro contato disciplinado com a chama de uma vela comum sem distrações e a decisão firme e silenciosa de cortar o que a amarrava.
Prática: Rito minucioso de 10 minutos de fixação da chama e queima simbólica consciente no caderno.
`
          },
          {
            titulo: 'Dia da água',
            som: 'agua-corrente',
            diretrizes: `
Tema: A Água como adaptação, memória, dissolução e percepção intuitiva. A capacidade de contornar obstáculos sem colisão frontal e de acolher o que é sutil.
O erro comum: confundir água com fraqueza ou cair na hipersensibilidade dramática que se afoga no próprio ressentimento.
A mecânica: a água não resiste, toma a forma do recipiente e persiste até abrir a rocha; o corpo humano como recipiente aquífero e a escuta visceral.
Caso concreto (crônica de ~900 palavras): Rodrigo, arquiteto lidando com um cliente autoritário e inflexível; sua tendência antiga de bater de frente (fogo reativo) sendo substituída pelo método da água — a escuta receptiva e o redirecionamento suave que desarmou a hostilidade.
Prática: O rito da tigela de cerâmica com água fria: lavagem dos olhos e das têmporas e a retenção do silêncio interior.
`
          }
        ]
      },
      {
        titulo: 'Módulo 3 — O encontro',
        capitulos: [
          {
            titulo: 'Dia do ar',
            som: 'chuva-longe',
            diretrizes: `
Tema: O Ar como clareza, separação lúcida, respiração e discernimento. O ar corta as brumas da confusão mental e nomeia as coisas com precisão.
O erro comum: perder-se no turbilhão de ideias desconectadas ou no cinismo de quem tudo explica mas nada realiza.
A mecânica: a respiração rítmica como âncora fisiológica do sistema nervoso central e a desidentificação com os pensamentos intrusivos.
Caso concreto (crônica de ~900 palavras): Laura, professora universitária sufocada por prazos e ansiedade crônica generalizada; o aprendizado de sentar na janela de madrugada e aplicar a respiração quadrada para criar um espaço inviolável entre o estímulo e a reação.
Prática: Protocolo de respiração rítmica (4-4-4-4) por 12 minutos, com registro verbal sintético de um único objetivo.
`
          },
          {
            titulo: 'Dia da terra',
            som: 'floresta-noite',
            diretrizes: `
Tema: A Terra como matéria, gravidade, tempo lento, fidelidade ao chão e enraizamento. A terra é o que impede a mente de vagar sem propósito.
O erro comum: desprezar o corpo físico, o cansaço real, as contas para pagar e o mundo comum em busca de um misticismo etéreo e irresponsável.
A mecânica: o peso do corpo sobre o osso e a gravidade; a desaceleração do pulso e o cultivo da paciência como força telúrica.
Caso concreto (crônica de ~900 palavras): Camila, artesã que vivia em sobressaltos financeiros por falta de estrutura e disciplina prática; como a rotina austera de aterramento e organização tangível resgatou seu ofício do colapso.
Prática: O rito da pedra bruta e do contato descalço com o chão: sustentação da postura de montanha e fixação de compromissos concretos.
`
          },
          {
            titulo: 'O sexto e o sétimo dia',
            som: 'tigela-tibetana',
            diretrizes: `
Tema: A síntese e a alquimia dos quatro elementos no quinto elemento (o centro silencioso, o Akasha). Como os elementos conversam: o ar aviva o fogo, a água nutre a terra, a terra contém a água.
O erro comum: viver refém de um único elemento ou usar a magia para evitar a vida cotidiana. A magia autêntica deve tornar a praticante mais lúcida, forte e firme no mundo.
A mecânica: o centro do peito e a presença equilibrada; o governo interior sem tirania.
Caso concreto (crônica de ~900 palavras): O retorno de Helena, agora no sétimo dia, enfrentando uma audiência decisiva no tribunal; a alternância natural entre a serenidade da água, a firmeza da terra, a clareza do ar e a centelha do fogo no instante exato da fala.
Prática: O rito de coroamento do ciclo de sete dias: a bênção dos quatro pontos na mesa de ofício e o voto de sobriedade e continuidade.
`
          }
        ]
      }
    ]
  },
  'ler-o-futuro': {
    id: 'ler-o-futuro',
    titulo: 'Aprenda Como Ler seu Futuro com Cartas',
    promessa: 'O baralho como espelho de atenção, sem previsões mágicas de feira.',
    modulos: [
      {
        titulo: 'Módulo 1 — A pergunta',
        capitulos: [
          {
            titulo: 'O que uma tiragem faz, e o que ela não faz',
            som: 'silencio-com-vento',
            diretrizes: `
Tema: A desmistificação do oráculo. As cartas não são janelas de adivinhação determinista que prendem o futuro num roteiro fatal; são lâminas arquetípicas que espelham as forças e tensões invisíveis que já operam no presente.
O erro comum: terceirizar decisões de vida para um baralho, buscar certezas infantis ou esperar que a sorte resolva covardias pessoais.
Caso concreto (crônica de ~900 palavras): Juliana, após um divórcio doloroso, consultando tiragens compulsivamente na internet em busca de validação, até entender que o baralho não deve responder se o outro volta, mas quem ela se tornou após a partida.
Prática: O desarmamento da expectativa: exercício de contemplação silenciosa de uma carta neutra sem recorrer a manuais.
`
          },
          {
            titulo: 'A pergunta que produz resposta',
            som: 'respiracao',
            diretrizes: `
Tema: A arquitetura da pergunta oracular. Perguntas rasas de "sim ou não" geram respostas confusas ou paralisantes. A pergunta de ofício indaga sobre causa, ponto cego e movimento de ação.
O erro comum: perguntas capciosas que buscam espionar a vida alheia ou perguntas feitas no calor da crise ansiosa.
A mecânica: como a precisão da linguagem foca a atenção e organiza a mente antes mesmo do embaralhamento.
Caso concreto (crônica de ~900 palavras): Fernando, hesitante em largar um emprego estável para abrir sua oficina; a transformação de uma pergunta angustiada ('vou quebrar?') em uma pergunta operacional ('qual fragilidade interna estou ignorando neste plano?').
Prática: Formulação escrita de três perguntas cirúrgicas e o descarte rigoroso de questões viciosas.
`
          }
        ]
      },
      {
        titulo: 'Módulo 2 — As três tiragens',
        capitulos: [
          {
            titulo: 'Uma carta só',
            som: 'batida-lenta',
            diretrizes: `
Tema: A tiragem mais difícil e mais potente: o corte de uma lâmina solitária. Aprofundamento no símbolo em vez da dispersão de muitas cartas.
O erro comum: não aceitar o que a carta mostra e tirar outra 'para confirmar', transformando o oráculo num cassino de autoilusão.
A mecânica: a conversa direta entre o olho e o símbolo; deixar a imagem falar com a memória e o corpo antes de consultar livros.
Caso concreto (crônica de ~900 palavras): Clara tirando a carta da Torre em uma manhã comum e lidando com o sobressalto inicial de medo; a compreensão profunda da lâmina como queda de ilusões que ela mesma sustentava há anos em sua família.
Prática: Rito da Lâmina Diária: postura, respiração, corte com a mão esquerda, observação silenciosa por 7 minutos e registro.
`
          },
          {
            titulo: 'Três cartas, e o erro de sempre',
            som: 'agua-corrente',
            diretrizes: `
Tema: A tiragem de três lâminas (Origem, Conflito Presente e Rumo Provável). A dinâmica relacional entre os arcanos.
O erro comum: ler cada carta como um verbete de dicionário isolado em vez de enxergar o rio narrativo que corre entre elas.
A mecânica: os olhares das personagens nas cartas, as cores predominantes, os elementos que se atraem ou se repelem na mesa.
Caso concreto (crônica de ~900 palavras): Vinícius analisando uma proposta de sociedade comercial; a tiragem de três cartas revelando que o entusiasmo inicial escondia uma divergência fundamental de valores éticos.
Prática: Montagem da mesa com três cartas em triângulo ou linha reta, conexão visual e redação de uma única síntese de parágrafo.
`
          }
        ]
      },
      {
        titulo: 'Módulo 3 — O ofício',
        capitulos: [
          {
            titulo: 'Quando parar de tirar cartas',
            som: 'floresta-noite',
            diretrizes: `
Tema: O fechamento da mesa e os limites éticos e psicológicos da prática. O momento exato em que a leitura deve ser encerrada.
O erro comum: a compulsão oracular, tirar cartas cansado, alcoolizado ou para justificar birras emocionais.
A mecânica: o cansaço do olho, a saturação mental e a perda de nitidez da intuição; o respeito sagrado ao silêncio.
Caso concreto (crônica de ~900 palavras): Mariana que passava madrugadas inteiras com cartas espalhadas no chão da sala, ficando exausta e desorientada, até aprender a guardar o baralho em pano escuro e colocar os pés no chão da realidade.
Prática: Ritual de fechamento: recolhimento solene das lâminas, limpeza das mãos com sal grosso e água fria, e guarda do maço.
`
          },
          {
            titulo: 'O caderno, que é a parte que ensina',
            som: 'chuva-longe',
            diretrizes: `
Tema: O diário cartomântico como único mestre verdadeiro. Quem não anota e não confere meses depois não aprende o ofício, apenas inventa memórias convenientes.
O erro comum: confiar na memória volúvel e reescrever o significado das tiragens antigas para parecer que 'acertou'.
A mecânica: o cotejamento impiedoso entre a interpretação anotada e o que os fatos concretos da vida trouxeram.
Caso concreto (crônica de ~900 palavras): O relato de anos de anotações de uma veterana, mostrando como suas primeiras interpretações eram românticas e ingênuas e como a disciplina do caderno forjou uma precisão cortante e lúcida.
Prática: Estrutura padrão de página de diário de tiragem: data, lua, pergunta ipsis litteris, cartas, hipótese imediata e espaço reservado para a revisão a 30 dias.
`
          }
        ]
      }
    ]
  },
  'terceiro-olho': {
    id: 'terceiro-olho',
    titulo: 'Aprenda a Despertar seu Terceiro Olho',
    promessa: 'O treino da percepção sutil sem delírios nem promessas vazias.',
    modulos: [
      {
        titulo: 'Módulo 1 — O que se treina de verdade',
        capitulos: [
          {
            titulo: 'Você não vai ver auras na primeira semana',
            som: 'silencio-com-vento',
            diretrizes: `
Tema: A desmistificação visceral do 'terceiro olho'. Não é uma tela de cinema frontal que projeta halos fluorescentes ou espíritos falantes; é o aprimoramento da atenção periférica, do discernimento intuitivo e da percepção do sutil.
O erro comum: buscar alucinações visuais forçadas, espremer os olhos no espelho ou confundir cansaço óptico com clarividência.
Caso concreto (crônica de ~900 palavras): Gabriel, frequentador de grupos esotéricos, frustrado por não enxergar auras coloridas em ninguém, até que uma situação de risco em um beco escuro revela a verdadeira natureza do sinal: uma contração fria no plexo e uma certeza física inabalável antes de qualquer pensamento lógico.
Prática: O relaxamento do globo ocular e o alinhamento da respiração com o ponto central entre as sobrancelhas.
`
          },
          {
            titulo: 'O barulho, e de onde ele vem',
            som: 'respiracao',
            diretrizes: `
Tema: A poluição cognitiva e sensorial do mundo contemporâneo como bloqueio principal da percepção sutil. Telas, luz azul, excesso de informação fragmentada e aceleração crônica.
O erro comum: tentar despertar a percepção sutil enquanto se consome seis horas de redes sociais por dia; a mente saturada só produz delírios ansiosos.
A mecânica: o silêncio neuronal como pré-requisito para registrar estímulos de baixa intensidade; a limpeza da vigília.
Caso concreto (crônica de ~900 palavras): Teresa, jornalista soterrada por notícias urgentes e insônia severa; o processo de desintoxicação sensorial gradual de 7 dias e o reaparecimento de sonhos nítidos e pressentimentos corretos.
Prática: O protocolo de escurecimento noturno: meia hora de quarto em penumbra sem telas antes do repouso, com foco na escuridão interna.
`
          }
        ]
      },
      {
        titulo: 'Módulo 2 — A percepção do que não é seu',
        capitulos: [
          {
            titulo: 'O clima de um ambiente',
            som: 'chuva-longe',
            diretrizes: `
Tema: A percepção da atmosfera e da carga residual de espaços fechados (casas antigas, hospitais, salas de reunião após conflitos).
O erro comum: teatralizar a percepção, bancar a vítima que 'absorve tudo' ou fingir desmaios místicos para chamar atenção.
A mecânica: a ressonância límbica e a capacidade biológica humana de captar microexpressões, feromônios e tensão espacial acumulada.
Caso concreto (crônica de ~900 palavras): Daniel, corretor de imóveis que entra em um apartamento aparentemente impecável mas sente uma densidade sufocante que o faz recuar; a descoberta posterior de um drama familiar recente ocorrido ali.
Prática: Treino de entrada consciente em novos ambientes: o escaneamento em 3 etapas (temperatura da pele, ritmo do ar e peso nos ombros).
`
          },
          {
            titulo: 'O corpo sabe primeiro',
            som: 'batida-lenta',
            diretrizes: `
Tema: A base somática da intuição e do centro de clarividência. O terceiro olho não funciona descolado do estômago, do coração e da pele.
O erro comum: intelectualizar sensações físicas ou esperar vozes angelicais quando o próprio intestino e o arrepio da nuca já deram o veredito.
A mecânica: o eixo cérebro-intestino e o nervo vago como condutores primários da percepção intuitiva antes da decodificação cortical.
Caso concreto (crônica de ~900 palavras): Sofia, fechando uma contratação profissional; a impressão racional inicial era perfeita, mas uma pontada gástrica insistente a fez hesitar e checar referências mais a fundo, descobrindo uma fraude encoberta.
Prática: A ancoragem do foco no centro da fronte enquanto se sincroniza com as batidas do pulso radial ou carotídeo.
`
          }
        ]
      },
      {
        titulo: 'Módulo 3 — A vigília',
        capitulos: [
          {
            titulo: 'O escuro, e por que ele é o treino',
            som: 'fogo-crepitar',
            diretrizes: `
Tema: A prática no escuro absoluto. Quando a visão física é retirada, os olhos param de perseguir formas e a atenção é forçada a olhar para o observador interno.
O erro comum: o medo infantil do escuro ou a projeção de monstros imaginários alimentados pelo cinema de terror.
A mecânica: a redução drástica de fótons nas retinas estimula a atividade alfa e teta e ativa a sensibilidade profunda da glândula pineal.
Caso concreto (crônica de ~900 palavras): André enfrentando seu medo antigo de permanecer em um quarto escuro; a transição do pânico inicial para uma paz cavernosa e lúcida que transformou sua postura diária no trabalho.
Prática: Permanência em quarto selado na escuridão por 15 minutos cronometrados, mantendo os olhos abertos e a respiração ritmada.
`
          },
          {
            titulo: 'O que fazer com o que você percebe',
            som: 'floresta-noite',
            diretrizes: `
Tema: A ética implacável da percepção. O silêncio e a nobreza de quem percebe. Nunca usar o que se nota como moeda de vaidade, bisbilhotice ou manipulação psicológica.
O erro comum: sair apontando 'energias negativas' nos outros, dando conselhos não solicitados e se comportando como o 'guru' insuportável da família.
A mecânica: a retenção do poder; a percepção sutil serve para orientar os próprios passos com firmeza, não para fazer proselitismo.
Caso concreto (crônica de ~900 palavras): Helena (ou uma praticante experiente) em um jantar de família percebendo a crise conjugal velada de uma parente; a escolha consciente de não verbalizar o que viu, mas de oferecer uma presença calma, acolhedora e estável sem invasão.
Prática: O rito de selamento e retorno à terra: tocar o solo com as palmas das mãos, beber um copo de água mineral e fixar a intenção de vigília silenciosa no cotidiano.
`
          }
        ]
      }
    ]
  }
};

async function gerarCapitulo(livro: LivroSpec, cap: CapituloSpec, index: number, total: number): Promise<string> {
  console.log(`\n------------------------------------------------------------`);
  console.log(`[${index}/${total}] Gerando capítulo: "${cap.titulo}" (${livro.titulo})...`);
  console.log(`------------------------------------------------------------`);

  const prompt = `
Você é o mestre de escrita do Bruxário. Você escreve livros densos, sérios, profundos e concretos em português do Brasil.
Tom: Íntimo, solene, sóbrio, artesanal: pergaminho, vela, noite.
NUNCA use termos de autoajuda ou astrologia superficial (nada de "vibrações positivas", "atrair abundância", "universo conspirando").
Fale com quem lê como com uma mulher adulta que já ouviu promessas demais e quer aprender o ofício real.
O Bruxário não promete resultados milagrosos; descreve prática e disciplina de percepção.

LIVRO: ${livro.titulo}
MÓDULO: ${livro.modulos.find(m => m.capitulos.includes(cap))?.titulo}
CAPÍTULO: ${cap.titulo}
TRILHA SONORA: ${cap.som}

DIRETRIZES DO ASSUNTO:
${cap.diretrizes}

META ESTRITA DE TAMANHO:
O leitor quebra o texto em páginas de 290 palavras. Este capítulo DEVE ter entre 2.600 e 3.200 palavras (para dar exatamente 9 a 11 páginas de pergaminho). Qualquer texto com menos de 2.400 palavras será rejeitado.
Para garantir essa extensão sem encher linguiça, desenvolva na íntegra e com extrema riqueza literária e psicológica os 6 movimentos abaixo, em texto corrido (NÃO coloque cabeçalhos ou títulos para os 6 movimentos; o texto deve fluir naturalmente em parágrafos até a prática):

1. A Desmistificação e a Anatomia do Engano (~400 a 500 palavras | ~1,5 páginas)
- Desmonte o mito comercial/pop sobre este tema.
- Mostre como as pessoas erram pela afobação e pela busca de espetáculo.
- Descreva a frustração concreta de quem tenta daquele jeito e o cansaço que isso causa.
- Mostre o custo invisível desse engano.

2. A Mecânica Subjacente e os Fundamentos Ocultos (~750 a 900 palavras | ~2,5 a 3 páginas)
- Dissecte o mecanismo real: a psicologia profunda, a relação entre atenção, matéria e corpo.
- Como o corpo físico reage (tensão, respiração, pulso, pele, músculos).
- A física sutil do ofício, sem pedir fé cega.
- A gradação do sutil ao perceptível e por que a constância diária molda a percepção.

3. A Crônica de Ofício: Caso Narrativo em Profundidade Literária (~850 a 1.000 palavras | ~3 páginas)
- Crie uma narrativa completa, cinematográfica, densa e realista ambientada no mundo contemporâneo.
- Personagem com nome, profissão, rotina cansada, detalhes táteis do ambiente (a luz fria da madrugada, o cheiro de café, o barulho do trânsito na avenida, a poeira na estante).
- O conflito existencial concreto.
- O erro e afobação iniciais da personagem.
- O momento em que ela para, desacelera e aplica o ofício deste capítulo com rigor.
- O desfecho sóbrio semanas depois: sem milagres de cinema, com a clareza cortante de uma postura restaurada.

4. As Armadilhas, Riscos e Contraindicações (~400 a 500 palavras | ~1,5 páginas)
- A fronteira entre intuição real e delírio/fantasia projetada.
- Quando o ofício vira fuga da realidade mundana e sintomas de descompasso.
- O contrapeso de terra: a exigência de que a prática torne a pessoa mais lúcida e funcional na vida prática.

5. A Liturgia Doméstica: Transição e Preparação (~300 a 400 palavras | ~1 página)
- As condições reais da casa ou do quarto: luz, ar, postura física, vestimenta.
- O ritual de descompressão antes de tocar no silêncio.

6. O Bloco :::pratica (~350 a 500 palavras | ~1,5 páginas)
- Instrução direta, na segunda pessoa ("você").
- Objetos simples do cotidiano.
- Passo 1: O Assento e o Ritmo da Respiração (contagem e tempo exatos).
- Passo 2: A Ação Focal com as mãos e o olhar.
- Passo 3: O Teste do Silêncio e como sustentar a atenção.
- Passo 4: O Selamento e o Registro no diário de ofício.

COMECE A SUA RESPOSTA EXATAMENTE ASSIM (sem saudações, sem introduções):
## ${cap.titulo}
som: ${cap.som}

`;

  const t0 = Date.now();
  let resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  let texto = resp.text?.trim() ?? '';
  let palavras = texto.split(/\s+/).filter(Boolean).length;
  console.log(`Primeira passagem: ${palavras} palavras em ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  // Se ficou abaixo de 2.400 palavras, fazemos uma expansão focada
  if (palavras < 2400) {
    console.log(`Capítulo com ${palavras} palavras (meta: 2.600+). Solicitando aprofundamento...`);
    const expansaoPrompt = `
O texto a seguir foi gerado para o capítulo "${cap.titulo}", mas atingiu apenas ${palavras} palavras.
O leitor precisa de pelo menos 2.600 palavras (~10 páginas).

TEXTO ATUAL:
${texto}

INSTRUÇÃO DE EXPANSÃO:
Aprofunde e expanda consideravelmente o texto acima, especialmente:
- O Movimento 2 (A mecânica subjacente e a fisiologia do corpo com mais detalhes técnicos).
- O Movimento 3 (A crônica de ofício narrativa: adicione mais nuances sensoriais, diálogos internos, o ambiente físico e o conflito da personagem).
- Mantenha a mesma abertura (## ${cap.titulo}\\nsom: ${cap.som}) e o bloco :::pratica no final.
- Retorne o texto completo expandido com mais de 2.600 palavras.
`;
    const resp2 = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: expansaoPrompt
    });
    const texto2 = resp2.text?.trim() ?? '';
    const palavras2 = texto2.split(/\s+/).filter(Boolean).length;
    if (palavras2 > palavras) {
      texto = texto2;
      palavras = palavras2;
      console.log(`Capítulo expandido para: ${palavras} palavras!`);
    }
  }

  return texto;
}

export async function gerarLivroCompleto(livroId: string) {
  const livro = LIVROS[livroId];
  if (!livro) {
    console.error(`Livro "${livroId}" não encontrado. Opções disponíveis:`, Object.keys(LIVROS).join(', '));
    return;
  }

  console.log(`\n============================================================`);
  console.log(` INICIANDO GERAÇÃO COMPLETA: ${livro.titulo}`);
  console.log(` Promessa: ${livro.promessa}`);
  console.log(` Total de módulos: ${livro.modulos.length}`);
  console.log(`============================================================\n`);

  let mdConteudo = `---
id: ${livro.id}
titulo: ${livro.titulo}
promessa: ${livro.promessa}
---
`;

  let totalCaps = 0;
  for (const m of livro.modulos) totalCaps += m.capitulos.length;
  let capCount = 0;

  for (const m of livro.modulos) {
    mdConteudo += `\n# ${m.titulo}\n`;
    for (const c of m.capitulos) {
      capCount++;
      const capTexto = await gerarCapitulo(livro, c, capCount, totalCaps);
      mdConteudo += `\n${capTexto}\n`;

      // Salva progresso incremental no disco para não perder nada
      const caminhoTemp = path.join('biblioteca/texto', `${livro.id}.md`);
      fs.writeFileSync(caminhoTemp, mdConteudo, 'utf8');
      console.log(`✓ Progresso salvo em ${caminhoTemp}`);
    }
  }

  // Verificação final
  const caminhoFinal = path.join('biblioteca/texto', `${livro.id}.md`);
  fs.writeFileSync(caminhoFinal, mdConteudo, 'utf8');

  console.log(`\n============================================================`);
  console.log(` LIVRO GERADO COM SUCESSO: ${livro.titulo}`);
  console.log(` Arquivo: ${caminhoFinal}`);
  console.log(`============================================================\n`);

  const lido = lerLivro(fs.readFileSync(caminhoFinal, 'utf8'));
  let totalPags = 0;
  for (const mod of lido.modulos) {
    console.log('#', mod.titulo);
    for (const cap of mod.capitulos) {
      const pags = paginarCapitulo(cap).length;
      totalPags += pags;
      const pal = cap.blocos.reduce((s, b) => s + b.paragrafos.reduce((t, p) => t + p.split(/\s+/).filter(Boolean).length, 0), 0);
      console.log(`   ## ${cap.titulo} -> ${pal} palavras | ${pags} páginas de pergaminho`);
    }
  }
  console.log(`\nTOTAL DO LIVRO: ${lido.palavras} palavras | ${totalPags} páginas | ${lido.minutos} minutos de leitura!\n`);
}

// Execução direta via CLI
const arg = process.argv[2];
if (arg === 'todos') {
  (async () => {
    for (const id of Object.keys(LIVROS)) {
      await gerarLivroCompleto(id);
    }
  })().catch(console.error);
} else if (arg && LIVROS[arg]) {
  gerarLivroCompleto(arg).catch(console.error);
} else {
  console.log('Uso: npx tsx scripts/gerar-livro.ts <id-do-livro|todos>');
  console.log('Opções de livros:');
  for (const id of Object.keys(LIVROS)) {
    console.log(`  - ${id} (${LIVROS[id].titulo})`);
  }
  console.log('  - todos (gera todos os 3 livros sequencialmente)');
}
