import Link from 'next/link';
import { PRODUTOS, diasRestantes, precoFormatado, linkPublicoExpirou } from '@/lib/produtos';

/**
 * O aviso de que o link vai sumir, com a oferta de torná-lo permanente.
 *
 * ── Três decisões de tom ──────────────────────────────────────────────────
 *
 * 1. **Não esconde e não assusta.** A pessoa pagou; descobrir por acidente que
 *    o acesso tinha prazo seria a pior forma de saber. Aparece no topo, legível,
 *    logo na primeira visita.
 * 2. **Diz primeiro o que ela JÁ tem.** O PDF foi anexado no e-mail e é dela
 *    para sempre. Sem essa linha o aviso vira ameaça ("corre ou perde"), e
 *    urgência fabricada num produto de cuidado destrói a confiança que ele vende.
 * 3. **A oferta vem depois, e é uma frase.** Não é modal, não é contagem
 *    regressiva, não tem "últimas horas". É uma opção, não uma armadilha.
 *
 * Fica no quarto, fora do pergaminho: é interface, não grimório.
 */
export function AvisoDeExpiracao({
  pedidoId,
  expiraEm,
  ehADona = false,
}: {
  pedidoId: string;
  expiraEm: string;
  /** Muda o texto: a dona nunca perde o acesso, só a possibilidade de mostrar. */
  ehADona?: boolean;
}) {
  const dias = diasRestantes(expiraEm);
  const permanente = PRODUTOS.link_permanente;
  const jaExpirou = linkPublicoExpirou(expiraEm);

  const quando =
    dias <= 0
      ? 'hoje'
      : dias === 1
        ? 'amanhã'
        : `em ${dias} dias`;

  return (
    <aside className="w-full max-w-md flex flex-col items-center gap-3 text-center rounded-2xl border border-vela/25 bg-vela/[0.07] px-5 py-4">
      <p className="font-corpo text-sm leading-relaxed text-pergaminho/85">
        {jaExpirou ? (
          <>
            <span className="text-vela">
              Este link não abre mais para outras pessoas.
            </span>{' '}
            Você continua vendo o seu sempre que entrar na sua conta.
          </>
        ) : (
          <>
            <span className="text-vela">
              {`Quem receber este link consegue abrir até ${quando}.`}
            </span>{' '}
            {ehADona
              ? 'Depois disso ele fecha para estranhos — o seu acesso pela conta não muda.'
              : 'Depois disso ele fecha.'}
          </>
        )}
      </p>

      <Link
        href={`/pagamento/${pedidoId}?produto=${permanente.id}`}
        className="font-corpo text-sm text-pergaminho underline underline-offset-4 decoration-vela/50 hover:decoration-vela transition"
      >
        {jaExpirou
          ? `Reabrir para compartilhar por R$ ${precoFormatado(permanente)}`
          : `Deixar este link aberto para sempre por R$ ${precoFormatado(permanente)}`}
      </Link>
    </aside>
  );
}

/** A tela de quem chegou depois do prazo. */
export function AcessoExpirado({ pedidoId }: { pedidoId: string }) {
  const permanente = PRODUTOS.link_permanente;

  return (
    <main className="quarto-de-vela flex-1 flex flex-col items-center justify-center px-6 py-16 text-center gap-5">
      <h1 className="font-display italic text-2xl sm:text-3xl text-pergaminho max-w-sm text-balance">
        Este link não abre mais.
      </h1>

      <p className="font-corpo font-light text-sm leading-relaxed text-pergaminho/70 max-w-[40ch]">
        Ele era temporário. Se esta revelação é sua,{' '}
        <Link href="/entrar" className="text-vela underline underline-offset-4">
          entre na sua conta
        </Link>{' '}
        — ela continua guardada lá, inteira.
      </p>

      <Link
        href={`/pagamento/${pedidoId}?produto=${permanente.id}`}
        className="inline-flex items-center gap-2 bg-vela text-tinta font-corpo font-medium px-6 py-3.5 rounded-full hover:brightness-110 transition"
      >
        Reabrir para sempre por {`R$ ${precoFormatado(permanente)}`}
      </Link>

      <Link
        href="/"
        className="font-corpo text-sm text-pergaminho/50 underline underline-offset-4 hover:text-violeta transition"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
