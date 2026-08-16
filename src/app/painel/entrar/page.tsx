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
 * **Não há campo nenhum aqui, e é isso que a torna segura.** Sem caixa de
 * e-mail não há para onde apontar o link; sem senha não há o que forçar; sem
 * lista de usuários não há quem enumerar. O botão sempre faz a mesma coisa:
 * manda um link para o endereço fixo em `ADMIN_EMAIL`. Quem não tem acesso a
 * essa caixa de entrada não entra, e nenhuma tentativa daqui muda isso.
 *
 * O caminho não é segredo e não precisa ser — a segurança está no e-mail
 * fixo, não na obscuridade da URL.
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
            Não há o que preencher. O link de acesso vai para o endereço do
            dono e vale por 20 minutos.
          </p>
          <BotaoDeAcessoAdmin />
        </FolhaPergaminho>
      </main>
    </>
  );
}
