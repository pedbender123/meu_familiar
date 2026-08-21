import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { salvarContato, type AssuntoDeContato } from '@/lib/db';
import { avisarContatoRecebido, confirmarContato } from '@/lib/email';
import { emailDoAdmin } from '@/lib/autenticacao';
import { validarEmail, validarNome } from '@/lib/validacao';
import { excedeuLimite } from '@/lib/rate-limit';

const ASSUNTOS: AssuntoDeContato[] = [
  'duvida',
  'problema',
  'reembolso',
  'dados',
  'outro',
];

/**
 * Recebe um contato.
 *
 * É o canal que a LGPD exige (art. 41) e o que a Política de Privacidade
 * aponta como caminho para exercer direitos — acesso, correção, eliminação.
 *
 * **Grava antes de tentar enviar e-mail.** Se o Resend estiver fora do ar, a
 * mensagem não pode se perder: ela fica no painel de qualquer jeito. Falha de
 * notificação é inconveniente; perder o pedido de alguém sobre os próprios
 * dados é falha de obrigação legal.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`contato:${ip}`)) {
    return NextResponse.json(
      { erro: 'Muitas mensagens. Aguarde um instante.' },
      { status: 429 }
    );
  }

  const corpo = await req.json().catch(() => ({}));
  const { nome, email, assunto, mensagem, pedidoId } = corpo ?? {};

  if (!validarNome(nome)) {
    return NextResponse.json({ erro: 'Diga seu nome.' }, { status: 400 });
  }
  if (!validarEmail(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }
  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length < 10) {
    return NextResponse.json(
      { erro: 'Escreva um pouco mais para a gente entender.' },
      { status: 400 }
    );
  }

  const assuntoValido: AssuntoDeContato = ASSUNTOS.includes(assunto)
    ? assunto
    : 'outro';

  const id = uuidv4();
  salvarContato({
    id,
    nome: nome.trim().slice(0, 60),
    email: email.trim().toLowerCase(),
    assunto: assuntoValido,
    mensagem: mensagem.trim().slice(0, 4000),
    pedidoId: typeof pedidoId === 'string' && pedidoId.trim() ? pedidoId.trim() : null,
  });

  // Os dois e-mails são acessórios: a mensagem já está guardada.
  const destino = emailDoAdmin();
  if (destino) {
    try {
      await avisarContatoRecebido({
        destino,
        nome: nome.trim(),
        emailDeQuemEscreveu: email.trim(),
        assunto: assuntoValido,
        mensagem: mensagem.trim().slice(0, 4000),
        pedidoId: pedidoId ?? null,
      });
    } catch (erro) {
      console.error('[contato] falha ao avisar o dono:', erro);
    }
  }

  try {
    await confirmarContato({ nome: nome.trim(), email: email.trim() });
  } catch (erro) {
    console.error('[contato] falha ao confirmar para quem escreveu:', erro);
  }

  return NextResponse.json({ ok: true });
}
