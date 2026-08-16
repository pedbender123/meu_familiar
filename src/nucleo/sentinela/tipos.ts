export type Severidade = 'critico' | 'alto' | 'medio' | 'baixo';

/**
 * Uma invariante violada. `esperado` e `encontrado` são texto legível por
 * humano de propósito — é o que faz a tela de anomalias servir às 3 da manhã
 * sem precisar decifrar um `contexto_json`.
 */
export interface Anomalia {
  invariante: string;
  severidade: Severidade;
  entidadeTipo: string;
  entidadeId: string;
  esperado: string;
  encontrado: string;
  contexto?: Record<string, unknown>;
}

export interface AnomaliaRegistrada extends Anomalia {
  id: number;
  ocorridoEm: string;
  resolvidoEm: string | null;
  resolucao: string | null;
  falsoPositivo: boolean;
}

/**
 * Uma checagem pura: recebe o que precisa saber, devolve a anomalia se a
 * invariante quebrou, ou `null` se está tudo certo. Nunca toca o banco —
 * quem chama decide se registra (ver `emLinha.ts`/`varredura.ts`).
 */
export type Invariante<T> = (alvo: T) => Anomalia | null;
