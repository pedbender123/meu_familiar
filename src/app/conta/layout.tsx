import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';
import { SEM_DIREITOS } from '@/nucleo/direitos';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import {
  NavegacaoDaPlataforma,
  type ItemDeNavegacao,
} from '@/plataforma/NavegacaoDaPlataforma';
import { Tocador } from '@/plataforma/Tocador';
import { trilhasNoAr } from '@/nucleo/trilhas/servidor';
import { assinaturaPagaAtiva } from '@/nucleo/assinaturas';

export const metadata = {
  title: 'Seu Bruxário',
  robots: { index: false, follow: false },
};

/**
 * A moldura da área logada — a casca da plataforma (Fase 5).
 *
 * O layout guarda o acesso **uma vez só**, aqui, em vez de cada página
 * repetir a checagem — assim não existe a página nova que alguém esquece de
 * proteger.
 *
 * Os direitos são lidos aqui e viram o menu: é o único lugar que decide o que
 * a pessoa vê listado. Item sem direito continua aparecendo, apagado — ver
 * `NavegacaoDaPlataforma`.
 *
 * Segue a regra da estética: isto é o QUARTO. A navegação é interface e fica
 * no escuro; o conteúdo de cada página é que sobe no pergaminho.
 */
export default async function LayoutDaConta({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') redirect('/entrar');

  const conta = buscarConta(sessao.email);
  const direitos = conta
    ? direitosEfetivos(conta.id, sessao.email)
    : SEM_DIREITOS;

  const itens: ItemDeNavegacao[] = [
    { rotulo: 'Início', rota: '/conta', liberado: true, icone: 'inicio' },
    {
      rotulo: 'Familiar',
      rota: '/conta/familiar',
      liberado: direitos.pdf,
      icone: 'familiar',
    },
    {
      rotulo: 'Oráculo',
      rota: '/conta/oraculo',
      liberado: direitos.perguntasOraculo > 0,
      icone: 'oraculo',
    },
    {
      rotulo: 'Calendário',
      rota: '/conta/calendario',
      liberado: direitos.tiragemDiaria,
      icone: 'horoscopo',
    },
    /**
     * A biblioteca fica sempre visível, mesmo para quem não tem livro nenhum.
     *
     * É a mesma razão de `estanteDe` devolver o catálogo inteiro: uma estante
     * que só aparece depois da primeira compra está completa no dia da compra
     * e invisível antes dela — e o que não aparece não vende.
     */
    {
      rotulo: 'Biblioteca',
      rota: '/conta/biblioteca',
      liberado: true,
      icone: 'biblioteca',
    },
    /**
     * Planos fica SEMPRE liberado, inclusive pra quem já assina: é por aqui
     * que se renova (Pix não cobra sozinho) e que se sobe de plano. Item de
     * upgrade escondido de assinante é renovação perdida.
     */
    { rotulo: 'Planos', rota: '/planos', liberado: true, icone: 'perfil' },
  ];

  return (
    <>
      <PoeiraNaLuz />
      <div className="quarto-de-vela relative z-10 flex-1 flex flex-col lg:pl-56">
        <NavegacaoDaPlataforma itens={itens} email={sessao.email} />
        {/*
          `pb-24` no celular abre espaço para a barra inferior fixa não cobrir
          o fim do conteúdo — sem isso o último parágrafo de toda página fica
          escondido atrás dela.
        */}
        <main className="w-full flex-1 flex flex-col items-center px-5 pb-24 lg:pb-16 lg:pt-8">
          {children}
        </main>
      </div>

      {/*
        O tocador mora no LAYOUT, e não em cada página.

        É o que faz a trilha atravessar a navegação: escolheu chuva na
        revelação, continua chovendo no Oráculo e dentro do livro. Se ele
        vivesse na página, cada clique no menu recomeçaria o áudio do zero —
        que é a diferença entre uma plataforma com som e um site que toca
        música na sua cara.

        A lista vem do disco (`trilhasNoAr`): faixa anunciada e sem arquivo é
        promessa quebrada no clique. Ver `nucleo/trilhas/catalogo.ts`.
      */}
      <Tocador
        trilhas={trilhasNoAr()}
        assinaturaAtiva={conta ? assinaturaPagaAtiva(conta.id) : false}
      />
    </>
  );
}
