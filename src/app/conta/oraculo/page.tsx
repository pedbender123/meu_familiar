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
  const conta = buscarConta(sessao!.email);

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

  const cota = conta
    ? direitosEfetivos(conta.id, sessao!.email).perguntasOraculo
    : 0;

  return (
    <ConversaDoOraculo
      nomeDoFamiliar={nomeSecreto ?? familiar?.nome ?? 'Seu familiar'}
      cota={cota}
    />
  );
}
