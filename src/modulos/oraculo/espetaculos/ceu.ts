import { PLANETAS, longitudeDe, aspectoEntre, type Planeta } from '../../calendario/transitos';
import { longitudeParaSigno } from '../../../lib/astro';
import {
  geradorDe,
  type Espetaculo,
  type ContextoDoEspetaculo,
  type ResultadoDoEspetaculo,
  type Simbolo,
} from './tipos';

/**
 * O céu de agora — o espetáculo que **não é sorteado**.
 *
 * Todos os outros embaralham; este lê. Os planetas estão onde estão, e o
 * aspecto que ele encontra contra o mapa natal dela é um fato verificável.
 *
 * É por isso que ele existe e por isso que vale ancorar o ritual nele: dá
 * lastro ao resto. Uma leitura que é só carta sorteada é entretenimento; uma
 * que mistura carta com a posição real de Vênus no minuto em que a pessoa
 * abriu a tela é outra coisa — e é honesta sobre qual parte é qual.
 */

/** O que cada planeta significa quando toca o mapa. Vai no prompt como matéria-prima. */
const SENTIDO_DO_PLANETA: Record<Planeta, string> = {
  Sol: 'identidade, o que ela quer ser vista sendo',
  Lua: 'o que ela sente antes de pensar; necessidade antiga',
  'Mercúrio': 'a conversa, o contrato, o que precisa ser dito com clareza',
  'Vênus': 'afeto, valor, o que ela quer perto',
  Marte: 'vontade e atrito; onde ela vai brigar',
  'Júpiter': 'abertura, sorte, o que cresce sem forçar',
  Saturno: 'limite, cobrança, o que exige tempo e não aceita atalho',
};

const PONTO_NATAL: Record<'sol' | 'lua' | 'ascendente', string> = {
  sol: 'o seu Sol',
  lua: 'a sua Lua',
  ascendente: 'o seu Ascendente',
};

/**
 * As constelações do bônus dourado.
 *
 * Não são as 88 oficiais — são as que a tradição associa a fortuna, e o nome
 * precisa soar como algo que se acende no céu, não como catálogo astronômico.
 */
const CONSTELACOES_DA_FORTUNA = [
  { nome: 'a Coroa Boreal', sentido: 'reconhecimento que chega sem ser pedido' },
  { nome: 'o Cisne', sentido: 'travessia longa terminando bem' },
  { nome: 'a Lira', sentido: 'o que encanta e abre porta' },
  { nome: 'o Cocheiro', sentido: 'condução firme numa estrada difícil' },
  { nome: 'a Águia', sentido: 'ver de cima o que de perto confundia' },
] as const;

export const ceu: Espetaculo = {
  id: 'ceu',
  nome: 'O céu de agora',
  duracaoMs: 16_000,

  executar(ctx: ContextoDoEspetaculo): ResultadoDoEspetaculo {
    const simbolos: Simbolo[] = [];
    const posicoes: { planeta: string; signo: string; grau: number }[] = [];

    for (const planeta of PLANETAS) {
      const longitude = longitudeDe(planeta, ctx.quando);
      posicoes.push({
        planeta,
        signo: longitudeParaSigno(longitude),
        grau: Math.round(longitude % 30),
      });
    }

    /**
     * Sem mapa natal não há aspecto — mas o céu ainda existe. Nesse caso o
     * espetáculo devolve só onde os planetas estão, que continua sendo
     * verdade e continua dando o que falar. Melhor isso do que barrar a
     * leitura de quem ainda não preencheu o nascimento.
     */
    if (ctx.natal) {
      const encontrados: { simbolo: Simbolo; forca: number }[] = [];

      for (const planeta of PLANETAS) {
        const longitude = longitudeDe(planeta, ctx.quando);

        for (const ponto of ['sol', 'lua', 'ascendente'] as const) {
          const natal = ctx.natal[ponto];
          if (natal === null || natal === undefined) continue;

          const aspecto = aspectoEntre(longitude, natal);
          if (!aspecto) continue;

          encontrados.push({
            forca: aspecto.forca,
            simbolo: {
              nome: `${planeta} em ${longitudeParaSigno(longitude)}`,
              posicao: `${aspecto.aspecto.nome} com ${PONTO_NATAL[ponto]}`,
              sentido: `${SENTIDO_DO_PLANETA[planeta]} — ${
                aspecto.aspecto.harmonia > 0 ? 'em acordo' : 'em tensão'
              } com ${PONTO_NATAL[ponto]}`,
            },
          });
        }
      }

      // Os dois aspectos mais exatos. Todos seriam ruído: num dia qualquer
      // há meia dúzia, e o que importa é o que está mais apertado agora.
      encontrados.sort((a, b) => b.forca - a.forca);
      simbolos.push(...encontrados.slice(0, 2).map((e) => e.simbolo));
    }

    if (simbolos.length === 0) {
      // Fallback honesto: a Lua, que sempre diz algo.
      const lua = posicoes.find((p) => p.planeta === 'Lua')!;
      simbolos.push({
        nome: `Lua em ${lua.signo}`,
        posicao: 'onde o céu está agora',
        sentido: SENTIDO_DO_PLANETA.Lua,
      });
    }

    if (ctx.diaDeOuro) {
      const aleatorio = geradorDe(`${ctx.semente}:constelacao`);
      const escolhida =
        CONSTELACOES_DA_FORTUNA[
          Math.floor(aleatorio() * CONSTELACOES_DA_FORTUNA.length)
        ];
      simbolos.push({
        nome: escolhida.nome,
        posicao: 'a Constelação da Fortuna, acesa hoje',
        sentido: escolhida.sentido,
        dourado: true,
      });
    }

    return {
      espetaculo: 'ceu',
      nome: 'O céu de agora',
      simbolos,
      cena: { posicoes, temConstelacao: ctx.diaDeOuro },
    };
  },
};
