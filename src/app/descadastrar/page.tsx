import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { conferirTokenDeDescadastro, descadastrar } from '@/lib/remarketing';

export const metadata = {
  title: 'Descadastro — Bruxário',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * O link de "não quero mais receber".
 *
 * ── Por que ele age no GET, sem pedir confirmação ─────────────────────────
 *
 * Regra geral, GET não deveria mudar estado — mas aqui a exceção é
 * deliberada. Cliente de e-mail e antivírus pré-carregam links, o que num
 * fluxo com botão significaria "descadastrei sem querer"... e é exatamente o
 * desfecho que a gente prefere ao contrário. Quem sai por engano volta pelo
 * site; quem não consegue sair marca como spam, e spam derruba a entrega de
 * TODO o domínio — inclusive a revelação de quem pagou.
 *
 * Errar para o lado de descadastrar demais é barato. Errar para o outro lado
 * custa o canal inteiro.
 */
export default async function Descadastrar({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;
  const email = (e ?? '').trim().toLowerCase();
  const valido = !!email && !!t && conferirTokenDeDescadastro(email, t);

  if (valido) descadastrar(email, 'link');

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        {valido ? (
          <>
            <h1 className="font-display italic text-3xl text-pergaminho text-balance">
              Pronto. Não te escrevemos mais.
            </h1>
            <p className="font-corpo font-light text-sm text-pergaminho/65 max-w-[42ch] leading-relaxed">
              {email} saiu da lista de ofertas. Se você comprou alguma coisa,
              os e-mails da sua revelação continuam chegando — aqueles não são
              propaganda, são o produto.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display italic text-3xl text-pergaminho text-balance">
              Este link não confere.
            </h1>
            <p className="font-corpo font-light text-sm text-pergaminho/65 max-w-[42ch] leading-relaxed">
              Ele pode ter sido cortado pelo seu programa de e-mail. Responda a
              mensagem pedindo para sair e a gente tira na mão.
            </p>
          </>
        )}
      </main>
    </>
  );
}
