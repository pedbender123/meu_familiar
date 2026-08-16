import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { pastaDoPedido } from './caminhos';
import { diasRestantes, produtoDe, precoFormatado, PRODUTOS } from './produtos';

/**
 * E-mail transacional via Resend.
 *
 * ── Por que o PDF vai ANEXADO, não linkado ────────────────────────────────
 *
 * O link da Revelação expira em 7 dias. Se o e-mail só apontasse para ele, o
 * e-mail expiraria junto — e a pessoa que pagou ficaria sem nada guardado, que
 * é exatamente o problema que o e-mail existe para resolver. Com o anexo, a
 * caixa de entrada dela **é** a cópia permanente, e o link vira conveniência.
 *
 * ── Sem chave, não quebra ─────────────────────────────────────────────────
 *
 * Sem `RESEND_API_KEY` o módulo imprime no console em vez de enviar. Isso não
 * é preguiça: enquanto o domínio não estiver verificado no Resend (o que
 * depende do DNS do bruxario.com.br sair do parking), o envio real para
 * terceiros é recusado de qualquer forma. O modo console é o que permite
 * desenvolver e testar o link mágico e a entrega antes disso.
 */

const CORES = {
  tinta: '#171225',
  pergaminho: '#EAE0CC',
  vela: '#D9A441',
  violeta: '#7B6394',
};

/**
 * Aspas sobrando quebram o envio inteiro com um erro que não diz a causa
 * ("Invalid `from` field"). O carregador de .env dos scripts já as remove,
 * mas um `.env` editado à mão em produção é o tipo de coisa que ninguém
 * revisa — então limpa de novo aqui, onde o custo é zero.
 */
function remetente(): string {
  const bruto = process.env.EMAIL_REMETENTE?.trim();
  if (!bruto) return 'Bruxário <onboarding@resend.dev>';
  return bruto.replace(/^["']|["']$/g, '');
}

function base(): string {
  return process.env.BASE_URL || 'http://localhost:3000';
}

interface Anexo {
  filename: string;
  content: Buffer;
}

interface Mensagem {
  para: string;
  assunto: string;
  html: string;
  /** Versão de texto puro. Sem ela, filtros de spam penalizam. */
  texto: string;
  anexos?: Anexo[];
}

async function enviar(msg: Mensagem): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `[email: modo console] para=${msg.para} assunto="${msg.assunto}"\n` +
        `${msg.texto}\n` +
        (msg.anexos?.length
          ? `anexos: ${msg.anexos.map((a) => a.filename).join(', ')}\n`
          : '')
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: remetente(),
    to: msg.para,
    subject: msg.assunto,
    html: msg.html,
    text: msg.texto,
    ...(msg.anexos?.length
      ? {
          attachments: msg.anexos.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        }
      : {}),
  });

  // O SDK do Resend devolve o erro em vez de lançar. Sem esta checagem, uma
  // falha de envio passa como sucesso silencioso — que é o pior desfecho.
  if (error) {
    throw new Error(`Resend recusou o envio: ${error.name} — ${error.message}`);
  }

  // O id fica no log de propósito: quando alguém disser "não recebi", é com
  // ele que se consulta o status real no painel do Resend em vez de adivinhar
  // entre "não enviou", "caiu no spam" e "o provedor recusou".
  console.log(`[email] enviado id=${data?.id ?? '?'} para=${msg.para} assunto="${msg.assunto}"`);
}

/** Moldura visual comum. Tabela e estilo inline porque cliente de e-mail é 2003. */
function moldura(conteudo: string): string {
  return `
<div style="background:${CORES.tinta};padding:32px 16px;font-family:Georgia,serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"
         style="max-width:520px;margin:0 auto;background:#E7DCC4;border-radius:2px;">
    <tr><td style="padding:36px 32px;color:#2E2438;">
      ${conteudo}
      <p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#6B5F72;">
        O Bruxário é entretenimento e autoconhecimento simbólico. As leituras são
        geradas com auxílio de inteligência artificial e não substituem
        orientação profissional de nenhuma natureza.
      </p>
    </td></tr>
  </table>
</div>`;
}

/**
 * Carimba o link de e-mail com o marcador que diz de qual e-mail ele veio.
 *
 * ── Por que cada e-mail precisa do seu ────────────────────────────────────
 *
 * Sem isto, todo clique vindo de e-mail chega indistinguível de acesso
 * direto, e o painel some com um canal inteiro. Com isto, e melhor: o
 * marcador também diz se aquele clique CONTA como aquisição.
 *
 * O link de acesso à conta é a pessoa voltando ao que já comprou — creditar
 * isso ao canal "e-mail" inventaria um canal produtivo que não traz ninguém
 * novo, e roubaria a venda de quem de fato a trouxe. Já o de remarketing
 * existe justamente para reconquistar quem foi embora: quando ele fecha
 * venda, o crédito é dele. Ver MARCAS_DE_EMAIL em `lib/rastreio.ts`.
 */
function comMarca(url: string, marca: string): string {
  return url.includes('?') ? `${url}&e=${marca}` : `${url}?e=${marca}`;
}

function botao(url: string, texto: string): string {
  return `<a href="${url}" style="display:inline-block;background:${CORES.vela};color:${CORES.tinta};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:13px 26px;border-radius:999px;">${texto}</a>`;
}

/** Pedaço de nome de arquivo: sem acento, sem espaço, minúsculo. */
function arquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * A entrega da revelação. Vai com o PDF anexado e, quando o acesso é
 * temporário, diz **na primeira linha visível** quando o link some.
 */
export async function enviarRevelacao(params: {
  nome: string;
  email: string;
  pedidoId: string;
  produtoId: string;
  nomeFamiliar: string;
  nomeSecreto: string;
  expiraEm: string | null;
}): Promise<void> {
  const { nome, email, pedidoId, produtoId, nomeFamiliar, nomeSecreto, expiraEm } =
    params;

  const url = comMarca(`${base()}/revelacao/${pedidoId}`, 'rv');
  const produto = produtoDe(produtoId);

  const dias = expiraEm ? Math.max(0, diasRestantes(expiraEm)) : null;
  const avisoPrazo =
    dias === null
      ? ''
      : `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B4E1E;background:rgba(217,164,65,0.16);border-radius:6px;padding:12px 14px;">
           <strong>Seu link fica aberto por ${produto.diasDeLinkPublico} dias</strong> —
           até ${new Date(expiraEm!).toLocaleDateString('pt-BR')}. O PDF em anexo é
           seu para sempre, guarde este e-mail. Se quiser que o link nunca expire,
           dá para fazer isso por R$ ${precoFormatado(PRODUTOS.link_permanente)}.
         </p>`;

  const anexos: Anexo[] = [];
  const caminhoPdf = path.join(pastaDoPedido(pedidoId), 'revelacao.pdf');
  if (fs.existsSync(caminhoPdf)) {
    anexos.push({
      // O nome do arquivo é o que a pessoa vê na pasta de downloads daqui a
      // dois anos. Leva o nome dela junto: `bruxario-helena-o-corvo.pdf`.
      filename: `bruxario-${arquivo(nome)}-${arquivo(nomeFamiliar)}.pdf`,
      content: fs.readFileSync(caminhoPdf),
    });
  }

  const html = moldura(`
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5F72;">O familiar de</p>
    <p style="margin:0 0 4px;font-size:30px;font-style:italic;color:#2E2438;">${nome}</p>
    <p style="margin:0 0 22px;font-size:19px;font-style:italic;color:#8A6A2F;">${nomeFamiliar} · ${nomeSecreto}</p>
    ${avisoPrazo}
    <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">
      Ele atravessou o véu e está esperando por você.
    </p>
    <p style="margin:0 0 22px;">${botao(url, 'Ver minha revelação')}</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B5F72;">
      Em anexo vai a revelação inteira em PDF — a carta, a leitura, a sua
      invocação${produto.graficos ? ' e os gráficos do seu perfil' : ''}.
      Guarde ou imprima.
    </p>
  `);

  const texto = [
    `${nome}, seu familiar é ${nomeFamiliar} · ${nomeSecreto}.`,
    dias === null
      ? ''
      : `Seu link fica no ar até ${new Date(expiraEm!).toLocaleDateString('pt-BR')}. O PDF em anexo é seu para sempre.`,
    `Em anexo vai a revelação inteira em PDF: a carta, a leitura, a sua invocação${produto.graficos ? ' e os gráficos do seu perfil' : ''}.`,
    `Ver a revelação: ${url}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  await enviar({
    para: email,
    assunto: `${nome}, seu familiar atravessou o véu`,
    html,
    texto,
    anexos,
  });
}

/**
 * Avisa o dono de que chegou um contato.
 *
 * Vai para `ADMIN_EMAIL` e **inclui a mensagem inteira**, de propósito: assim
 * dá para ler e decidir no celular sem abrir o painel. Prometemos responder a
 * pedidos de dados em prazo legal, e o que faz isso acontecer é a notícia
 * chegar onde a pessoa olha, não num painel que ela lembra de abrir.
 */
export async function avisarContatoRecebido(params: {
  destino: string;
  nome: string;
  emailDeQuemEscreveu: string;
  assunto: string;
  mensagem: string;
  pedidoId?: string | null;
}): Promise<void> {
  const { destino, nome, emailDeQuemEscreveu, assunto, mensagem, pedidoId } = params;

  const html = moldura(`
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5F72;">Novo contato · ${assunto}</p>
    <p style="margin:0 0 18px;font-size:22px;font-style:italic;color:#2E2438;">${nome}</p>
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#3A2F44;">
      <strong>De:</strong> ${emailDeQuemEscreveu}
    </p>
    ${pedidoId ? `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:13px;color:#3A2F44;"><strong>Pedido:</strong> ${pedidoId}</p>` : ''}
    <p style="margin:18px 0 0;font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid rgba(217,164,65,0.6);padding-left:14px;">${mensagem}</p>
    <p style="margin:24px 0 0;">${botao(`${base()}/painel`, 'Abrir o painel')}</p>
  `);

  await enviar({
    para: destino,
    assunto: `[Bruxário] ${assunto} — ${nome}`,
    html,
    texto: [
      `Novo contato (${assunto})`,
      `De: ${nome} <${emailDeQuemEscreveu}>`,
      pedidoId ? `Pedido: ${pedidoId}` : '',
      '',
      mensagem,
      '',
      `Painel: ${base()}/painel`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/**
 * Confirma para quem escreveu que a mensagem chegou.
 *
 * Uma linha, sem promessa de prazo que não dá para cumprir sempre. O que ela
 * precisa saber é que não caiu no vazio.
 */
export async function confirmarContato(params: {
  nome: string;
  email: string;
}): Promise<void> {
  const { nome, email } = params;

  await enviar({
    para: email,
    assunto: 'Recebemos sua mensagem',
    html: moldura(`
      <p style="margin:0 0 18px;font-size:22px;font-style:italic;color:#2E2438;">
        ${nome}, sua mensagem chegou.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.7;">
        Uma pessoa vai ler e responder neste mesmo e-mail. O Bruxário é uma
        operação pequena — pode não ser imediato, mas não vai ficar sem resposta.
      </p>
    `),
    texto: `${nome}, sua mensagem chegou. Uma pessoa vai ler e responder neste mesmo e-mail.`,
  });
}

/**
 * O lembrete de quem parou no pagamento.
 *
 * ── O tom é a coisa mais importante aqui ──────────────────────────────────
 *
 * O SPEC 8.4 tem uma regra que vale igual para este e-mail: **formato de
 * presente, nunca de cobrança.** "Seu familiar já sabe quem você é" é presente;
 * "você não finalizou sua compra" é cobrança, e cobrança de um produto de
 * cuidado destrói exatamente a confiança que ele vende.
 *
 * Por isso, também: **um só**. Sem sequência, sem "última chance", sem
 * contagem regressiva. Ignorar não pode custar nada — quem não quis não vai
 * querer no terceiro e-mail, vai só marcar como spam.
 */
export async function enviarLembreteDeCarrinho(params: {
  nome: string;
  email: string;
  pedidoId: string;
  nomeFamiliar: string;
}): Promise<void> {
  const { nome, email, pedidoId } = params;
  const url = comMarca(`${base()}/pagamento/${pedidoId}`, 'ca');

  const html = moldura(`
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5F72;">O ritual ficou aberto</p>
    <p style="margin:0 0 20px;font-size:26px;font-style:italic;color:#2E2438;">
      ${nome}, ele já sabe quem você é.
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;">
      Você respondeu às 26 cenas e o seu familiar foi encontrado — está tudo
      guardado, do jeito que você deixou. Quando quiser, é só continuar de onde
      parou.
    </p>
    <p style="margin:0 0 8px;">${botao(url, 'Ver quem me encontrou')}</p>
  `);

  await enviar({
    para: email,
    assunto: `${nome}, seu familiar ficou esperando`,
    html,
    texto: [
      `${nome}, você respondeu às 26 cenas e o seu familiar foi encontrado.`,
      `Está tudo guardado. Continue de onde parou: ${url}`,
    ].join('\n\n'),
  });
}

/**
 * Avisa que a conta existe e manda o acesso.
 *
 * Vai **depois** do e-mail da revelação, e é um e-mail separado de propósito:
 * são duas notícias diferentes. A primeira é "seu familiar chegou"; esta é
 * "você tem um lugar onde ele mora". Juntá-las faria a segunda desaparecer
 * dentro da primeira, e é a segunda que a pessoa vai precisar daqui a um mês.
 */
export async function enviarContaCriada(params: {
  nome: string;
  email: string;
  url: string;
  minutosDeValidade: number;
  contaNova: boolean;
}): Promise<void> {
  const { nome, email, url, minutosDeValidade, contaNova } = params;

  const html = moldura(`
    <p style="margin:0 0 18px;font-size:24px;font-style:italic;color:#2E2438;">
      ${contaNova ? `${nome}, seu Bruxário está aberto.` : `${nome}, sua revelação já está no seu Bruxário.`}
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;">
      ${
        contaNova
          ? 'Criamos uma conta para você com este mesmo e-mail. Sua revelação fica guardada nela — sem prazo, sem senha para inventar.'
          : 'Ela se juntou às outras que já estavam lá.'
      }
    </p>
    <p style="margin:0 0 22px;">${botao(url, 'Entrar no meu Bruxário')}</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#6B5F72;">
      Este link vale por ${minutosDeValidade} minutos e funciona uma vez só.
      Depois, é só pedir outro em bruxario.com.br/entrar — nunca vai existir
      senha aqui.
    </p>
  `);

  await enviar({
    para: email,
    assunto: contaNova
      ? `${nome}, seu Bruxário está aberto`
      : `${nome}, sua revelação foi guardada`,
    html,
    texto: [
      contaNova
        ? `${nome}, criamos uma conta no Bruxário com este e-mail. Sua revelação fica guardada nela, sem prazo.`
        : `${nome}, sua revelação foi guardada no seu Bruxário.`,
      `Entrar: ${url}`,
      `O link vale ${minutosDeValidade} minutos e funciona uma vez só. Depois é só pedir outro em bruxario.com.br/entrar.`,
    ].join('\n\n'),
  });
}

/**
 * O link mágico de acesso à conta.
 *
 * Três cuidados que a redação carrega de propósito: diz o prazo de validade,
 * diz que é de uso único, e diz o que fazer se a pessoa **não** pediu — que é
 * a linha que transforma um e-mail suspeito em um e-mail confiável.
 */
export async function enviarLinkMagico(params: {
  email: string;
  url: string;
  minutosDeValidade: number;
}): Promise<void> {
  const { email, url, minutosDeValidade } = params;

  const html = moldura(`
    <p style="margin:0 0 18px;font-size:22px;font-style:italic;color:#2E2438;">
      Entrar no seu Bruxário
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">
      Clique no botão abaixo. Ele vale por ${minutosDeValidade} minutos e só
      funciona uma vez.
    </p>
    <p style="margin:0 0 22px;">${botao(url, 'Entrar')}</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#6B5F72;">
      Se não foi você que pediu, ignore este e-mail — ninguém entra sem clicar
      neste link.
    </p>
  `);

  await enviar({
    para: email,
    assunto: 'Seu acesso ao Bruxário',
    html,
    texto: `Entre no seu Bruxário: ${url}\n\nVale por ${minutosDeValidade} minutos e só funciona uma vez. Se não foi você que pediu, ignore este e-mail.`,
  });
}

/**
 * Lembrete de quem largou o ritual no meio, antes de existir pedido.
 *
 * ── Um só, e é isso ───────────────────────────────────────────────────────
 *
 * O e-mail foi pedido com a justificativa de guardar o progresso, então é isso
 * que este envio faz — e `lembrete_em` no banco garante que o segundo envio é
 * impossível, não só improvável. Se isto virar sequência de três, a base legal
 * muda e passa a exigir consentimento marcado pela pessoa.
 */
export async function enviarLembreteDeRascunho(params: {
  email: string;
  cena: number;
}): Promise<void> {
  const { email, cena } = params;
  const url = comMarca(`${base()}/ritual`, 'rs');

  const html = moldura(`
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5F72;">A vela ficou acesa</p>
    <p style="margin:0 0 20px;font-size:26px;font-style:italic;color:#2E2438;">
      Você parou no meio do caminho.
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;">
      ${cena > 0 ? `Você respondeu ${cena} cenas e saiu.` : 'Você começou o ritual e saiu.'}
      Faltam poucos minutos para descobrir qual dos doze caminha ao seu lado.
    </p>
    <p style="margin:0 0 8px;">${botao(url, 'Terminar o ritual')}</p>
    <p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6B5F72;">
      Este é o único lembrete que enviamos. Se não quiser terminar, é só
      ignorar — não entramos em nenhuma lista.
    </p>
  `);

  await enviar({
    para: email,
    assunto: 'Seu ritual ficou pela metade',
    html,
    texto: [
      cena > 0
        ? `Você respondeu ${cena} cenas do ritual e saiu.`
        : 'Você começou o ritual e saiu.',
      `Terminar: ${url}`,
      'Este é o único lembrete que enviamos.',
    ].join('\n\n'),
  });
}

/**
 * O e-mail de oferta (remarketing).
 *
 * ── O que ele tem que os outros não têm ───────────────────────────────────
 *
 * **Link de descadastro, sempre.** Não é enfeite legal: sem uma saída fácil,
 * quem não quer mais receber marca como spam — e reclamação de spam derruba a
 * reputação do domínio inteiro, ou seja, para de entregar até a revelação de
 * quem pagou. O link barato protege o canal caro.
 *
 * ── Por que o corpo vem pronto de fora ────────────────────────────────────
 *
 * O texto é escrito por IA para cada pessoa, revisado na tela do painel e só
 * então enviado. Esta função não gera nada: ela emoldura o que já foi
 * aprovado. Assim o que você leu é exatamente o que sai.
 */
export async function enviarOferta(params: {
  nome: string | null;
  email: string;
  assunto: string;
  /** Parágrafos já revisados. Texto puro — a moldura cuida do HTML. */
  paragrafos: string[];
  urlDaOferta: string;
  textoDoBotao: string;
  /** Ex.: "45% de desconto até domingo". Vai destacado acima do botão. */
  chamada: string;
  urlDeDescadastro: string;
}): Promise<void> {
  const { nome, email, assunto, paragrafos, urlDaOferta, textoDoBotao, chamada, urlDeDescadastro } =
    params;

  const corpoHtml = paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#2E2438;">${p}</p>`
    )
    .join('\n');

  await enviar({
    para: email,
    assunto,
    html: moldura(`
      ${nome ? `<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#2E2438;">${nome},</p>` : ''}
      ${corpoHtml}
      <p style="margin:22px 0 14px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B4E1E;background:rgba(217,164,65,0.16);border-radius:6px;padding:12px 14px;">
        <strong>${chamada}</strong>
      </p>
      <p style="margin:0 0 8px;">${botao(urlDaOferta, textoDoBotao)}</p>
      <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#6B5F72;">
        Não quer mais receber ofertas?
        <a href="${urlDeDescadastro}" style="color:#6B5F72;">Descadastrar</a>.
      </p>
    `),
    texto: [
      nome ? `${nome},` : '',
      ...paragrafos,
      '',
      chamada,
      urlDaOferta,
      '',
      `Para não receber mais ofertas: ${urlDeDescadastro}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  });
}

/**
 * A confirmação de compra de quem ainda não terminou o ritual.
 *
 * No funil novo a pessoa paga com TRÊS cenas respondidas; a leitura só nasce
 * quando as outras vinte e três fecharem. Este e-mail existe por um motivo
 * só: garantir que o link de continuar sobreviva à aba fechada. Ele é o
 * recibo e o caminho de volta na mesma mensagem.
 */
export async function enviarCompraConfirmada(params: {
  nome: string;
  email: string;
  pedidoId: string;
  nomeDoProduto: string;
}): Promise<void> {
  const { nome, email, pedidoId, nomeDoProduto } = params;
  const url = comMarca(`${base()}/ritual/${pedidoId}`, 'cf');

  await enviar({
    para: email,
    assunto: `${nome}, seu pagamento chegou — ele está esperando`,
    html: moldura(`
      <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#2E2438;">
        ${nome},
      </p>
      <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#2E2438;">
        Seu pagamento da <strong>${nomeDoProduto}</strong> foi confirmado. Do
        outro lado do véu, alguém sentiu.
      </p>
      <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#2E2438;">
        Faltam as cenas que dizem <em>qual</em> dos três é o seu. Leva uns
        minutos, e dá para parar e voltar quando quiser — este link guarda o
        seu lugar:
      </p>
      <p style="margin:0 0 8px;">${botao(url, 'Continuar meu ritual')}</p>
      <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#6B5F72;">
        Guarde este e-mail: o link acima é o caminho de volta se você fechar a
        página.
      </p>
    `),
    texto: [
      `${nome},`,
      `Seu pagamento da ${nomeDoProduto} foi confirmado.`,
      `Faltam as cenas que dizem qual dos três é o seu familiar. Continue por aqui:`,
      url,
    ].join('\n\n'),
  });
}

/**
 * O resgate de quem pagou e parou no meio do ritual.
 *
 * O corpo vem pronto de fora (gerado por IA com as respostas que já existem)
 * — esta função só emoldura. Sem link de descadastro de propósito: isto não
 * é oferta, é a entrega de algo já pago.
 */
export async function enviarResgateDoRitual(params: {
  nome: string;
  email: string;
  pedidoId: string;
  paragrafos: string[];
}): Promise<void> {
  const { nome, email, pedidoId, paragrafos } = params;
  const url = comMarca(`${base()}/ritual/${pedidoId}`, 'rt');

  await enviar({
    para: email,
    assunto: `${nome}, ele ainda está te esperando`,
    html: moldura(`
      ${paragrafos
        .map(
          (p) =>
            `<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#2E2438;">${p}</p>`
        )
        .join('\n')}
      <p style="margin:0 0 8px;">${botao(url, 'Voltar de onde parei')}</p>
    `),
    texto: [...paragrafos, '', url].join('\n\n'),
  });
}

/**
 * O resumo que a Sentinela manda pro admin — docs/reestruturacao.md §5:
 * anomalia crítica/alta merece e-mail, não só uma linha num painel que
 * ninguém está olhando às 3 da manhã.
 *
 * Chamado só quando `alarmes.ts` decide que HÁ algo pra reportar — este
 * módulo não decide isso, só formata e envia.
 */
export async function enviarResumoDeAlarmes(params: {
  destino: string;
  anomaliasCriticas: { entidadeTipo: string; entidadeId: string; esperado: string; encontrado: string }[];
  anomaliasAltas: { entidadeTipo: string; entidadeId: string; esperado: string; encontrado: string }[];
  pedidosTravados: number;
  capiFalhouDefinitivo: number;
}): Promise<void> {
  const { destino, anomaliasCriticas, anomaliasAltas, pedidosTravados, capiFalhouDefinitivo } = params;

  const linhaAnomalia = (a: { entidadeTipo: string; entidadeId: string; esperado: string; encontrado: string }) =>
    `<li style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:13px;color:#3A2F44;">
       <strong>${a.entidadeTipo}:${a.entidadeId}</strong><br/>
       esperado: ${a.esperado}<br/>
       encontrado: ${a.encontrado}
     </li>`;

  const secao = (titulo: string, itens: typeof anomaliasCriticas) =>
    itens.length === 0
      ? ''
      : `<p style="margin:20px 0 6px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6B5F72;">${titulo}</p>
         <ul style="margin:0;padding-left:18px;">${itens.map(linhaAnomalia).join('')}</ul>`;

  const html = moldura(`
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5F72;">Sentinela</p>
    <p style="margin:0 0 18px;font-size:22px;font-style:italic;color:#2E2438;">Tem coisa pra olhar</p>
    ${secao('Crítico', anomaliasCriticas)}
    ${secao('Alto', anomaliasAltas)}
    ${
      pedidosTravados > 0
        ? `<p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#3A2F44;">${pedidosTravados} pedido(s) travado(s) (pago/gerando/erro) — <code>npm run reprocessar</code>.</p>`
        : ''
    }
    ${
      capiFalhouDefinitivo > 0
        ? `<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#3A2F44;">${capiFalhouDefinitivo} evento(s) do Pixel desistiram de vez — <code>scripts/backfill-pixel.ts</code> manual.</p>`
        : ''
    }
    <p style="margin:24px 0 0;">${botao(`${base()}/painel`, 'Abrir o painel')}</p>
  `);

  const texto = [
    'Sentinela — tem coisa pra olhar',
    '',
    anomaliasCriticas.length > 0
      ? `CRÍTICO (${anomaliasCriticas.length}):\n` +
        anomaliasCriticas
          .map((a) => `- ${a.entidadeTipo}:${a.entidadeId} — esperado ${a.esperado}; encontrado ${a.encontrado}`)
          .join('\n')
      : '',
    anomaliasAltas.length > 0
      ? `ALTO (${anomaliasAltas.length}):\n` +
        anomaliasAltas
          .map((a) => `- ${a.entidadeTipo}:${a.entidadeId} — esperado ${a.esperado}; encontrado ${a.encontrado}`)
          .join('\n')
      : '',
    pedidosTravados > 0 ? `${pedidosTravados} pedido(s) travado(s) — npm run reprocessar` : '',
    capiFalhouDefinitivo > 0 ? `${capiFalhouDefinitivo} evento(s) do CAPI desistiram — backfill manual` : '',
    '',
    `${base()}/painel`,
  ]
    .filter(Boolean)
    .join('\n\n');

  await enviar({
    para: destino,
    assunto: `[Bruxário] ${anomaliasCriticas.length > 0 ? '🔴' : '⚠️'} ${
      anomaliasCriticas.length + anomaliasAltas.length
    } alarme(s) aberto(s)`,
    html,
    texto,
  });
}
