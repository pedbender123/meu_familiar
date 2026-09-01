'use client';

import { useState, useEffect } from 'react';
import { Flame, Copy, Check } from 'lucide-react';
import { utmsDaSessao } from './utms';

/**
 * Pix pela Cakto.
 *
 * ── Por que um componente nosso, e não o checkout deles ───────────────────
 *
 * A Cakto tem um checkout hospedado (`checkoutUrl`), e usá-lo seria menos
 * trabalho. Mas o SPEC 10.3 pede o contrário de propósito: "mandar alguém do
 * meio de um ritual de vela e lua para uma tela laranja e voltar" quebra a
 * ambientação que o funil inteiro passou treze minutos construindo. Foi o
 * motivo de o Asaas ter saído, e não é para voltar por outra porta.
 *
 * ── Por que o Pix não precisa do SDK deles ────────────────────────────────
 *
 * O SDK da Cakto existe para três coisas — tokenizar cartão, rodar 3DS e
 * coletar antifraude — e **nenhuma delas se aplica ao Pix**. O único campo do
 * SDK que a cobrança Pix exige é o `fingerprint`, e a especificação dele é
 * "identificador estável do dispositivo/sessão": um id nosso, guardado no
 * navegador, satisfaz isso sem carregar script de terceiro.
 *
 * É o que permite o Pix entrar hoje e o cartão esperar o SDK ser testado
 * com calma.
 */

/** O que a Cakto pede como `customer.fingerprint`: estável por dispositivo. */
function fingerprintDoDispositivo(): string {
  const CHAVE = 'bruxario:fp';
  try {
    const guardado = localStorage.getItem(CHAVE);
    if (guardado) return guardado;
    const novo = `fp_${crypto.randomUUID()}`;
    localStorage.setItem(CHAVE, novo);
    return novo;
  } catch {
    // Navegador com armazenamento bloqueado: um id por sessão ainda serve.
    // Pior que estável, melhor que cobrança recusada por campo vazio.
    return `fp_${crypto.randomUUID()}`;
  }
}

interface PixGerado {
  copiaECola: string;
  qrBase64: string;
}

export function CheckoutCaktoPix({
  pedidoId,
  valorEmReais,
  nome,
  cpf,
  base = 'pedido',
}: {
  pedidoId: string;
  valorEmReais: number;
  nome: string;
  cpf: string | null;
  /**
   * Mesma correção feita no checkout da Wiven, pelo mesmo motivo.
   *
   * Rota fixa em `/api/pedido/...` funciona enquanto só o funil de produtos
   * usa este componente, e quebra com "pedido não encontrado" no dia em que
   * alguém apontar a assinatura para cá. A Cakto não está roteada hoje —
   * consertar agora custa uma linha; descobrir depois custa uma venda na tela
   * de pagar.
   */
  base?: 'pedido' | 'cobranca';
}) {
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState(cpf ?? '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [copiado, setCopiado] = useState(false);

  /**
   * Enquanto o Pix está na tela, o pagamento pode confirmar a qualquer
   * momento — e quem confirma é o webhook, não esta aba. O poll é o que
   * transforma "paguei" em "a página andou" sem a pessoa ter que recarregar.
   */
  useEffect(() => {
    if (!pix) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/${base}/${pedidoId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status && d.status !== 'aguardando_pagamento') {
          window.location.href = `/obrigado/${pedidoId}`;
        }
      } catch {
        // Rede oscilando não é motivo para parar de tentar.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [pix, pedidoId]);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    const digitos = telefone.replace(/\D/g, '');
    if (digitos.length < 10) {
      setErro('Confira o telefone — precisa do DDD.');
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch(`/api/${base}/${pedidoId}/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cakto: {
            metodo: 'pix',
            nome,
            // E.164 sem o `+`, como a Cakto pede. O 55 entra aqui e não no
            // campo: pedir o código do país a quem está comprando no Brasil é
            // um jeito de perder venda por dúvida.
            telefone: digitos.startsWith('55') ? digitos : `55${digitos}`,
            docNumber: documento.replace(/\D/g, '') || undefined,
            docType: 'cpf',
            fingerprint: fingerprintDoDispositivo(),
            utm: utmsDaSessao(),
          },
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro || 'O véu está denso esta noite. Tente novamente.');
        setEnviando(false);
        return;
      }

      if (dados.redirect) {
        window.location.href = dados.redirect;
        return;
      }

      if (!dados.pix?.copiaECola) {
        setErro('O Pix não veio. Tente novamente em instantes.');
        setEnviando(false);
        return;
      }

      setPix(dados.pix);
    } catch {
      setErro('O véu está denso esta noite. Tente novamente em instantes.');
    }
    setEnviando(false);
  }

  async function copiar() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('Não consegui copiar. Selecione o código e copie à mão.');
    }
  }

  if (pix) {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-[#EAE0CC] text-lg mb-1">Falta só o pagamento.</p>
        <p className="text-[#EAE0CC]/60 text-sm mb-6">
          Abra o app do banco, escolha Pix, e cole o código. A revelação começa sozinha.
        </p>

        {pix.qrBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              pix.qrBase64.startsWith('data:')
                ? pix.qrBase64
                : `data:image/png;base64,${pix.qrBase64}`
            }
            alt="QR Code do Pix"
            className="mx-auto mb-6 w-56 h-56 rounded-2xl bg-white p-3"
          />
        ) : null}

        <button
          onClick={copiar}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D9A441] px-6 py-4 font-medium text-[#171225] transition hover:bg-[#C08F33]"
        >
          {copiado ? <Check size={18} /> : <Copy size={18} />}
          {copiado ? 'Código copiado' : 'Copiar código Pix'}
        </button>

        <p className="mt-4 break-all rounded-xl bg-[#EAE0CC]/5 p-3 text-[11px] leading-relaxed text-[#EAE0CC]/40">
          {pix.copiaECola}
        </p>

        <p className="mt-6 text-sm text-[#EAE0CC]/50">
          Assim que o pagamento cair, esta página segue sozinha.
        </p>
        {erro ? <p className="mt-3 text-sm text-red-300">{erro}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={gerar} className="w-full max-w-md">
      <p className="mb-1 text-lg text-[#EAE0CC]">Pagar com Pix</p>
      <p className="mb-6 text-sm text-[#EAE0CC]/60">
        R$ {valorEmReais.toFixed(2).replace('.', ',')} · confirmação na hora
      </p>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm text-[#EAE0CC]/70">Telefone com DDD</span>
        <input
          type="tel"
          inputMode="numeric"
          required
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(11) 90000-0000"
          className="w-full rounded-xl border border-[#EAE0CC]/15 bg-[#EAE0CC]/5 px-4 py-3 text-[#EAE0CC] outline-none focus:border-[#D9A441]"
        />
      </label>

      {!cpf ? (
        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-[#EAE0CC]/70">CPF</span>
          <input
            type="text"
            inputMode="numeric"
            required
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="000.000.000-00"
            className="w-full rounded-xl border border-[#EAE0CC]/15 bg-[#EAE0CC]/5 px-4 py-3 text-[#EAE0CC] outline-none focus:border-[#D9A441]"
          />
        </label>
      ) : null}

      {erro ? <p className="mb-4 text-sm text-red-300">{erro}</p> : null}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D9A441] px-6 py-4 font-medium text-[#171225] transition hover:bg-[#C08F33] disabled:opacity-60"
      >
        <Flame size={18} />
        {enviando ? 'Gerando o Pix…' : 'Gerar código Pix'}
      </button>
    </form>
  );
}
