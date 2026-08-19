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
  familia: 'vigilia' | 'revelacao' | 'conselho' | 'outro';
  anual: boolean;
  /** Quanto sai por mês — é assim que se compara anual com mensal. */
  porMesCentavos: number;
  beneficios: string[];
  /**
   * Só o que este plano acrescenta ao degrau imediatamente mais barato.
   *
   * A vitrine inteira é uma escada: quem paga mais recebe tudo do de baixo e
   * mais alguma coisa. Repetir a lista inteira em cada card obriga a pessoa a
   * comparar três listas quase idênticas para achar as duas linhas que
   * mudaram — e é exatamente nessas duas linhas que a decisão mora.
   *
   * Derivado, e não escrito à mão, pelo mesmo motivo que `beneficios`: se uma
   * migração mudar uma cota, a diferença na tela muda junto.
   *
   * No degrau mais barato é igual a `beneficios` — não há anterior.
   */
  ganhos: string[];
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

/**
 * A lista COMPLETA do que um conjunto de direitos entrega, em português.
 *
 * Exportada porque os Termos de Uso precisam dela: nas telas de venda a
 * escada mostra só a diferença entre degraus, mas num documento legal a
 * pessoa tem que ler tudo o que está levando — "o relatório longo e os
 * gráficos" não é descrição de produto se o PDF também está incluso e ficou
 * de fora da frase.
 */
export function beneficiosDosDireitos(direitos: Direitos): string[] {
  return beneficiosDe(direitos);
}

function beneficiosDe(direitos: Direitos): string[] {
  const lista: string[] = [];

  /**
   * O texto da revelação vem PRIMEIRO, e faltava inteiro até 19/08.
   *
   * `pdf` era o único direito que a lista nunca traduzia em palavra — e virou
   * justamente a linha que separa o grátis do primeiro degrau pago. Sem ela,
   * a oferta de R$ 7,90 se descrevia como "os gráficos e o calendário da
   * semana", escondendo a única coisa pela qual a pessoa está pagando.
   */
  if (direitos.pdf) lista.push('O texto completo da sua revelação, em PDF');

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
  if (id.startsWith('vigilia')) return 'vigilia';
  if (id.startsWith('revelacao')) return 'revelacao';
  if (id.startsWith('conselho')) return 'conselho';
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
        // Preenchido por `vitrineEmEscada`; sozinha, a vitrine não sabe qual
        // é o degrau anterior de cada plano.
        ganhos: [],
      };
    })
    .sort((a, b) => a.porMesCentavos - b.porMesCentavos);
}

/**
 * A vitrine com a escada já calculada, separada por prazo.
 *
 * A comparação só vale dentro do mesmo prazo: o que o anual de 29,90
 * acrescenta é medido contra o anual de 15,90, nunca contra o mensal.
 */
export function vitrineEmEscada(): ItemDaVitrine[] {
  const itens = vitrine();

  for (const prazo of [false, true]) {
    const degraus = itens.filter((i) => i.anual === prazo);
    let anteriores = new Set<string>();
    for (const degrau of degraus) {
      degrau.ganhos = degrau.beneficios.filter((b) => !anteriores.has(b));
      anteriores = new Set(degrau.beneficios);
    }
  }

  return itens;
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
