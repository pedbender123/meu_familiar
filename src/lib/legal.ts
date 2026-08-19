/**
 * Os dados que as páginas legais precisam citar, num lugar só.
 *
 * Ficam aqui e não escritos dentro do JSX porque aparecem nas duas páginas,
 * nos e-mails e no rodapé — e documento legal com informação divergente entre
 * páginas é pior que documento curto.
 *
 * ── Sobre o CPF ───────────────────────────────────────────────────────────
 *
 * A LGPD exige que o **controlador seja identificável** (art. 41) — exige nome
 * e canal de contato, não a publicação do CPF. Deixar CPF exposto num site é
 * risco de fraude para você sem ganho legal nenhum. Se algum dia um titular
 * ou a ANPD precisar do documento, ele é fornecido pelo canal de contato.
 */
export const LEGAL = {
  /** Nome civil de quem responde pelo tratamento dos dados. */
  controlador: 'Pedro Bender Randon',
  /** Pessoa física por enquanto (ver a nota de versão no fim das páginas). */
  natureza: 'pessoa física',
  site: 'bruxario.com.br',
  canalDeContato: '/contato',
  /**
   * Idade mínima. **Escolha de projeto, não de lei.**
   *
   * Dado de criança e adolescente tem regime próprio na LGPD (art. 14), com
   * consentimento de responsável e todo um aparato que uma operação deste
   * tamanho não sustenta. 18+ evita isso inteiro. Baixar para 16 é possível,
   * mas exige repensar o corpus e a coleta.
   */
  idadeMinima: 18,
  /** CDC art. 49. Contado da confirmação do pagamento. */
  diasDeArrependimento: 7,
  /**
   * Prazo para cancelar uma assinatura sem ser cobrado no ciclo seguinte.
   *
   * Zero: o cancelamento vale na hora, e o acesso segue até o fim do período
   * já pago. Não existe multa, carência nem aviso prévio — cobrar por sair de
   * um produto mensal de R$ 29,90 renderia centavos e geraria contestação, que
   * custa muito mais caro que o mês que se tentou segurar.
   */
  diasDeAvisoParaCancelar: 0,
  atualizadoEm: '19 de agosto de 2026',
} as const;

/** Com quem os dados são compartilhados, e para quê. */
export const TERCEIROS = [
  {
    nome: 'Google (Gemini)',
    para: 'gerar o texto da sua leitura',
    oQue: 'suas escolhas no ritual, seu primeiro nome e seus signos',
    fora: true,
  },
  {
    nome: 'Mercado Pago',
    para: 'processar o pagamento',
    oQue: 'os dados que você digita na tela de pagamento — nenhum dado de cartão passa pelos nossos servidores',
    fora: false,
  },
  {
    /**
     * **Estava faltando, e era a omissão mais séria das páginas legais.**
     *
     * O site roda o pixel da Meta desde o começo, e desde a Fase 1 também o
     * CAPI server-side, que envia evento de compra com o e-mail *hasheado*.
     * A política afirmava, em letras, que não havia "medidor de terceiros" —
     * o que é o oposto do que acontece. Aviso de tratamento de dados que
     * contradiz o código não protege ninguém e vira prova contra a operação.
     */
    nome: 'Meta (Facebook e Instagram)',
    para: 'medir o resultado dos anúncios',
    oQue:
      'que páginas você abriu e se comprou, mais seu e-mail transformado em código irreversível (hash) para casar a venda com o anúncio — nunca o e-mail legível',
    fora: true,
  },
  {
    nome: 'Resend',
    para: 'entregar os e-mails',
    oQue: 'seu e-mail e o conteúdo das mensagens que enviamos',
    fora: false,
  },
  {
    nome: 'Hostinger',
    para: 'hospedar o site e o banco de dados',
    oQue: 'tudo que fica guardado',
    fora: false,
  },
] as const;
