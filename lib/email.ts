import { Resend } from 'resend';

export async function enviarEmailRevelacao(params: {
  nome: string;
  email: string;
  pedidoId: string;
}) {
  const { nome, email, pedidoId } = params;
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const url = `${base}/revelacao/${pedidoId}`;
  const urlPdf = `${base}/api/storage/${pedidoId}/revelacao.pdf`;
  const assunto = `${nome}, seu familiar atravessou o véu`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[email stub] RESEND_API_KEY ausente — e-mail não enviado. Assunto: "${assunto}" · destinatário: ${email} · link: ${url} · pdf: ${urlPdf}`
    );
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: 'familiar@bruxario.com.br',
    to: email,
    subject: assunto,
    html: `
      <div style="background:#171225;color:#EAE0CC;padding:32px;font-family:sans-serif;">
        <p>${nome},</p>
        <p>Seu familiar atravessou o véu e está esperando por você.</p>
        <p><a href="${url}" style="color:#D9A441;">Ver minha revelação</a></p>
        <p><a href="${urlPdf}" style="color:#7B6394;font-size:13px;">Baixar meu grimório em PDF</a></p>
        <p style="opacity:0.6;font-size:12px;margin-top:24px;">
          O Bruxário é entretenimento e autoconhecimento simbólico. As leituras são
          geradas com auxílio de inteligência artificial e não substituem
          orientação profissional de nenhuma natureza.
        </p>
      </div>
    `,
  });
}
