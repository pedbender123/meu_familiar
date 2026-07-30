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

function remetente(): string {
  return process.env.EMAIL_REMETENTE || 'Bruxário <onboarding@resend.dev>';
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
  const { error } = await resend.emails.send({
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

function botao(url: string, texto: string): string {
  return `<a href="${url}" style="display:inline-block;background:${CORES.vela};color:${CORES.tinta};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:13px 26px;border-radius:999px;">${texto}</a>`;
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

  const url = `${base()}/revelacao/${pedidoId}`;
  const produto = produtoDe(produtoId);

  const dias = expiraEm ? Math.max(0, diasRestantes(expiraEm)) : null;
  const avisoPrazo =
    dias === null
      ? ''
      : `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B4E1E;background:rgba(217,164,65,0.16);border-radius:6px;padding:12px 14px;">
           <strong>Seu link fica no ar por ${produto.diasDeAcesso} dias</strong> —
           até ${new Date(expiraEm!).toLocaleDateString('pt-BR')}. O PDF em anexo é
           seu para sempre, guarde este e-mail. Se quiser que o link nunca expire,
           dá para fazer isso por R$ ${precoFormatado(PRODUTOS.link_permanente)}.
         </p>`;

  const anexos: Anexo[] = [];
  const caminhoPdf = path.join(pastaDoPedido(pedidoId), 'revelacao.pdf');
  if (fs.existsSync(caminhoPdf)) {
    anexos.push({
      filename: `bruxario-${nomeFamiliar.toLowerCase().replace(/\s+/g, '-')}.pdf`,
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
    <p style="margin:0 0 8px;">${botao(url, 'Ver minha revelação')}</p>
  `);

  const texto = [
    `${nome}, seu familiar é ${nomeFamiliar} · ${nomeSecreto}.`,
    dias === null
      ? ''
      : `Seu link fica no ar até ${new Date(expiraEm!).toLocaleDateString('pt-BR')}. O PDF em anexo é seu para sempre.`,
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
