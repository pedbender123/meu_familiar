import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { excedeuLimite } from '@/lib/rate-limit';
import { consumir, devolver, estadoDaCota, type Recurso } from '@/nucleo/consumo';
import { perfilAstralDaConta } from '@/nucleo/perfil-astral';
import { ceuDoDia } from '@/nucleo/ceu-do-dia';
import { mapaDaConta } from '@/modulos/calendario/calendario';
import { pontuarDia, ehDiaDeOuro } from '@/modulos/calendario/pontuacao';
import { descreverPerfil } from '@/lib/processar';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { sortearEspetaculos } from '@/modulos/oraculo/espetaculos';
import { gerarLeitura } from '@/modulos/oraculo/leitura';
import { gerarMensagem } from '@/modulos/oraculo/mensagem';
import { arquivar, resumoParaContexto } from '@/modulos/oraculo/arquivo';
import type { Signo } from '@/lib/astro';

/**
 * A consulta ao Oráculo — leitura ou mensagem.
 *
 * ── A ordem das operações importa ─────────────────────────────────────────
 *
 * 1. cobra a cota (transação)
 * 2. monta o contexto (grátis, local)
 * 3. chama o modelo
 * 4. se falhar, **devolve a cota**
 *
 * Cobrar antes de gerar é o que impede duas abas dispararem duas leituras
 * pagando uma. Devolver na falha é o que impede cobrar por uma leitura que
 * não chegou — que é o pior jeito de perder um assinante, e a chamada falha
 * por motivos que não são culpa de ninguém.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`oraculo-consulta:${ip}`)) {
    return NextResponse.json({ erro: 'Muitos envios. Aguarde um instante.' }, { status: 429 });
  }

  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const conta = buscarConta(sessao.email);
  if (!conta) return NextResponse.json({ erro: 'conta não encontrada' }, { status: 404 });

  let corpo: { pergunta?: string; tipo?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const pergunta = (corpo.pergunta ?? '').trim().slice(0, 600);
  const tipo: Recurso = corpo.tipo === 'leitura' ? 'leitura' : 'mensagem';

  if (pergunta.length < 3) {
    return NextResponse.json({ erro: 'escreva um pouco mais' }, { status: 400 });
  }

  /* ── 1. A cota, antes de qualquer trabalho ─────────────────────────── */
  const cobranca = consumir(conta.id, sessao.email, tipo);
  if (!cobranca.ok) {
    const estado = estadoDaCota(conta.id, sessao.email, tipo);
    return NextResponse.json(
      { erro: 'sem_cota', motivo: cobranca.motivo, estado },
      { status: 402 }
    );
  }

  try {
    /* ── 2. O contexto, tudo local e de graça ────────────────────────── */
    const agora = new Date();
    const semente = randomUUID();

    const ultima = db
      .prepare(
        `SELECT familiar, leitura_json, perfil_json, signo_lua FROM pedidos
         WHERE lower(email) = ? AND status = 'entregue'
         ORDER BY criado_em DESC LIMIT 1`
      )
      .get(sessao.email) as
      | {
          familiar: string;
          leitura_json: string | null;
          perfil_json: string | null;
          signo_lua: string | null;
        }
      | undefined;

    const familiar = ultima ? FAMILIARES[ultima.familiar as FamiliarId] : null;
    const nomeSecreto = ultima?.leitura_json
      ? JSON.parse(ultima.leitura_json).nome_secreto
      : null;
    const nomeDoFamiliar = nomeSecreto ?? familiar?.nome ?? 'Seu familiar';

    const perfilAstral = perfilAstralDaConta(conta.id);
    const natal = mapaDaConta(perfilAstral.dados);
    const pontuacaoDoDia = natal ? pontuarDia(natal, agora) : null;
    const diaDeOuro = pontuacaoDoDia ? ehDiaDeOuro(pontuacaoDoDia) : false;
    const perfil = descreverPerfil(ultima?.perfil_json ?? null);
    const historico = resumoParaContexto(conta.id);

    /* ── 3. A geração ────────────────────────────────────────────────── */
    if (tipo === 'leitura') {
      const espetaculos = sortearEspetaculos({
        semente,
        diaDeOuro,
        quando: agora,
        natal,
        pontuacaoDoDia,
      });

      const gerada = await gerarLeitura({
        nomeDoFamiliar,
        pergunta,
        espetaculos,
        pontuacaoDoDia,
        diaDeOuro,
        perfil,
        historico,
      });

      const id = arquivar({
        contaId: conta.id,
        tipo: 'leitura',
        pergunta,
        semente,
        espetaculos,
        resposta: gerada.dados,
        diaDeOuro,
        modelo: gerada.modelo,
        custoCentavos: gerada.custoCentavos,
        tokensEntrada: gerada.tokensEntrada,
        tokensSaida: gerada.tokensSaida,
      });

      return NextResponse.json({
        id,
        tipo: 'leitura',
        espetaculos,
        leitura: gerada.dados,
        diaDeOuro,
        restante: {
          hoje: cobranca.restanteHoje,
          mes: cobranca.restanteNoMes,
        },
      });
    }

    const ceu = ceuDoDia(agora, (ultima?.signo_lua as Signo) ?? null);
    const gerada = await gerarMensagem({
      nomeDoFamiliar,
      pergunta,
      pontuacaoDoDia,
      faseDaLua: `${ceu.faseNome} em ${ceu.luaEm}`,
      diaDeOuro,
      perfil,
      historico,
    });

    const id = arquivar({
      contaId: conta.id,
      tipo: 'mensagem',
      pergunta,
      semente,
      espetaculos: null,
      resposta: gerada.dados,
      diaDeOuro,
      modelo: gerada.modelo,
      custoCentavos: gerada.custoCentavos,
      tokensEntrada: gerada.tokensEntrada,
      tokensSaida: gerada.tokensSaida,
    });

    return NextResponse.json({
      id,
      tipo: 'mensagem',
      resposta: gerada.dados.resposta,
      diaDeOuro,
      restante: { hoje: cobranca.restanteHoje, mes: cobranca.restanteNoMes },
    });
  } catch (erro) {
    /* ── 4. Falhou: devolve o que foi cobrado ────────────────────────── */
    devolver(conta.id, tipo);
    console.error('[oraculo] falha ao gerar:', erro);
    return NextResponse.json(
      { erro: 'O véu não abriu agora. Tente de novo em instantes — nada foi cobrado.' },
      { status: 502 }
    );
  }
}
