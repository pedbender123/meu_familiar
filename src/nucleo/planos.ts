import db from '../lib/db';
import { SEM_DIREITOS, type Direitos } from './direitos';

export interface Plano {
  id: string;
  nome: string;
  preco_centavos: number;
  /** `null` = acesso pra sempre. */
  duracao_dias: number | null;
  recorrente: number;
  parcelas_max: number;
  publico: number;
  direitos_json: string;
  ativo: number;
  criado_em: string;
  atualizado_em: string;
}

export function buscarPlano(id: string): Plano | undefined {
  return db.prepare('SELECT * FROM planos WHERE id = ?').get(id) as Plano | undefined;
}

export function listarPlanos(): Plano[] {
  return db.prepare('SELECT * FROM planos ORDER BY preco_centavos ASC').all() as Plano[];
}

/**
 * Sempre sobre `SEM_DIREITOS`, nunca o JSON cru.
 *
 * `direitos_json` é uma linha gravada no passado: um direito criado hoje
 * simplesmente não existe nas linhas de ontem. Lendo cru, esse campo viria
 * `undefined` — e `undefined` num `if` é `false` por sorte, não por decisão.
 * Com o merge, direito novo nasce **negado por padrão** em todo plano antigo,
 * até alguém dizer o contrário explicitamente numa migração.
 */
export function direitosDoPlano(plano: Plano): Direitos {
  try {
    return { ...SEM_DIREITOS, ...(JSON.parse(plano.direitos_json) as Partial<Direitos>) };
  } catch {
    // JSON corrompido não pode virar acesso liberado por acidente.
    return SEM_DIREITOS;
  }
}
