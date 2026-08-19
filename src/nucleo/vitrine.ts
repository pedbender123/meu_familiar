import { listarPlanos, direitosDoPlano, type Plano } from './planos';
import type { Direitos } from './direitos';

/**
 * A vitrine — os planos como a pessoa os vê.
 *
 * ── Por que a descrição é derivada, e não escrita à mão ───────────────────
 *
 * Cada linha do "o que vem" sai dos DIREITOS do plano, não de um texto solto
 * na tela. É o que garante que a vitrine nunca prometa o que o acesso não
 * libera: se alguém mudar `leiturasPorMes` numa migração e esquecer da
 * landing, a landing muda junto.
 *
 * O caso clássico que isso evita é o pior de todos num produto de assinatura:
 * a página de vendas dizendo "calendário do ano inteiro" enquanto o
 * `alcanceCalendario` do plano diz `mes`.
 */
export interface ItemDaVitrine {
  plano: Plano;
  direitos: Direitos;
  /** `revelacao_mensal` e `revelacao_anual` são o mesmo produto em dois prazos. */
  familia: 'revelacao' | 'acompanhamento' | 'outro';
  anual: boolean;
  /** Quanto sai por mês — é assim que se compara anual com mensal. */
  porMesCentavos: number;
  beneficios: string[];
}

const ALCANCE_EM_PALAVRAS: Record<string, string> = {
  nenhum: '',
  hoje: 'Calendário: o dia de hoje',
  semana: 'Calendário da semana inteira',
  mes: 'Calendário do mês inteiro',
  semestre: 'Calendário dos 6 meses à frente',
  ano: 'Calendário dos 12 meses à frente',
  rolante: 'Calendário sempre com 12 meses à frente',
};

function beneficiosDe(direitos: Direitos): string[] {
  const lista: string[] = [];

  if (direitos.leiturasPorMes > 0) {
    lista.push(
      direitos.leiturasPorMes === 1
        ? '1 leitura do Oráculo por mês'
        : `${direitos.leiturasPorMes} leituras do Oráculo por mês`
    );
  }

  if (direitos.perguntasOraculo > 0) {
    lista.push(
      `${direitos.perguntasOraculo} mensagens por mês` +
        (direitos.perguntasOraculoPorDia > 0
          ? ` (${direitos.perguntasOraculoPorDia} por dia)`
          : '')
    );
  }

  const calendario = ALCANCE_EM_PALAVRAS[direitos.alcanceCalendario];
  if (calendario) lista.push(calendario);

  if (direitos.relatorioCompleto) lista.push('Relatório completo do seu perfil');
  if (direitos.graficos) lista.push('Os gráficos do que o teste mede');
  if (direitos.narracaoAudio) lista.push('Sua leitura narrada em áudio');
  if (direitos.perfilPublico) lista.push('Perfil público para compartilhar');
  if (direitos.conselhoDiario) lista.push('Conselho todo dia, não só na semana');
  if (direitos.guiaPorEmail) lista.push('O guia chega no seu e-mail');

  return lista;
}

function familiaDe(id: string): ItemDaVitrine['familia'] {
  if (id.startsWith('revelacao')) return 'revelacao';
  if (id.startsWith('acompanhamento')) return 'acompanhamento';
  return 'outro';
}

/**
 * Os planos vendáveis, do mais barato ao mais caro.
 *
 * O gratuito fica de fora: ele não se "assina", ganha-se fazendo o ritual —
 * e um card de R$ 0,00 ao lado dos pagos convida a pessoa a escolher o
 * gratuito num lugar onde ela já está decidindo pagar.
 */
export function vitrine(): ItemDaVitrine[] {
  return listarPlanos()
    .filter((p) => p.publico && p.ativo && p.preco_centavos > 0)
    .map((plano) => {
      const direitos = direitosDoPlano(plano);
      const anual = (plano.duracao_dias ?? 0) >= 300;
      return {
        plano,
        direitos,
        familia: familiaDe(plano.id),
        anual,
        porMesCentavos: anual
          ? Math.round(plano.preco_centavos / 12)
          : plano.preco_centavos,
        beneficios: beneficiosDe(direitos),
      };
    })
    .sort((a, b) => a.porMesCentavos - b.porMesCentavos);
}

/** O que o plano gratuito entrega — pra landing mostrar o que é de graça. */
export function beneficiosDoGratuito(): string[] {
  const plano = listarPlanos().find((p) => p.id === 'gratuito');
  if (!plano) return [];
  return beneficiosDe(direitosDoPlano(plano));
}

export function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
