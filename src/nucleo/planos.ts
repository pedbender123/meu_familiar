import db from '../lib/db';
import type { Direitos } from './direitos';

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

export function direitosDoPlano(plano: Plano): Direitos {
  return JSON.parse(plano.direitos_json) as Direitos;
}
