import type { Migracao } from './tipos';

/**
 * A escada de preços de 19/08/2026 — a que o funil novo vende.
 *
 * ── O que mudou, e por que a tabela antiga não servia ─────────────────────
 *
 * A tabela de 17/08 tinha dois degraus (15,90 e 39,90) e um grátis que já
 * entregava a Revelação inteira em PDF. Isso deixava o produto sem nada para
 * vender na hora de maior atenção da pessoa — logo depois do ritual — e ao
 * mesmo tempo dava de graça o artefato que dá trabalho de gerar.
 *
 * A escada nova separa as duas coisas:
 *
 * **A oferta depois do ritual** vende entrega rápida, para fazer caixa:
 *   - `avulsa_simples`  R$ 7,90  — a revelação em PDF e imagens
 *   - `avulsa_completa` R$ 15,90 — + relatório longo, gráficos, narração
 *   - `revelacao_mensal` R$ 29,90/mês — a única recorrente dessa tela
 *
 * **A `/planos`** vende permanência, e só aparece depois:
 *   - `vigilia`         R$ 15,90/mês
 *   - `revelacao_mensal` R$ 29,90/mês
 *   - `conselho`        R$ 49,90/mês
 *
 * ── As avulsas não expiram ────────────────────────────────────────────────
 *
 * Quem compra 7,90 ou 15,90 fica com o app limitado **para sempre** (é o que
 * `duracao_dias = NULL` significa aqui). Compra avulsa que vira acesso
 * temporário sem a pessoa entender é a origem de estorno, e o ganho de
 * espremer 30 dias não paga o dano. O que separa a avulsa do plano não é
 * prazo, é alcance: a avulsa dá a semana no calendário e as cotas do grátis.
 *
 * ── O grátis perdeu a Revelação, e ganhou o dia ───────────────────────────
 *
 * A migração 017 tinha dado `pdf` e `imagens` ao grátis. O `pdf` volta atrás:
 * a imagem e o nome do familiar continuam de graça (é o que a pessoa mostra
 * pra alguém, e é o melhor anúncio que existe), mas o **texto** da revelação
 * passa a ser o que se compra. Em troca o grátis ganha o calendário do dia de
 * hoje calculado de verdade, com o resto do mês visível em cadeado — porque o
 * que não aparece não vende.
 *
 * ── `acompanhamento_*` sai de cena ────────────────────────────────────────
 *
 * Os 39,90 não existem mais na escada nova. Os planos são **desativados**, não
 * apagados: assinatura ativa continua lendo os direitos dela pela linha do
 * plano, e apagar a linha trancaria do lado de fora quem pagou. `ativo = 0` só
 * impede novas vendas.
 */

interface Direitos {
  pdf: boolean;
  imagens: boolean;
  relatorioCompleto: boolean;
  graficos: boolean;
  perfilPublico: boolean;
  tiragemDiaria: boolean;
  perguntasOraculo: number;
  narracaoAudio: boolean;
  perfilCompleto: boolean;
  oraculoNaHora: boolean;
  alcanceCalendario: string;
  perguntasOraculoPorDia: number;
  leiturasPorMes: number;
  conselhoDiario: boolean;
  guiaPorEmail: boolean;
}

/**
 * O grátis, e a base de todo o resto.
 *
 * Imagem e nome do familiar, as métricas do teste, o dia de hoje no
 * calendário, e cotas que provam o Oráculo sem sustentar ninguém nele.
 */
const GRATIS: Direitos = {
  pdf: false,
  imagens: true,
  relatorioCompleto: false,
  graficos: true,
  perfilPublico: false,
  tiragemDiaria: true,
  perguntasOraculo: 5,
  narracaoAudio: false,
  perfilCompleto: true,
  oraculoNaHora: false,
  alcanceCalendario: 'hoje',
  perguntasOraculoPorDia: 1,
  leiturasPorMes: 1,
  conselhoDiario: false,
  guiaPorEmail: false,
};

/** A revelação simples: o artefato, sem o relatório longo. */
const AVULSA_SIMPLES: Direitos = {
  ...GRATIS,
  pdf: true,
  alcanceCalendario: 'semana',
};

/** A revelação completa: o relatório longo, os gráficos e a narração. */
const AVULSA_COMPLETA: Direitos = {
  ...AVULSA_SIMPLES,
  relatorioCompleto: true,
  perfilPublico: true,
  narracaoAudio: true,
};

/** Daqui pra cima é assinatura: o app inteiro, variando alcance e cota. */
const VIGILIA: Direitos = {
  ...AVULSA_COMPLETA,
  oraculoNaHora: true,
  alcanceCalendario: 'mes',
  // "1 leitura por semana" — quatro por mês é a leitura fiel do que foi
  // vendido, e é a que não deixa fevereiro parecer roubo.
  leiturasPorMes: 4,
  perguntasOraculo: 30,
  perguntasOraculoPorDia: 2,
};

const REVELACAO: Direitos = {
  ...VIGILIA,
  alcanceCalendario: 'semestre',
  leiturasPorMes: 10,
  perguntasOraculo: 60,
  perguntasOraculoPorDia: 4,
  guiaPorEmail: true,
};

const CONSELHO: Direitos = {
  ...REVELACAO,
  alcanceCalendario: 'ano',
  leiturasPorMes: 30,
  perguntasOraculo: 200,
  perguntasOraculoPorDia: 10,
  conselhoDiario: true,
};

interface LinhaDePlano {
  id: string;
  nome: string;
  preco: number;
  /** `null` = não expira. */
  dias: number | null;
  recorrente: number;
  publico: number;
  direitos: Direitos;
}

const PLANOS: LinhaDePlano[] = [
  { id: 'gratuito', nome: 'Bruxário aberto', preco: 0, dias: null, recorrente: 0, publico: 1, direitos: GRATIS },

  // Fora da vitrine: só aparecem na tela de oferta, logo depois do ritual.
  { id: 'avulsa_simples', nome: 'Revelação simples', preco: 790, dias: null, recorrente: 0, publico: 0, direitos: AVULSA_SIMPLES },
  { id: 'avulsa_completa', nome: 'Revelação completa', preco: 1590, dias: null, recorrente: 0, publico: 0, direitos: AVULSA_COMPLETA },

  { id: 'vigilia', nome: 'Vigília', preco: 1590, dias: 30, recorrente: 1, publico: 1, direitos: VIGILIA },
  { id: 'revelacao_mensal', nome: 'Revelação', preco: 2990, dias: 30, recorrente: 1, publico: 1, direitos: REVELACAO },
  { id: 'conselho', nome: 'Conselho', preco: 4990, dias: 30, recorrente: 1, publico: 1, direitos: CONSELHO },

  /**
   * Os anuais saem da vitrine (`publico = 0`), como o desenho original previa:
   * eles são a oferta de dentro, para quem já está pagando e já sabe que usa.
   * Dez meses pelo preço de doze — o desconto é caixa antecipado, não
   * generosidade.
   */
  { id: 'vigilia_anual', nome: 'Vigília · anual', preco: 15900, dias: 365, recorrente: 1, publico: 0, direitos: VIGILIA },
  { id: 'revelacao_anual', nome: 'Revelação · anual', preco: 29900, dias: 365, recorrente: 1, publico: 0, direitos: REVELACAO },
  { id: 'conselho_anual', nome: 'Conselho · anual', preco: 49900, dias: 365, recorrente: 1, publico: 0, direitos: CONSELHO },
];

const migracao: Migracao = {
  id: '019_planos_de_agosto',
  descricao: 'Escada nova: avulsas 7,90/15,90 e os recorrentes Vigília, Revelação e Conselho',
  up: (db) => {
    const agora = new Date().toISOString();

    const gravar = db.prepare(
      `INSERT INTO planos
         (id, nome, preco_centavos, duracao_dias, recorrente, parcelas_max,
          publico, direitos_json, ativo, criado_em, atualizado_em)
       VALUES (@id, @nome, @preco, @dias, @recorrente, 1, @publico, @direitos, 1, @agora, @agora)
       ON CONFLICT(id) DO UPDATE SET
         nome = @nome,
         preco_centavos = @preco,
         duracao_dias = @dias,
         recorrente = @recorrente,
         publico = @publico,
         direitos_json = @direitos,
         ativo = 1,
         atualizado_em = @agora`
    );

    for (const p of PLANOS) {
      gravar.run({
        id: p.id,
        nome: p.nome,
        preco: p.preco,
        dias: p.dias,
        recorrente: p.recorrente,
        publico: p.publico,
        direitos: JSON.stringify(p.direitos),
        agora,
      });
    }

    /**
     * Desativados, nunca apagados: quem tem assinatura ativa de
     * `acompanhamento_*` lê os direitos pela linha do plano, e remover a linha
     * trancaria essa pessoa do lado de fora do que ela pagou.
     */
    db.prepare(
      `UPDATE planos SET ativo = 0, publico = 0, atualizado_em = ?
       WHERE id IN ('acompanhamento_mensal', 'acompanhamento_anual')`
    ).run(agora);
  },
};

export default migracao;
