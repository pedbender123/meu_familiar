import type { Migracao } from './tipos';

/**
 * De onde veio quem assinou — e o registro de cada renovação.
 *
 * ── O buraco que isto fecha ───────────────────────────────────────────────
 *
 * Em 01/09 a primeira assinatura paga de verdade entrou, e ao procurá-la no
 * painel ela não estava em lugar nenhum: nem na Central, nem na campanha, nem
 * na UTMify. `pedidos` guarda `campanha_id`, `peca_id`, `origem` e `utm_json`
 * desde a migração 026; `cobrancas` nasceu sem nada disso, porque quando ela
 * foi escrita assinatura era uma venda de dentro do app — alguém que já era
 * cliente comprando um plano.
 *
 * Deixou de ser. Hoje a assinatura é vendida na tela de oferta, logo depois
 * do ritual, para tráfego pago. Ela É a campanha — e era a única venda do
 * sistema que não sabia dizer de onde tinha vindo.
 *
 * ── Por que as mesmas colunas de `pedidos`, com os mesmos nomes ───────────
 *
 * Porque a pergunta é a mesma, e o relatório vai ter que somar as duas
 * tabelas. Nome diferente para o mesmo conceito é o que obriga cada consulta
 * futura a lembrar de traduzir — e a que esquecer devolve um número menor sem
 * reclamar de nada.
 *
 * ── `renovacao_de`: a renovação vira uma cobrança de verdade ──────────────
 *
 * Até aqui, o segundo mês empurrava `assinaturas.fim` para frente e não
 * deixava rastro nenhum: sem valor, sem data, sem transação. Um assinante de
 * seis meses tinha uma única linha de dinheiro no banco — a do primeiro mês.
 *
 * Isso não é só relatório com buraco. É a UTMify vendo uma venda onde houve
 * seis, e a agência calculando o retorno da campanha sobre um sexto do que
 * ela trouxe. O jeito de a receita recorrente aparecer onde receita aparece é
 * ela existir como linha, e o lugar dessa linha é aqui.
 *
 * A renovação nasce apontando para a cobrança original, herdando a atribuição
 * dela: **a campanha que trouxe a pessoa é a mesma que está pagando o sexto
 * mês.**
 *
 * `assinatura_externa_id` fica NULO na linha de renovação de propósito.
 * `cobrancaDoContrato` procura o contrato por `LIKE` e pega a mais recente —
 * preenchê-lo faria a renovação achar a si mesma em vez da original, e a
 * cadeia se perderia no mês seguinte.
 */
const migracao: Migracao = {
  id: '038_atribuicao_na_cobranca',
  descricao: 'Campanha, UTM e histórico de renovação na cobrança de assinatura',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(cobrancas)`).all() as { name: string }[]).map(
      (c) => c.name
    );

    for (const coluna of [
      'campanha_id',
      'peca_id',
      'origem',
      'atribuicao',
      'utm_json',
      'ip_comprador',
      // O espelho de `pedidos` (migração 034): a tela de Saúde pergunta "a
      // UTMify recebeu?" e precisa da mesma resposta para os dois lados.
      'utmify_em',
      'utmify_erro',
      'renovacao_de',
    ]) {
      if (!colunas.includes(coluna)) {
        db.exec(`ALTER TABLE cobrancas ADD COLUMN ${coluna} TEXT`);
      }
    }

    /*
      O relatório de campanha filtra por `campanha_id` numa janela de tempo —
      exatamente este índice. Sem ele, cada tela de campanha varre a tabela
      inteira de cobranças.
    */
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_campanha
         ON cobrancas (campanha_id, criado_em)`
    );

    /*
      Uma transação do gateway paga UM mês, e não pode virar duas linhas de
      receita. O reenvio do webhook já é barrado em `renovarAssinatura` pela
      `ultima_transacao`, mas idempotência que mora só na lógica é
      idempotência que a próxima refatoração pode desfazer sem perceber.

      Parcial porque toda cobrança que não é renovação tem a coluna nula, e
      nulo repetido não é colisão.
    */
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_renovacao
         ON cobrancas (renovacao_de, pagamento_id)
       WHERE renovacao_de IS NOT NULL`
    );
  },
};

export default migracao;
