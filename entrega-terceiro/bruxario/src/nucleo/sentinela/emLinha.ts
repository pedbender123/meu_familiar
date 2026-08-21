import { registrarAnomalia } from './registrar';
import type { Anomalia } from './tipos';

/**
 * Roda uma checagem em linha, no caminho do código.
 *
 * **Falha aberto**, de propósito (docs/reestruturacao.md §5 — "a Sentinela
 * observa e grita, ela não bloqueia a venda"): se a checagem em si lançar,
 * isso vira uma anomalia `medio` sobre a própria Sentinela, e a chamada
 * termina sem lançar para quem chamou. O caminho da venda nunca quebra por
 * causa de um bug na vigilância.
 */
export function checarEmLinha(nomeDaChecagem: string, fn: () => Anomalia | null): void {
  try {
    const anomalia = fn();
    if (anomalia) registrarAnomalia(anomalia);
  } catch (erro) {
    try {
      registrarAnomalia({
        invariante: 'sentinela_checagem_falhou',
        severidade: 'medio',
        entidadeTipo: 'checagem',
        entidadeId: nomeDaChecagem,
        esperado: 'a checagem roda sem lançar',
        encontrado: erro instanceof Error ? erro.message : String(erro),
      });
    } catch {
      // Se até registrar a falha falhar, desiste em silêncio — o que NUNCA
      // pode acontecer é isto subir e derrubar quem chamou checarEmLinha().
    }
  }
}
