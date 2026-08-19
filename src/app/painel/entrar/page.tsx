import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { BotaoDeAcessoAdmin } from '@/components/BotaoDeAcessoAdmin';

export const metadata = {
  title: 'Painel',
  robots: { index: false, follow: false },
};

/**
 * A porta do painel.
 *
 * Havia só um botão aqui: sem campo, não havia para onde apontar o link. Com
 * a equipe do painel (migração 021) passou a existir um campo de e-mail, e a
 * garantia mudou de forma sem enfraquecer: **a resposta é idêntica para todo
 * endereço**, esteja ele na lista ou não. Não há quem enumerar, não há senha
 * para forçar, e só quem tem acesso à caixa de entrada certa entra.
 *
 * O caminho não é segredo e não precisa ser — a segurança está em quem recebe
 * o e-mail, não na obscuridade da URL.
 */
export default function EntrarNoPainel() {
  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-14">
        <FolhaPergaminho>
          <h1 className="font-display italic text-2xl sm:text-3xl text-escrita text-center">
            Painel do Bruxário
          </h1>
          <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[38ch] leading-relaxed">
            O link de acesso vai para o seu e-mail e vale por 20 minutos. Só
            endereços autorizados recebem.
          </p>
          <BotaoDeAcessoAdmin />
        </FolhaPergaminho>
      </main>
    </>
  );
}
