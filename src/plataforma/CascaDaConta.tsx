'use client';

import { usePathname } from 'next/navigation';
import {
  NavegacaoDaPlataforma,
  type ItemDeNavegacao,
} from './NavegacaoDaPlataforma';
import { Radio } from './Radio';
import { ehModoLeitura } from './modo-leitura';
import type { Trilha } from '@/nucleo/trilhas/catalogo';

/**
 * A casca da plataforma — o quarto em volta de cada tela.
 *
 * ── Por que ela existe como componente ────────────────────────────────────
 *
 * Porque o menu precisa **sumir** na leitura de um livro, e sumir de verdade:
 * não é só esconder a barra, é a página deixar de reservar o espaço dela (o
 * recuo lateral no computador, a folga de baixo no celular). Isso é uma
 * decisão sobre a rota atual, e rota atual é coisa de cliente — o layout do
 * servidor não tem como saber, e mandar um `props.escondido` de cada página
 * seria confiar que ninguém esqueça na próxima que nascer.
 *
 * O rádio mora aqui pelo mesmo motivo: ele existe em toda a plataforma,
 * inclusive dentro do livro, e precisa saber se há barra embaixo dele ou não.
 */
export function CascaDaConta({
  itens,
  email,
  trilhas,
  assinaturaAtiva,
  children,
}: {
  itens: ItemDeNavegacao[];
  email: string;
  trilhas: Trilha[];
  assinaturaAtiva: boolean;
  children: React.ReactNode;
}) {
  const lendo = ehModoLeitura(usePathname());

  return (
    <>
      <div
        className={[
          'quarto-de-vela relative z-10 flex-1 flex flex-col',
          lendo ? '' : 'lg:pl-56',
        ].join(' ')}
      >
        {!lendo && <NavegacaoDaPlataforma itens={itens} email={email} />}

        {/*
          `pb-24` no celular abre espaço para a barra inferior fixa não cobrir
          o fim do conteúdo. Sem barra, a folga é só respiro.
        */}
        <main
          className={[
            'w-full flex-1 flex flex-col items-center px-5',
            lendo ? 'pb-10 pt-2' : 'pb-24 lg:pb-16 lg:pt-8',
          ].join(' ')}
        >
          {children}
        </main>
      </div>

      <Radio trilhas={trilhas} assinaturaAtiva={assinaturaAtiva} />
    </>
  );
}
