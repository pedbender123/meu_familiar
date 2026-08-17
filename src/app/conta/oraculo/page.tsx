import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { ConversaDoOraculo } from '@/plataforma/ConversaDoOraculo';

/**
 * O Oráculo — a casca de pé (Fase 5), o cérebro ainda não (Fase 8).
 *
 * SPEC 0.5.1: nenhum "em breve", nenhum cadeado, nenhum campo desabilitado.
 * A pessoa escreve de verdade; quem responde que ainda não é hora é o próprio
 * familiar, na voz dele. Ver `ConversaDoOraculo`.
 */
export default async function Oraculo() {
  const sessao = await sessaoAtual();

  /**
   * O layout já barra quem não tem sessão, mas em Next 16 layout e página
   * renderizam **em paralelo** — o `redirect()` de lá acontece, e mesmo assim
   * o corpo daqui executa uma vez com `sessao` nula. Sem esta saída, todo
   * acesso deslogado lança `Cannot read properties of null` no servidor:
   * a pessoa é redirecionada do mesmo jeito, mas o log enche de erro e um
   * problema de verdade passa despercebido no meio.
   */
  if (!sessao) return null;
  const conta = buscarConta(sessao.email);

  const ultima = db
    .prepare(
      `SELECT familiar, leitura_json FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get(sessao.email) as { familiar: string; leitura_json: string | null } | undefined;

  const familiar = ultima ? FAMILIARES[ultima.familiar as FamiliarId] : null;
  const nomeSecreto = ultima?.leitura_json
    ? JSON.parse(ultima.leitura_json).nome_secreto
    : null;

  const cota = conta
    ? direitosEfetivos(conta.id, sessao.email).perguntasOraculo
    : 0;

  return (
    <ConversaDoOraculo
      nomeDoFamiliar={nomeSecreto ?? familiar?.nome ?? 'Seu familiar'}
      cota={cota}
    />
  );
}
