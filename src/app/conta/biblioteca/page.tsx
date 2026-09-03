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
        /*
          ── A prateleira ──────────────────────────────────────────────────

          Capas grandes, lado a lado, com a madeira embaixo. A versão anterior
          era uma grade de cartões com título e preço — funcionava e parecia
          catálogo de e-commerce, que é o oposto do que uma estante deve
          sentir.

          A sombra que cada livro projeta na prateleira e o fio de luz na
          lombada não servem para nada. É de propósito: detalhe gratuito é o
          que faz a coisa parecer cuidada, e as pessoas reparam nele mais do
          que na funcionalidade.
        */
        <section className="relative flex flex-col gap-0">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end">
            {estante.map(({ ebook, liberado, por }, i) => {
              const lido = liberado ? lerEbook(ebook.id) : null;

              const livro = (
                <span
                  className="relative block w-full aspect-[3/4] rounded-[3px] overflow-hidden transition-all duration-300 ease-out group-hover:-translate-y-[5px]"
                  style={{
                    animation: `livroChega 640ms cubic-bezier(.2,.8,.2,1) ${i * 110}ms both`,
                    boxShadow: liberado
                      ? '0 14px 26px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(234,224,204,0.10)'
                      : '0 8px 18px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(234,224,204,0.06)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/biblioteca/capa/${ebook.id}`}
                    alt={ebook.titulo}
                    className="w-full h-full object-cover transition duration-700"
                    style={{
                      filter: liberado
                        ? 'none'
                        : 'grayscale(0.75) brightness(0.42) contrast(0.95)',
                    }}
                  />

                  {/* A lombada — é ela que faz o retângulo virar livro. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-[10px]"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 45%, rgba(255,255,255,0.12) 74%, transparent 100%)',
                    }}
                  />

                  {!liberado && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center border"
                        style={{
                          borderColor: 'rgba(217,164,65,0.45)',
                          background: 'rgba(18,14,24,0.8)',
                        }}
                      >
                        <Lock size={16} strokeWidth={1.5} className="text-vela" />
                      </span>
                    </span>
                  )}

                  {por === 'assinatura' && (
                    <span
                      className="absolute top-2 left-3 font-corpo text-[0.55rem] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full"
                      style={{
                        color: 'var(--tinta)',
                        background: 'var(--vela)',
                      }}
                    >
                      assinatura
                    </span>
                  )}
                </span>
              );

              const legenda = (
                <span className="flex flex-col gap-0.5 pt-3">
                  <span className="font-corpo text-[0.78rem] leading-snug text-pergaminho/85">
                    {ebook.titulo}
                  </span>
                  <span className="font-corpo text-[0.68rem] text-pergaminho/35 tabular-nums">
                    {liberado
                      ? `${ebook.capitulos} capítulos · ${lido?.livro.minutos ?? 0} min`
                      : reais(ebook.precoCentavos)}
                  </span>
                </span>
              );

              return liberado ? (
                <Link
                  key={ebook.id}
                  href={`/conta/biblioteca/${ebook.id}`}
                  className="group flex flex-col no-underline"
                >
                  {livro}
                  {legenda}
                </Link>
              ) : (
                <div key={ebook.id} className="group flex flex-col">
                  {livro}
                  {legenda}
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
