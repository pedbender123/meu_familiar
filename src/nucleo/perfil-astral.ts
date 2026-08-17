import db from '../lib/db';

/**
 * O que a conta ainda precisa informar pra tudo funcionar.
 *
 * O Calendário (Fase 7) exige mapa natal, e mapa natal exige **data, hora e
 * lugar** de nascimento. O funil de venda nunca perguntou o lugar, e a data
 * ficou dentro de `respostas_json` do pedido — dado de pedido, não de pessoa.
 *
 * Em vez de o Calendário nascer capenga (só trânsitos sobre Sol e Lua, sem
 * ascendente nem casas), a conta sabe que está incompleta e pede o que falta:
 * na primeira visita e, se a pessoa pular, por e-mail. É a diferença entre
 * "recurso pela metade pra todo mundo" e "recurso inteiro, um passo depois".
 */
// Reexportado por conveniência de quem já lida com perfil astral no
// servidor; a definição mora em `lib/nascimento.ts` porque o formulário é
// componente de cliente e não pode importar este módulo (que puxa o banco).
export { HORA_PADRAO } from '../lib/nascimento';

export interface DadosDeNascimento {
  data: string | null;
  hora: string | null;
  /** `true` = chutamos meio-dia. Sol e Lua valem; ascendente e casas, não. */
  horaAproximada: boolean;
  cidade: string | null;
  lat: number | null;
  lon: number | null;
  preenchidoEm: string | null;
}

export interface EstadoDoPerfilAstral {
  completo: boolean;
  /** O que falta, em nome legível — é o que a tela mostra. */
  faltando: string[];
  dados: DadosDeNascimento;
}

interface LinhaConta {
  nascimento_data: string | null;
  nascimento_hora: string | null;
  nascimento_hora_aproximada: number | null;
  nascimento_cidade: string | null;
  nascimento_lat: number | null;
  nascimento_lon: number | null;
  nascimento_preenchido_em: string | null;
}

export function perfilAstralDaConta(contaId: string): EstadoDoPerfilAstral {
  const linha = db
    .prepare(
      `SELECT nascimento_data, nascimento_hora, nascimento_hora_aproximada,
              nascimento_cidade, nascimento_lat, nascimento_lon,
              nascimento_preenchido_em
       FROM contas WHERE id = ?`
    )
    .get(contaId) as LinhaConta | undefined;

  const dados: DadosDeNascimento = {
    data: linha?.nascimento_data ?? null,
    hora: linha?.nascimento_hora ?? null,
    horaAproximada: !!linha?.nascimento_hora_aproximada,
    cidade: linha?.nascimento_cidade ?? null,
    lat: linha?.nascimento_lat ?? null,
    lon: linha?.nascimento_lon ?? null,
    preenchidoEm: linha?.nascimento_preenchido_em ?? null,
  };

  const faltando: string[] = [];
  if (!dados.data) faltando.push('a data de nascimento');
  // A hora NÃO entra em `faltando`: quem não sabe a hora recebe meio-dia e
  // segue. Exigi-la trancaria fora do Calendário quem simplesmente não tem
  // como descobrir — ver HORA_PADRAO.
  if (!dados.hora) faltando.push('a hora (ou pule, se não souber)');
  // Lat/lon é o que o cálculo usa; cidade é só o rótulo que a pessoa
  // reconhece. Faltando as coordenadas, não há casas nem ascendente.
  if (dados.lat === null || dados.lon === null) faltando.push('a cidade onde nasceu');

  return { completo: faltando.length === 0, faltando, dados };
}

export function salvarDadosDeNascimento(
  contaId: string,
  dados: {
    data: string;
    hora: string;
    cidade: string;
    lat: number;
    lon: number;
    horaAproximada?: boolean;
  }
): void {
  db.prepare(
    `UPDATE contas SET
       nascimento_data = @data, nascimento_hora = @hora,
       nascimento_hora_aproximada = @horaAproximada,
       nascimento_cidade = @cidade, nascimento_lat = @lat, nascimento_lon = @lon,
       nascimento_preenchido_em = @agora
     WHERE id = @contaId`
  ).run({
    ...dados,
    horaAproximada: dados.horaAproximada ? 1 : 0,
    contaId,
    agora: new Date().toISOString(),
  });
}

/**
 * Aproveita o que a pessoa já respondeu no ritual.
 *
 * Data e hora já foram perguntadas no quiz e estão em `respostas_json` do
 * pedido — pedir de novo seria fazer a pessoa digitar o que ela já digitou,
 * e cada campo a mais é gente que desiste no meio. Só a cidade é realmente
 * nova.
 *
 * Não sobrescreve o que já foi preenchido à mão: o que a pessoa confirmou na
 * conta vale mais que o que foi capturado no funil.
 */
export function herdarNascimentoDosPedidos(contaId: string, email: string): void {
  const atual = perfilAstralDaConta(contaId);
  if (atual.dados.data && atual.dados.hora) return;

  const pedido = db
    .prepare(
      `SELECT respostas_json FROM pedidos
       WHERE lower(email) = ? AND respostas_json IS NOT NULL
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get(email.trim().toLowerCase()) as { respostas_json: string } | undefined;
  if (!pedido) return;

  try {
    const respostas = JSON.parse(pedido.respostas_json) as {
      dataNascimento?: string;
      horaNascimento?: string;
    };
    if (!respostas.dataNascimento) return;

    db.prepare(
      `UPDATE contas SET
         nascimento_data = COALESCE(nascimento_data, @data),
         nascimento_hora = COALESCE(nascimento_hora, @hora)
       WHERE id = @contaId`
    ).run({
      data: respostas.dataNascimento,
      hora: respostas.horaNascimento ?? null,
      contaId,
    });
  } catch {
    // `respostas_json` malformado não pode quebrar o login de ninguém.
  }
}
