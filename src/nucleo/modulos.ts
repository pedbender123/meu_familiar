import type { Direitos } from './direitos';

/**
 * Fase 4 de docs/reestruturacao.md: o registro de módulos.
 *
 * Só a peça de baixo risco desta fase — a relocação física de
 * `src/lib/familiares.ts`, `leitura.ts`, `quiz/*` etc. para
 * `src/modulos/perfil/` fica para depois, de propósito: são os arquivos do
 * caminho crítico (seção 4 do documento), e mexer neles exige teste ponta a
 * ponta num navegador de verdade, que esta sessão não tem como fazer. Mover
 * arquivo por arquivo sem essa verificação é o tipo de risco que a disciplina
 * 5 existe para proibir.
 *
 * O que dá para fazer sem esse risco — e que já destrava a Fase 5 (a casca
 * com o menu lateral) — é o **registro**: cada módulo se anuncia aqui,
 * apontando para onde já mora hoje. Nada foi movido; só nomeado.
 */
export interface ItemDeMenu {
  rotulo: string;
  rota: string;
  /** `false` quando a conta não tem o direito — o item aparece apagado, nunca some (ver seção 5 da Fase 5). */
  liberado: boolean;
}

export interface Modulo {
  id: string;
  nome: string;
  /** Direito de `Direitos` que precisa estar ligado para o item aparecer liberado no menu. */
  direito: keyof Direitos;
  menu(direitos: Direitos): ItemDeMenu;
}

/**
 * O perfil (familiar + teste) — o produto original do Bruxário. Hoje ainda
 * mora em `src/lib/familiares.ts`, `leitura.ts`, `quiz/`, servido por
 * `/revelacao/[id]`. `direito: 'pdf'` porque é o direito que TODO produto
 * pago tem — o perfil nunca é o que falta.
 */
const perfil: Modulo = {
  id: 'perfil',
  nome: 'Seu familiar',
  direito: 'pdf',
  menu: (direitos) => ({
    rotulo: 'Seu familiar',
    rota: '/conta/perfil',
    liberado: direitos.pdf,
  }),
};

/**
 * O horóscopo diário. Ainda é o silo `src/lib/horoscopo/` com banco próprio
 * (`horoscopo.db`) — fundir com o banco principal é a parte de risco de
 * dados da Fase 4 (migração de linhas reais, não só reorganização de
 * arquivo) e fica para uma etapa dedicada, com escrita dupla e verificação,
 * como a Fase 2 fez para assinaturas.
 */
const horoscopo: Modulo = {
  id: 'horoscopo',
  nome: 'Horóscopo',
  direito: 'tiragemDiaria',
  menu: (direitos) => ({
    rotulo: 'Horóscopo',
    rota: '/horoscopo',
    liberado: direitos.tiragemDiaria,
  }),
};

export const MODULOS: Modulo[] = [perfil, horoscopo];

export function buscarModulo(id: string): Modulo | undefined {
  return MODULOS.find((m) => m.id === id);
}

export function menuParaConta(direitos: Direitos): ItemDeMenu[] {
  return MODULOS.map((m) => m.menu(direitos));
}
