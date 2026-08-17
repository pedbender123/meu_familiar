import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { estadoDaCota } from '@/nucleo/consumo';
import { voltaDoDia, voltaDoMes } from '@/nucleo/reset-da-cota';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { ConversaDoOraculo } from '@/plataforma/ConversaDoOraculo';
import type { Cota } from '@/plataforma/oraculo/PainelDeCotas';

/**
 * O Oráculo.
 *
 * As cotas são lidas aqui e descem prontas: a tela precisa delas para decidir
 * o que fica clicável antes de qualquer requisição — botão que só descobre
 * que não tem cota depois de clicar é o jeito de fazer a pessoa bater no
 * limite em vez de administrar ele.
 */
export default async function Oraculo() {
  const sessao = await sessaoAtual();
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

  const dia = voltaDoDia();
  const mes = voltaDoMes();

  function montar(recurso: 'mensagem' | 'leitura'): Cota {
    const vazia: Cota = {
      disponivel: 0,
      tetoMensal: 0,
      restanteNoMes: 0,
      restanteHoje: 0,
      voltaDoDia: dia.texto,
      voltaDoMes: mes.texto,
    };
    if (!conta) return vazia;

    const estado = estadoDaCota(conta.id, sessao!.email, recurso);
    return {
      disponivel: estado.disponivel,
      tetoMensal: estado.tetoMensal,
      restanteNoMes: estado.restanteNoMes,
      restanteHoje: estado.restanteHoje,
      voltaDoDia: dia.texto,
      voltaDoMes: mes.texto,
    };
  }

  return (
    <ConversaDoOraculo
      nomeDoFamiliar={nomeSecreto ?? familiar?.nome ?? 'Seu familiar'}
      cotaDeMensagens={montar('mensagem')}
      cotaDeLeituras={montar('leitura')}
    />
  );
}
