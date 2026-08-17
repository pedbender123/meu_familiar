import type { Dominio } from './pontuacao';

/**
 * Uma cor por domínio — e o dourado reservado.
 *
 * ── Por que o amarelo não podia ser a cor de "bom" ────────────────────────
 *
 * A primeira versão pintava de dourado todo dia forte, qualquer que fosse o
 * assunto. Duas coisas quebravam: o calendário virava um borrão amarelo (a
 * maioria dos dias é boa em ALGUMA coisa), e a cor deixava de significar
 * algo — se tudo é destaque, nada é.
 *
 * Agora o dourado é só do **dia de ouro**: as quatro portas abertas ao mesmo
 * tempo, que é raro. Cada domínio ganha a cor dele, e a intensidade diz a
 * força. Assim a grade é legível de longe: "esses dias rosados são os do
 * amor" se lê sem legenda.
 *
 * As cores conversam com a paleta do produto (`globals.css`) em vez de serem
 * as primárias óbvias — vermelho puro e azul puro brigariam com o quarto de
 * vela.
 */
export const COR_DO_DOMINIO: Record<Dominio, string> = {
  amor: '#C4566E', // carmim empoeirado
  carreira: '#5B7FA6', // azul de tinta
  viagens: '#4A8A6F', // verde musgo mais vivo que o --musgo
  fortuna: '#8B6BAF', // violeta, primo do --violeta-bruma
};

/** O dourado da vela — exclusivo dos dias de ouro. */
export const COR_DE_OURO = '#D9A441';

/** Dia fechado: não é vermelho de alarme, é a bruma do quarto. */
export const COR_FECHADO = '#4A4257';

/**
 * A cor de uma célula da grade.
 *
 * `opacidade` cresce com a nota, então um dia de amor nota 62 aparece mais
 * apagado que um de nota 78 — a grade mostra intensidade sem precisar de
 * número em cada quadrado.
 */
export function corDaCelula(opcoes: {
  ouro?: boolean;
  fechado?: boolean;
  dominio: Dominio;
  nota: number;
}): { fundo: string; texto: string } {
  if (opcoes.ouro) return { fundo: COR_DE_OURO, texto: '#171225' };
  if (opcoes.fechado) return { fundo: `${COR_FECHADO}66`, texto: '#EAE0CCaa' };

  // 58 é o piso de "bom"; abaixo disso o dia não merece cor de domínio, senão
  // a grade inteira fica colorida e o olho não acha o que importa.
  if (opcoes.nota < 58) return { fundo: '#EAE0CC12', texto: '#EAE0CC66' };

  // 58 → ~35% de opacidade; 100 → 100%.
  const forca = Math.min(1, Math.max(0.35, (opcoes.nota - 58) / 32 + 0.35));
  const alfa = Math.round(forca * 255)
    .toString(16)
    .padStart(2, '0');

  return {
    fundo: `${COR_DO_DOMINIO[opcoes.dominio]}${alfa}`,
    texto: forca > 0.7 ? '#F5EFE2' : '#EAE0CCcc',
  };
}
