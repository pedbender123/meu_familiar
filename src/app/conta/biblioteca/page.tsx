import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { assinaturasAtivasDaConta } from '@/nucleo/assinaturas';
import { estanteDe } from '@/nucleo/biblioteca/desbloqueios';
import { lerEbook } from '@/nucleo/biblioteca/leitura';

export const metadata = { title: 'Biblioteca', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * A estante.
 *
 * ── Mostra o catálogo inteiro, não só o que a pessoa tem ──────────────────
 *
 * Uma estante que lista apenas os livros comprados fica completa no dia da
 * compra e vazia antes dela — e o que não aparece não vende. Os fechados
 * ficam ali, com cadeado e preço, que é o que transforma a biblioteca de
 * recibo em oferta.
 *
 * ── Assinatura abre tudo, e isso é o ponto ────────────────────────────────
 *
 * A assinatura hoje vende Oráculo e Calendário, que são consumo. Acervo é
 * outra coisa: é o que faz a pessoa achar que perderia algo ao cancelar. Por
 * isso o assinante vê os três abertos — e continua sem ser dono deles, porque
 * o direito da assinatura dura enquanto ela durar (ver `estanteDe`).
 */
export default async function Biblioteca() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') redirect('/entrar');

  const conta = buscarConta(sessao.email);
  const assina = conta ? assinaturasAtivasDaConta(conta.id).length > 0 : false;
  const estante = estanteDe(sessao.email, assina);

  return (
    <div className="w-full max-w-3xl flex flex-col gap-8 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display italic text-2xl sm:text-3xl text-pergaminho">
          Biblioteca
        </h1>
        <p className="font-corpo font-light text-sm leading-relaxed text-pergaminho/50 max-w-[52ch]">
          {assina
            ? 'Sua assinatura abre a estante inteira. Leia por aqui, com a trilha de fundo de cada capítulo.'
            : 'Leia por aqui, com a trilha de fundo de cada capítulo. O que você compra fica seu para sempre.'}
        </p>
      </header>

      {estante.length === 0 ? (
        <p className="font-corpo text-sm text-pergaminho/40">
          Nenhum livro publicado ainda.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {estante.map(({ ebook, liberado, por }) => {
            const lido = lerEbook(ebook.id);
            const capitulos = lido
              ? lido.livro.modulos.reduce((s, m) => s + m.capitulos.length, 0)
              : 0;

            const conteudo = (
              <>
                {/*
                  A capa com proporção fixa: sem ela, três imagens de alturas
                  diferentes desalinham a grade inteira e a estante parece
                  montada às pressas.
                */}
                <div
                  className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--pergaminho) 12%, transparent)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/biblioteca/capa/${ebook.id}`}
                    alt=""
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    style={{
                      // Livro fechado fica dessaturado: a diferença precisa
                      // ser vista de longe, antes de ler qualquer palavra.
                      filter: liberado ? 'none' : 'grayscale(0.7) brightness(0.55)',
                    }}
                  />
                  {!liberado && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center border"
                        style={{
                          borderColor: 'rgba(217,164,65,0.5)',
                          background: 'rgba(20,16,26,0.72)',
                        }}
                      >
                        <Lock size={15} strokeWidth={1.5} className="text-vela" />
                      </span>
                    </span>
                  )}
                  {por === 'assinatura' && (
                    <span
                      className="absolute top-2 left-2 font-corpo text-[0.6rem] tracking-[0.14em] uppercase px-2 py-0.5 rounded-full border"
                      style={{
                        color: 'var(--vela)',
                        borderColor: 'rgba(217,164,65,0.45)',
                        background: 'rgba(20,16,26,0.72)',
                      }}
                    >
                      assinatura
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <h2 className="font-corpo text-sm leading-snug text-pergaminho/90">
                    {ebook.titulo}
                  </h2>
                  <p className="font-corpo font-light text-[0.72rem] leading-snug text-pergaminho/40">
                    {ebook.promessa}
                  </p>
                  <p className="font-corpo text-[0.7rem] text-pergaminho/35 mt-0.5 tabular-nums">
                    {liberado
                      ? `${capitulos} capítulos · ${lido?.livro.minutos ?? 0} min`
                      : reais(ebook.precoCentavos)}
                  </p>
                </div>
              </>
            );

            return liberado ? (
              <Link
                key={ebook.id}
                href={`/conta/biblioteca/${ebook.id}`}
                className="group flex flex-col gap-3 no-underline"
              >
                {conteudo}
              </Link>
            ) : (
              /*
                Fechado não é link para lugar nenhum ainda.

                A compra avulsa dentro do app é a próxima peça; até ela
                existir, um clique que não leva a nada é pior que nenhum
                clique — a pessoa toca, nada acontece, e conclui que quebrou.
              */
              <div key={ebook.id} className="group flex flex-col gap-3 opacity-90">
                {conteudo}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
