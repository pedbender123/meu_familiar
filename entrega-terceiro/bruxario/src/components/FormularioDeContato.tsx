'use client';

import { useState } from 'react';

/**
 * O canal de contato.
 *
 * O campo de **assunto** existe por dois motivos práticos: separa "quero meu
 * dinheiro de volta" de "quero apagar meus dados" na hora de priorizar, e o
 * segundo tem prazo legal para responder (LGPD, art. 18). Sem a etiqueta, os
 * dois viram a mesma pilha.
 *
 * O campo de **pedido** é opcional e vem preenchido quando a pessoa chega de
 * uma revelação — poupa ela de procurar um identificador que não decorou.
 */
const ASSUNTOS = [
  { valor: 'duvida', rotulo: 'Uma dúvida' },
  { valor: 'problema', rotulo: 'Algo deu errado' },
  { valor: 'reembolso', rotulo: 'Quero reembolso' },
  { valor: 'dados', rotulo: 'Meus dados pessoais' },
  { valor: 'outro', rotulo: 'Outro assunto' },
];

export function FormularioDeContato({
  pedidoInicial,
  assuntoInicial,
}: {
  pedidoInicial: string;
  assuntoInicial: string;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [assunto, setAssunto] = useState(assuntoInicial);
  const [mensagem, setMensagem] = useState('');
  const [pedidoId, setPedidoId] = useState(pedidoInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar() {
    setErro('');
    setEnviando(true);
    try {
      const r = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, assunto, mensagem, pedidoId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'Não conseguimos enviar agora. Tente de novo.');
        setEnviando(false);
        return;
      }
      setEnviado(true);
    } catch {
      setErro('Não conseguimos enviar agora. Tente de novo.');
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 text-center py-4">
        <p className="font-display italic text-xl text-escrita max-w-[30ch]">
          Chegou. Vamos responder neste mesmo e-mail.
        </p>
        <p className="font-corpo font-light text-sm text-escrita-fraca max-w-[34ch]">
          Mandamos uma confirmação para {email}.
        </p>
      </div>
    );
  }

  const entrada =
    'bg-transparent border border-escrita/25 rounded-xl px-4 py-3 text-escrita placeholder:text-escrita-fraca/60 focus:border-ouro-velho outline-none font-corpo text-sm w-full';

  return (
    <div className="flex flex-col gap-3 self-stretch max-w-md mx-auto w-full">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Seu nome"
        maxLength={60}
        className={entrada}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Seu e-mail"
        className={entrada}
      />

      <select
        value={assunto}
        onChange={(e) => setAssunto(e.target.value)}
        aria-label="Assunto"
        className={`${entrada} appearance-none cursor-pointer`}
        style={{ colorScheme: 'light' }}
      >
        {ASSUNTOS.map((a) => (
          <option key={a.valor} value={a.valor}>
            {a.rotulo}
          </option>
        ))}
      </select>

      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value.slice(0, 4000))}
        rows={5}
        placeholder="O que aconteceu?"
        className={`${entrada} resize-none`}
      />

      <input
        value={pedidoId}
        onChange={(e) => setPedidoId(e.target.value)}
        placeholder="Número do pedido (se souber)"
        className={entrada}
      />

      {erro && <p className="font-corpo text-sm text-center text-red-700">{erro}</p>}

      <button
        onClick={enviar}
        disabled={enviando || !nome.trim() || !email.trim() || mensagem.trim().length < 10}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {enviando ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  );
}
