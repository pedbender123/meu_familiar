import Link from 'next/link';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';

interface Linha {
  id: string;
  familiar: string;
  leitura_json: string | null;
  criado_em: string;
}

/**
 * O módulo `perfil` (familiar + teste) dentro da casca da plataforma.
 *
 * A página existia antes espalhada entre `/conta` e `/revelacao/[id]`; aqui
 * ela ganha endereço próprio, que é o que o registro de módulos
 * (`src/nucleo/modulos.ts`) aponta. O relatório completo continua morando em
 * `/revelacao/[id]` — esta tela é a porta, não uma segunda cópia dele.
 */
export default async function FamiliarDaConta() {
  const sessao = await sessaoAtual();

  const revelacoes = db
    .prepare(
      `SELECT id, familiar, leitura_json, criado_em FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC`
    )
    .all(sessao!.email) as Linha[];

  if (revelacoes.length === 0) {
    return (
      <section className="w-full max-w-xl flex flex-col items-center gap-7 pt-8 text-center">
        <h1 className="font-display italic text-3xl text-pergaminho text-balance max-w-[24ch]">
          Nenhum familiar atravessou ainda.
        </h1>
        <Link
          href="/ritual"
          className="font-corpo text-sm px-6 py-3 rounded-full border border-vela/50 text-vela hover:bg-vela/10 transition-colors"
        >
          Fazer o ritual
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-2xl flex flex-col items-center gap-8 pt-4">
      {revelacoes.map((linha) => {
        const familiar = FAMILIARES[linha.familiar as FamiliarId];
        const leitura = linha.leitura_json ? JSON.parse(linha.leitura_json) : null;
        if (!familiar) return null;

        return (
          <FolhaPergaminho key={linha.id}>
            <SigiloFamiliar sigilo={familiar.sigilo} tamanho={120} />

            <h2 className="font-display italic text-2xl sm:text-3xl text-escrita text-center text-balance">
              {familiar.nome}
              {leitura?.nome_secreto && (
                <span className="text-ouro-velho"> · {leitura.nome_secreto}</span>
              )}
            </h2>

            {leitura?.sussurro_final && (
              <p className="font-display italic text-lg leading-relaxed text-escrita-corpo text-center max-w-[34ch]">
                &ldquo;{leitura.sussurro_final}&rdquo;
              </p>
            )}

            <Link
              href={`/revelacao/${linha.id}`}
              className="font-corpo text-sm px-6 py-2.5 rounded-full border border-ouro-velho/40 text-ouro-velho hover:bg-ouro-velho/10 transition-colors"
            >
              Abrir a revelação
            </Link>
          </FolhaPergaminho>
        );
      })}
    </section>
  );
}
