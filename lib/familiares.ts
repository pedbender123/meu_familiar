export type Elemento = 'fogo' | 'terra' | 'ar' | 'agua';
export type FamiliarId =
  | 'gata-preta'
  | 'corvo'
  | 'coruja'
  | 'raposa'
  | 'lobo'
  | 'serpente'
  | 'mariposa'
  | 'aranha'
  | 'lebre'
  | 'morcego'
  | 'cervo'
  | 'sapo';

export type LuaId = 'nova' | 'crescente' | 'cheia' | 'minguante';

export interface Familiar {
  id: FamiliarId;
  nome: string;
  arquetipo: string;
  notaArte: string;
  elemento: Elemento;
}

export const FAMILIARES: Record<FamiliarId, Familiar> = {
  'gata-preta': {
    id: 'gata-preta',
    nome: 'A Gata Preta',
    arquetipo:
      'Guardiã do limiar: independência, intuição doméstica, afeto seletivo',
    notaArte: 'sentada, olhos de âmbar, cauda enrolada nas patas',
    elemento: 'terra',
  },
  corvo: {
    id: 'corvo',
    nome: 'O Corvo',
    arquetipo: 'Mensageiro: inteligência afiada, memória longa, transformação',
    notaArte: 'pousado em galho seco, algo brilhante no bico',
    elemento: 'ar',
  },
  coruja: {
    id: 'coruja',
    nome: 'A Coruja',
    arquetipo: 'Vidente: sabedoria paciente, enxerga no escuro dos outros',
    notaArte: 'de frente, olhos imensos, penas como pergaminho',
    elemento: 'ar',
  },
  raposa: {
    id: 'raposa',
    nome: 'A Raposa',
    arquetipo: 'Trapaceira sábia: charme, adaptação, saída onde não há porta',
    notaArte: 'meio corpo virado, olhar por cima do ombro',
    elemento: 'fogo',
  },
  lobo: {
    id: 'lobo',
    nome: 'O Lobo',
    arquetipo: 'Protetor: lealdade feroz, instinto, matilha escolhida',
    notaArte: 'uivando de perfil ou olhar frontal calmo',
    elemento: 'fogo',
  },
  serpente: {
    id: 'serpente',
    nome: 'A Serpente',
    arquetipo: 'Renascida: cura, muda de pele, poder silencioso',
    notaArte: 'enrolada em espiral, escamas com brilho de lua',
    elemento: 'agua',
  },
  mariposa: {
    id: 'mariposa',
    nome: 'A Mariposa',
    arquetipo: 'Buscadora: sensibilidade, atração pela luz mesmo com risco',
    notaArte: 'asas abertas com padrões de olho',
    elemento: 'fogo',
  },
  aranha: {
    id: 'aranha',
    nome: 'A Aranha',
    arquetipo: 'Tecelã: criação, paciência, destino tramado fio a fio',
    notaArte: 'no centro de teia com orvalho',
    elemento: 'terra',
  },
  lebre: {
    id: 'lebre',
    nome: 'A Lebre',
    arquetipo: 'Lunar: velocidade, ideias férteis, travessia entre mundos',
    notaArte: 'em salto ou ereta ouvindo a noite',
    elemento: 'ar',
  },
  morcego: {
    id: 'morcego',
    nome: 'O Morcego',
    arquetipo: 'Vidente às avessas: renascimento, escuta o que ninguém vê',
    notaArte: 'asas semiabertas, pendurado ou em voo',
    elemento: 'agua',
  },
  cervo: {
    id: 'cervo',
    nome: 'O Cervo',
    arquetipo: 'Coração da floresta: gentileza firme, presença que acalma',
    notaArte: 'galhada com brotos/estrelas',
    elemento: 'terra',
  },
  sapo: {
    id: 'sapo',
    nome: 'O Sapo',
    arquetipo: 'Alquimista: transformação profunda, magia de chuva e cura',
    notaArte: 'sobre pedra musgosa, pele com reflexo de água',
    elemento: 'agua',
  },
};

export const ORDEM_PRIORIDADE: FamiliarId[] = [
  'corvo',
  'gata-preta',
  'coruja',
  'raposa',
  'lobo',
  'serpente',
  'mariposa',
  'aranha',
  'lebre',
  'morcego',
  'cervo',
  'sapo',
];

export const SIGNO_ELEMENTO: Record<string, Elemento> = {
  Áries: 'fogo',
  Leão: 'fogo',
  Sagitário: 'fogo',
  Touro: 'terra',
  Virgem: 'terra',
  Capricórnio: 'terra',
  Gêmeos: 'ar',
  Libra: 'ar',
  Aquário: 'ar',
  Câncer: 'agua',
  Escorpião: 'agua',
  Peixes: 'agua',
};

export interface Opcao {
  letra: 'a' | 'b' | 'c' | 'd';
  texto: string;
  familiares?: FamiliarId[];
}

export interface Pergunta {
  numero: number;
  texto: string;
  opcoes: Opcao[];
  pontua: boolean;
}

export const QUIZ: Pergunta[] = [
  {
    numero: 1,
    texto: 'A noite cai. Onde a magia te encontra?',
    pontua: true,
    opcoes: [
      { letra: 'a', texto: 'Na janela de casa, com uma vela acesa', familiares: ['gata-preta', 'aranha'] },
      { letra: 'b', texto: 'No meio da mata escura', familiares: ['lobo', 'cervo'] },
      { letra: 'c', texto: 'No telhado, sob o céu aberto', familiares: ['corvo', 'coruja'] },
      { letra: 'd', texto: 'Na beira da água parada', familiares: ['sapo', 'serpente'] },
    ],
  },
  {
    numero: 2,
    texto: 'Seu poder desperta quando...',
    pontua: true,
    opcoes: [
      { letra: 'a', texto: 'Todos dormem e só você pensa', familiares: ['coruja', 'morcego'] },
      { letra: 'b', texto: 'Alguém que você ama precisa de você', familiares: ['lobo', 'cervo'] },
      { letra: 'c', texto: 'Você precisa virar outra pessoa pra sobreviver', familiares: ['serpente', 'raposa'] },
      { letra: 'd', texto: 'Você cria algo do nada', familiares: ['aranha', 'lebre'] },
    ],
  },
  {
    numero: 3,
    texto: 'Te confiaram um segredo perigoso. Você...',
    pontua: true,
    opcoes: [
      { letra: 'a', texto: 'Guarda pra sempre, nem sob tortura', familiares: ['gata-preta', 'serpente'] },
      { letra: 'b', texto: 'Transforma em arte, disfarçado', familiares: ['mariposa', 'aranha'] },
      { letra: 'c', texto: 'Usa na hora exata em que for preciso', familiares: ['raposa', 'corvo'] },
      { letra: 'd', texto: 'Conta só pra lua', familiares: ['lebre', 'coruja'] },
    ],
  },
  {
    numero: 4,
    texto: 'Qual sensação te chama mais?',
    pontua: true,
    opcoes: [
      { letra: 'a', texto: 'Calor de vela e lã num dia frio', familiares: ['gata-preta', 'cervo'] },
      { letra: 'b', texto: 'Vento gelado no rosto, em pé num lugar alto', familiares: ['corvo', 'lobo'] },
      { letra: 'c', texto: 'Chuva batendo no telhado', familiares: ['sapo', 'mariposa'] },
      { letra: 'd', texto: 'Silêncio tão fundo que dá pra ouvir o próprio sangue', familiares: ['coruja', 'morcego'] },
    ],
  },
  {
    numero: 5,
    texto: 'Seu defeito mágico:',
    pontua: true,
    opcoes: [
      { letra: 'a', texto: 'Desconfio até da minha sombra', familiares: ['gata-preta', 'corvo'] },
      { letra: 'b', texto: 'Me sacrifico demais pelos outros', familiares: ['cervo', 'lobo'] },
      { letra: 'c', texto: 'Mudo tanto que ninguém me acompanha', familiares: ['serpente', 'raposa'] },
      { letra: 'd', texto: 'Começo dez feitiços e não termino nenhum', familiares: ['lebre', 'mariposa'] },
    ],
  },
  {
    numero: 6,
    texto: 'Escolha um objeto do grimório:',
    pontua: true,
    opcoes: [
      { letra: 'a', texto: 'Um espelho negro que não reflete você', familiares: ['morcego', 'corvo'] },
      { letra: 'b', texto: 'Um novelo vermelho que nunca acaba', familiares: ['aranha', 'gata-preta'] },
      { letra: 'c', texto: 'Uma chave antiga sem porta conhecida', familiares: ['coruja', 'raposa'] },
      { letra: 'd', texto: 'Um vidro com água da primeira chuva', familiares: ['sapo', 'serpente'] },
    ],
  },
  {
    numero: 7,
    texto: 'Como você luta suas batalhas?',
    pontua: true,
    opcoes: [
      { letra: 'a', texto: 'Em silêncio — quando percebem, já acabou', familiares: ['serpente', 'aranha'] },
      { letra: 'b', texto: 'De frente, custe o que custar', familiares: ['lobo', 'morcego'] },
      { letra: 'c', texto: 'Desaparecendo pra vencer depois', familiares: ['lebre', 'raposa'] },
      { letra: 'd', texto: 'Esperando o momento exato de agir', familiares: ['coruja', 'gata-preta'] },
    ],
  },
  {
    numero: 8,
    texto: 'Que lua te encontra acordada?',
    pontua: false,
    opcoes: [
      { letra: 'a', texto: 'Lua Nova (começos e segredos)' },
      { letra: 'b', texto: 'Lua Crescente (desejo e movimento)' },
      { letra: 'c', texto: 'Lua Cheia (poder e revelação)' },
      { letra: 'd', texto: 'Lua Minguante (corte e descanso)' },
    ],
  },
];

const LUA_POR_LETRA: Record<string, LuaId> = {
  a: 'nova',
  b: 'crescente',
  c: 'cheia',
  d: 'minguante',
};

export function calcularLua(respostaP8: 'a' | 'b' | 'c' | 'd'): LuaId {
  return LUA_POR_LETRA[respostaP8];
}

export function calcularFamiliar(
  respostas: Record<number, 'a' | 'b' | 'c' | 'd'>,
  elementoSolar: Elemento
): FamiliarId {
  const pontos: Partial<Record<FamiliarId, number>> = {};

  for (const pergunta of QUIZ) {
    if (!pergunta.pontua) continue;
    const letra = respostas[pergunta.numero];
    const opcao = pergunta.opcoes.find((o) => o.letra === letra);
    if (!opcao?.familiares) continue;
    for (const f of opcao.familiares) {
      pontos[f] = (pontos[f] ?? 0) + 2;
    }
  }

  let maiorPontuacao = -1;
  for (const valor of Object.values(pontos)) {
    if (valor !== undefined && valor > maiorPontuacao) maiorPontuacao = valor;
  }

  const empatados = (Object.keys(pontos) as FamiliarId[]).filter(
    (id) => pontos[id] === maiorPontuacao
  );

  if (empatados.length === 1) return empatados[0];

  const mesmoElemento = empatados.filter(
    (id) => FAMILIARES[id].elemento === elementoSolar
  );
  if (mesmoElemento.length === 1) return mesmoElemento[0];
  if (mesmoElemento.length > 1) {
    for (const id of ORDEM_PRIORIDADE) {
      if (mesmoElemento.includes(id)) return id;
    }
  }

  for (const id of ORDEM_PRIORIDADE) {
    if (empatados.includes(id)) return id;
  }

  return ORDEM_PRIORIDADE[0];
}
