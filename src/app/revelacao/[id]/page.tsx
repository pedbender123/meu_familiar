import Link from 'next/link';
import Image from 'next/image';
import { buscarPedido } from '@/lib/db';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import type { Leitura } from '@/lib/leitura';
import type { Signo } from '@/lib/astro';
import { Constelacao } from '@/components/Constelacao';
import { FormularioOraculo } from '@/components/FormularioOraculo';
import { BotaoCompartilhar } from '@/components/BotaoCompartilhar';
import { RodapeLegal } from '@/components/RodapeLegal';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function Revelacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = buscarPedido(id);

  if (!pedido || pedido.status !== 'entregue' || !pedido.leitura_json) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        <h1 className="font-display italic text-2xl text-pergaminho">
          Esta revelação ainda não chegou.
        </h1>
        <Link href="/" className="font-corpo text-sm text-violeta underline">
          Voltar ao início
        </Link>
      </main>
    );
  }

  const leitura: Leitura = JSON.parse(pedido.leitura_json);
  const familiar = FAMILIARES[pedido.familiar as FamiliarId];

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-12 gap-10">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden border border-pergaminho/10">
        <Image
          src={`/api/storage/${id}/feed.png`}
          alt={`Arte do familiar ${familiar.nome} de ${pedido.nome}`}
          width={1080}
          height={1350}
          className="w-full h-auto"
        />
      </div>

      <section className="flex flex-col items-center gap-2 text-center">
        <span className="font-corpo text-xs tracking-widest text-violeta uppercase">
          O familiar de {pedido.nome}
        </span>
        <h1 className="font-display italic text-3xl text-vela">
          {familiar.nome} · {leitura.nome_secreto}
        </h1>
        <p className="font-corpo font-light text-pergaminho/80 max-w-sm mt-2">
          {leitura.saudacao}
        </p>
      </section>

      {pedido.signo_sol && pedido.signo_lua && (
        <Constelacao
          signoSol={pedido.signo_sol as Signo}
          signoLua={pedido.signo_lua as Signo}
        />
      )}

      <section className="flex flex-col gap-5 max-w-lg font-corpo font-light text-pergaminho/90 leading-relaxed">
        {leitura.leitura.map((paragrafo, i) => (
          <p key={i}>{paragrafo}</p>
        ))}
        <p className="font-display italic text-xl text-vela text-center mt-2">
          {leitura.frase_de_invocacao}
        </p>
      </section>

      <section className="flex justify-center">
        <BotaoCompartilhar
          pedidoId={id}
          textoCompartilhar={`Descobri meu familiar de bruxa: ${familiar.nome} · ${leitura.nome_secreto}. bruxario.com.br`}
        />
      </section>

      <section className="w-full max-w-md flex flex-col items-center gap-4 border-t border-pergaminho/10 pt-10 mt-4">
        <h2 className="font-display italic text-xl text-pergaminho text-center">
          O Oráculo do Bruxário
        </h2>
        <p className="font-corpo font-light text-sm text-pergaminho/70 text-center max-w-xs">
          &ldquo;{leitura.sussurro_final}&rdquo;
        </p>
        <p className="font-corpo font-light text-xs text-pergaminho/50 text-center max-w-xs">
          Em breve, o Oráculo abre as portas para responder.
        </p>
        <FormularioOraculo nomeSecreto={leitura.nome_secreto} />
      </section>

      <RodapeLegal />
    </main>
  );
}
