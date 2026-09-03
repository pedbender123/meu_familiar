import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';
import { SEM_DIREITOS } from '@/nucleo/direitos';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { type ItemDeNavegacao } from '@/plataforma/NavegacaoDaPlataforma';
import { CascaDaConta } from '@/plataforma/CascaDaConta';
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

      {/*
        A casca decide sozinha quando desaparecer: na leitura de um livro o
        menu some e a folha ocupa a tela. Ver `plataforma/modo-leitura.ts`.

        A lista de trilhas vem do disco (`trilhasNoAr`) — faixa anunciada e sem
        arquivo é promessa quebrada no clique.
      */}
      <CascaDaConta
        itens={itens}
        email={sessao.email}
        trilhas={trilhasNoAr()}
        assinaturaAtiva={conta ? assinaturaPagaAtiva(conta.id) : false}
      >
        {children}
      </CascaDaConta>
    </>
  );
}
