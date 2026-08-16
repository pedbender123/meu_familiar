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
  atualizadoEm: '31 de julho de 2026',
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
