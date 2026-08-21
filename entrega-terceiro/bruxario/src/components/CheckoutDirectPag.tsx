'use client';

import { useState } from 'react';

/**
 * O checkout — formulário próprio, Pix e boleto.
 *
 * ── Por que o formulário é nosso ──────────────────────────────────────────
 *
 * O DirectPag não tem SDK de navegador nem campo hospedado: a API recebe os
 * dados direto. Para Pix e boleto isso é irrelevante — o que se pede é nome,
 * e-mail, telefone e CPF, e nada disso é dado de cartão.
 *
 * ── Cartão está desligado, e é de propósito ───────────────────────────────
 *
 * A API aceita o número do cartão em texto (`card.number`), sem tokenização.
 * Isso faz o número passar pelo nosso servidor, o que move a operação de SAQ A
 * para SAQ D no PCI-DSS — outra categoria de responsabilidade, e um vazamento
 * nosso viraria vazamento de cartão.
 *
 * Habilitar é uma linha em `METODOS_HABILITADOS`
 * (`src/nucleo/checkouts/directpag.ts`), e é uma decisão que merece ser tomada
 * de propósito depois de ler a nota lá.
 *
 * ── O CPF é obrigatório ───────────────────────────────────────────────────
 *
 * `customer.document` é exigido pelo DirectPag em toda transação. Não há como
 * contornar pelo lado da API — se ele sair do formulário, a cobrança falha.
 */
export function CheckoutDirectPag({
  pedidoId,
  destino,
  valorEmReais,
  nomeProduto,
  emailDoPedido,
  nomeDoPedido,
}: {
  pedidoId: string;
  destino: string;
  valorEmReais: number;
  nomeProduto: string;
  emailDoPedido?: string;
  nomeDoPedido?: string;
}) {
  const [metodo, setMetodo] = useState<'pix' | 'billet'>('pix');
  const [nome, setNome] = useState(nomeDoPedido ?? '');
  const [email, setEmail] = useState(emailDoPedido ?? '');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState<{ copiaECola: string; qrBase64: string } | null>(null);
  const [boleto, setBoleto] = useState<string | null>(null);

  const completo =
    nome.trim().length > 2 &&
    email.includes('@') &&
    telefone.replace(/\D/g, '').length >= 10 &&
    documento.replace(/\D/g, '').length >= 11;

  async function pagar() {
    if (!completo || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      const r = await fetch(`/api/pedido/${pedidoId}/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metodo,
          pagador: { nome, email, telefone, documento },
        }),
      });
      const d = await r.json();

      if (!r.ok) {
        setErro(d.erro ?? 'Não consegui abrir o pagamento. Tente de novo.');
        setEnviando(false);
        return;
      }

      // Aprovado na hora (raro em Pix, comum no modo de teste).
      if (d.redirect) {
        window.location.assign(d.redirect);
        return;
      }
      if (d.pix) setPix(d.pix);
      if (d.boleto?.url) setBoleto(d.boleto.url);
      setEnviando(false);
    } catch {
      setErro('O véu está denso. Tente de novo em instantes.');
      setEnviando(false);
    }
  }

  if (pix) {
    return (
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <p className="font-display italic text-xl text-pergaminho">
          Escaneie para pagar
        </p>
        {pix.qrBase64 && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={pix.qrBase64.startsWith('data:') ? pix.qrBase64 : `data:image/png;base64,${pix.qrBase64}`}
            alt="QR code do Pix"
            className="w-56 h-56 rounded-xl bg-white p-2"
          />
        )}
        <button
          onClick={() => navigator.clipboard?.writeText(pix.copiaECola)}
          className="font-corpo text-sm px-6 py-3 rounded-full border border-vela/50 text-vela hover:bg-vela/10 transition"
        >
          Copiar o código
        </button>
        <p className="font-corpo text-xs text-pergaminho/45 leading-relaxed max-w-[34ch]">
          Assim que o pagamento cair, a revelação começa a ser escrita e você é
          levada para ela. Pode deixar esta página aberta.
        </p>
        <MonitorDePagamento pedidoId={pedidoId} destino={destino} />
      </div>
    );
  }

  if (boleto) {
    return (
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <p className="font-display italic text-xl text-pergaminho">Boleto gerado</p>
        <a
          href={boleto}
          target="_blank"
          rel="noopener noreferrer"
          className="font-corpo text-sm px-6 py-3 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition"
        >
          Abrir o boleto
        </a>
        <p className="font-corpo text-xs text-pergaminho/45 leading-relaxed max-w-[34ch]">
          A compensação leva até três dias úteis. Quando cair, a revelação
          chega no seu e-mail.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <p className="font-display italic text-xl text-pergaminho">{nomeProduto}</p>
        <p className="font-display text-2xl text-vela">
          {valorEmReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>

      <div className="flex gap-2">
        {(['pix', 'billet'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetodo(m)}
            className={[
              'flex-1 font-corpo text-sm py-2.5 rounded-xl border transition',
              metodo === m
                ? 'border-vela text-vela bg-vela/10'
                : 'border-pergaminho/20 text-pergaminho/60 hover:border-pergaminho/40',
            ].join(' ')}
          >
            {m === 'pix' ? 'Pix' : 'Boleto'}
          </button>
        ))}
      </div>

      <Campo rotulo="Seu nome" valor={nome} onChange={setNome} autoComplete="name" />
      <Campo rotulo="E-mail" valor={email} onChange={setEmail} tipo="email" autoComplete="email" />
      <Campo rotulo="Telefone" valor={telefone} onChange={setTelefone} tipo="tel" autoComplete="tel" />
      <Campo
        rotulo="CPF"
        valor={documento}
        onChange={setDocumento}
        inputMode="numeric"
        nota="Exigido pelo processador de pagamento para emitir a cobrança."
      />

      {erro && <p className="font-corpo text-sm text-red-400 text-center">{erro}</p>}

      <button
        onClick={pagar}
        disabled={!completo || enviando}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-3.5 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {enviando ? 'Abrindo...' : metodo === 'pix' ? 'Gerar o Pix' : 'Gerar o boleto'}
      </button>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  tipo = 'text',
  nota,
  ...resto
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  nota?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-corpo text-[0.62rem] tracking-[0.18em] uppercase text-pergaminho/40">
        {rotulo}
      </span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border border-pergaminho/20 rounded-xl px-4 py-3 font-corpo text-sm text-pergaminho placeholder:text-pergaminho/30 focus:border-vela outline-none"
        {...resto}
      />
      {nota && (
        <span className="font-corpo text-[11px] text-pergaminho/35 leading-relaxed">
          {nota}
        </span>
      )}
    </label>
  );
}

/**
 * Espera o pagamento cair.
 *
 * **Quem libera a entrega é o webhook, nunca esta tela.** Ela só pergunta o
 * status e redireciona quando o servidor já decidiu — assim uma resposta
 * forjada no navegador não entrega nada.
 */
function MonitorDePagamento({ pedidoId, destino }: { pedidoId: string; destino: string }) {
  const [tentativas, setTentativas] = useState(0);

  useState(() => {
    const t = setInterval(async () => {
      setTentativas((n) => n + 1);
      try {
        const r = await fetch(`/api/pedido/${pedidoId}`);
        const d = await r.json();
        if (d.status && d.status !== 'aguardando_pagamento') {
          clearInterval(t);
          window.location.assign(destino);
        }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 4000);
    return () => clearInterval(t);
  });

  return tentativas > 90 ? (
    <p className="font-corpo text-[11px] text-pergaminho/35">
      Ainda esperando o pagamento cair. Se já pagou, o e-mail chega assim que
      o banco confirmar.
    </p>
  ) : null;
}
