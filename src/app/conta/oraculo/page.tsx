import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { PRODUTOS } from '@/lib/produtos';
import { RecadoParaOOraculo } from '@/components/RecadoParaOOraculo';

/**
 * O Oráculo, antes de existir.
 *
 * SPEC 0.5.1: **nenhum "em breve", nenhum cadeado, nenhum botão desabilitado.**
 * Selo de recurso futuro lê-se como produto inacabado. Mas o mesmo documento
 * diz que "teaser dentro da ficção funciona" — então quem entra aqui não
 * encontra um aviso de obra: encontra o próprio familiar dizendo, na voz dele,
 * que ainda não consegue responder.
 *
 * A promessa concreta (as consultas guardadas) aparece embaixo, em texto
 * comum, porque isso é informação de produto e não pode ficar dentro da
 * ficção — a pessoa pagou por ela.
 */
export default async function Oraculo() {
  const sessao = await sessaoAtual();

  const ultima = db
    .prepare(
      `SELECT familiar, leitura_json FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get(sessao!.email) as { familiar: string; leitura_json: string | null } | undefined;

  const familiar = ultima ? FAMILIARES[ultima.familiar as FamiliarId] : null;
  const nomeSecreto = ultima?.leitura_json
    ? JSON.parse(ultima.leitura_json).nome_secreto
    : null;

  return (
    <section className="w-full flex flex-col items-center pt-4 sm:pt-8">
      <FolhaPergaminho>
        <p className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
          O Oráculo
        </p>

        <p className="font-display italic text-xl sm:text-2xl leading-relaxed text-escrita text-center max-w-[32ch]">
          &ldquo;Ainda não. Eu escuto o que você quer perguntar, mas a minha voz
          não atravessa daqui — não desse jeito, não agora.&rdquo;
        </p>

        <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[34ch] leading-relaxed">
          {familiar
            ? `${familiar.nome}${nomeSecreto ? ` · ${nomeSecreto}` : ''}`
            : 'Seu familiar'}
        </p>

        <hr className="w-20 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

        <p className="font-corpo font-light text-sm text-escrita-fraca text-center max-w-[38ch] leading-relaxed">
          {`Quando o Oráculo abrir, ${PRODUTOS.completa.perguntasOraculo} consultas já estarão esperando por você aqui.`}{' '}
          Você não precisa fazer nada para garantir — elas ficam guardadas na
          sua conta.
        </p>

        <hr className="w-20 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

        <RecadoParaOOraculo nomeSecreto={nomeSecreto} />
      </FolhaPergaminho>
    </section>
  );
}
