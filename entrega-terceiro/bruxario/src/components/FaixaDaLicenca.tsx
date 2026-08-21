/**
 * A faixa de aviso da licença — visível para todo mundo, de propósito.
 *
 * O estado `avisando` existe para resolver a conversa antes de precisar
 * suspender: um desligamento seco no meio de uma campanha queima verba de
 * anúncio já gasta. Uma faixa incomoda, é pública, e costuma bastar.
 */
export function FaixaDaLicenca({ mensagem }: { mensagem?: string }) {
  return (
    <div
      role="status"
      className="w-full bg-amber-900/80 text-amber-50 px-4 py-2 text-center font-corpo text-xs leading-relaxed"
    >
      {mensagem ?? 'A licença deste sistema precisa de atenção.'}
    </div>
  );
}
