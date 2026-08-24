'use client';

import { useEffect, useState } from 'react';
import { Flame, Copy, Check, Lock } from 'lucide-react';
import { utmsDaSessao } from './utms';
import { marcar } from '@/lib/marcar';

/**
 * Pix e cartão pela Wiven, dentro da nossa tela.
 *
 * ── Por que um formulário nosso, e não o checkout deles ───────────────────
 *
 * A Wiven tem checkout hospedado (`order.url`), e usá-lo seria menos
 * trabalho. O SPEC 10.3 pede o contrário de propósito: mandar alguém do meio
 * de um ritual de vela e lua para uma tela de fintech e voltar quebra a
 * ambientação que o funil passou treze minutos construindo. Foi o motivo de o
 * Asaas ter saído, e não é para voltar por outra porta.
 *
 * ── O cartão, e o cuidado que ele exige ───────────────────────────────────
 *
 * Diferente do Brick do Mercado Pago, aqui **não há tokenização**: a Wiven
 * recebe número e CVV em texto no corpo. Então este componente segura os
 * campos em estado de React, monta o corpo e envia — e nada disso é gravado
 * em `localStorage`, `sessionStorage` ou cookie. O estado morre com a aba.
 *
 * `autoComplete="cc-number"` fica: é o gerenciador do próprio navegador, que
 * a pessoa já usa, e recusá-lo faria ela digitar dezesseis dígitos à mão.
 *
 * ── Por que os campos aparecem em etapas ──────────────────────────────────
 *
 * O cartão da Wiven exige treze campos: quatro do cartão, dois de contato e
 * sete de endereço. Numa compra de impulso de R$ 9,80, mostrar isso de uma
 * vez é um muro — e o funil já perde 13 pessoas para 2 nesse degrau.
 *
 * Então: quatro campos na tela. Quando eles estão preenchidos, aparecem os
 * dois seguintes. Depois, o CEP — e o CEP preenche estado, cidade, bairro e
 * rua sozinho, deixando só o número para digitar. Treze campos viram seis.
 */

interface PixGerado {
  copiaECola: string;
  qrBase64: string;
  qrUrl?: string;
}

type Endereco = {
  zipCode: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  complement: string;
};

const ENDERECO_VAZIO: Endereco = {
  zipCode: '',
  state: '',
  city: '',
  neighborhood: '',
  street: '',
  number: '',
  complement: '',
};

const so = (v: string) => v.replace(/\D/g, '');

export function CheckoutWiven({
  pedidoId,
  meio,
  valorEmReais,
  nome,
  cpf,
  itens,
  destino,
}: {
  pedidoId: string;
  meio: 'pix' | 'cartao';
  valorEmReais: number;
  nome: string;
  cpf: string | null;
  itens?: string[];
  destino?: string;
}) {
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState(cpf ?? '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [recusado, setRecusado] = useState('');
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Cartão — vive só aqui, e só enquanto a aba estiver aberta.
  const [numero, setNumero] = useState('');
  const [titular, setTitular] = useState('');
  const [validade, setValidade] = useState('');
  const [cvv, setCvv] = useState('');
  const [endereco, setEndereco] = useState<Endereco>(ENDERECO_VAZIO);
  const [cepBuscando, setCepBuscando] = useState(false);
  const [cepFalhou, setCepFalhou] = useState(false);

  /**
   * Enquanto o Pix está na tela, o pagamento pode confirmar a qualquer
   * momento — e quem confirma é o webhook, não esta aba. O poll é o que
   * transforma "paguei" em "a página andou" sem a pessoa recarregar.
   */
  useEffect(() => {
    if (!pix) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/pedido/${pedidoId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status && d.status !== 'aguardando_pagamento') {
          window.location.href = destino ?? `/obrigado/${pedidoId}`;
        }
      } catch {
        // Rede oscilando não é motivo para parar de tentar.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [pix, pedidoId, destino]);

  /* ── as etapas do cartão ─────────────────────────────────────────────── */

  const cartaoOk = so(numero).length >= 13 && titular.trim().length > 2 && /^\d{2}\/\d{2}$/.test(validade) && so(cvv).length >= 3;
  const contatoOk = so(documento).length === 11 && so(telefone).length >= 10;
  const enderecoOk =
    so(endereco.zipCode).length === 8 &&
    !!endereco.state &&
    !!endereco.city &&
    !!endereco.street &&
    !!endereco.neighborhood &&
    !!endereco.number.trim();

  /**
   * O CEP preenche o resto.
   *
   * Quatro campos que a pessoa não digita são quatro chances a menos de
   * desistir. Se a consulta falhar — serviço fora, CEP novo demais — os
   * campos aparecem para preenchimento à mão em vez de travar a compra:
   * gateway de terceiro indisponível não pode virar venda perdida.
   */
  async function buscarCep(bruto: string) {
    const cep = so(bruto);
    setEndereco((e) => ({ ...e, zipCode: bruto }));
    if (cep.length !== 8) return;

    setCepBuscando(true);
    setCepFalhou(false);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) throw new Error('cep inexistente');
      setEndereco((e) => ({
        ...e,
        state: d.uf ?? '',
        city: d.localidade ?? '',
        neighborhood: d.bairro ?? '',
        street: d.logradouro ?? '',
      }));
    } catch {
      setCepFalhou(true);
    }
    setCepBuscando(false);
  }

  /* ── o envio ─────────────────────────────────────────────────────────── */

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setRecusado('');

    if (so(telefone).length < 10) {
      setErro('Confira o telefone — precisa do DDD.');
      return;
    }
    if (so(documento).length !== 11) {
      setErro('Confira o CPF.');
      return;
    }

    setEnviando(true);
    marcar('pagamento_tentado');

    try {
      const resposta = await fetch(`/api/pedido/${pedidoId}/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utm: utmsDaSessao(),
          wiven: {
            meio,
            nome,
            telefone,
            documento,
            ...(meio === 'cartao'
              ? {
                  cartao: {
                    number: so(numero),
                    owner: titular.trim(),
                    // A Wiven quer `YYYY-MM`; ninguém digita ano de quatro
                    // dígitos num cartão, então a conversão é aqui.
                    expiresAt: `20${validade.slice(3, 5)}-${validade.slice(0, 2)}`,
                    cvv: so(cvv),
                  },
                  endereco: {
                    country: 'BR',
                    zipCode: so(endereco.zipCode),
                    state: endereco.state,
                    city: endereco.city,
                    neighborhood: endereco.neighborhood,
                    street: endereco.street,
                    number: endereco.number.trim(),
                    ...(endereco.complement.trim()
                      ? { complement: endereco.complement.trim() }
                      : {}),
                  },
                }
              : {}),
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

      if (meio === 'pix') {
        if (!dados.pix?.copiaECola) {
          setErro('O Pix não veio. Tente novamente em instantes.');
          setEnviando(false);
          return;
        }
        setPix(dados.pix);
        setEnviando(false);
        return;
      }

      /**
       * Cartão. `pending` aqui costuma ser o antifraude segurando
       * (`ACQUIRER_ANTIFRAUD_REPROVED`) — não é recusa, e mandar a pessoa
       * digitar outro cartão nesse caso seria cobrar duas vezes.
       */
      if (dados.status === 'pending') {
        window.location.href = destino ?? `/obrigado/${pedidoId}`;
        return;
      }

      setRecusado(
        dados.statusDetalhe
          ? 'O cartão não passou. Confira os dados ou tente outro.'
          : 'O cartão não passou. Tente outro.'
      );
      setEnviando(false);
    } catch {
      setErro('O véu está denso esta noite. Tente novamente em instantes.');
      setEnviando(false);
    }
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

  /* ── o Pix na tela ───────────────────────────────────────────────────── */

  if (pix) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-5 text-center">
        <p className="font-corpo text-[13px] text-pergaminho/70 leading-relaxed max-w-[34ch]">
          Abra o aplicativo do seu banco e pague. A revelação começa sozinha
          assim que o pagamento cair.
        </p>

        {/*
          A Wiven **deprecou o base64** — o campo volta sempre vazio e quem
          desenha o QR é a URL de `image`. O base64 continua sendo tentado
          primeiro porque Mercado Pago e Cakto ainda mandam assim, e este
          bloco é o mesmo em todos os checkouts.
        */}
        {pix.qrBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${pix.qrBase64}`}
            alt="QR Code do Pix"
            className="w-52 h-52 rounded-2xl bg-white p-2"
          />
        ) : pix.qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pix.qrUrl}
            alt="QR Code do Pix"
            className="w-52 h-52 rounded-2xl bg-white p-2"
          />
        ) : null}

        <button
          type="button"
          onClick={copiar}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-vela/35 bg-vela/15 px-4 py-3 font-corpo text-[13px] text-pergaminho"
        >
          {copiado ? <Check size={15} strokeWidth={1.5} /> : <Copy size={15} strokeWidth={1.5} />}
          {copiado ? 'Copiado' : 'Copiar o código Pix'}
        </button>

        <p className="font-mono text-[10px] text-pergaminho/40 break-all leading-relaxed">
          {pix.copiaECola}
        </p>
        {erro && <Erro texto={erro} />}
      </div>
    );
  }

  /* ── o formulário ────────────────────────────────────────────────────── */

  return (
    <form onSubmit={pagar} className="w-full max-w-md flex flex-col gap-5">
      {itens && itens.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-2xl border border-pergaminho/12 px-5 py-4">
          {itens.map((i) => (
            <li
              key={i}
              className="font-corpo font-light text-[13px] text-pergaminho/70 leading-snug flex gap-2"
            >
              <span className="text-vela/70 shrink-0">·</span>
              {i}
            </li>
          ))}
        </ul>
      )}

      {meio === 'cartao' && (
        <>
          <Etapa visivel>
            <Campo
              rotulo="Número do cartão"
              valor={numero}
              aoMudar={setNumero}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
            />
            <Campo
              rotulo="Nome como está no cartão"
              valor={titular}
              aoMudar={setTitular}
              autoComplete="cc-name"
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                rotulo="Validade"
                valor={validade}
                aoMudar={(v) => {
                  const d = so(v).slice(0, 4);
                  setValidade(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                }}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
              />
              <Campo
                rotulo="CVV"
                valor={cvv}
                aoMudar={(v) => setCvv(so(v).slice(0, 4))}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="000"
              />
            </div>
          </Etapa>

          <Etapa visivel={cartaoOk}>
            <Campo
              rotulo="CPF"
              valor={documento}
              aoMudar={setDocumento}
              inputMode="numeric"
              placeholder="000.000.000-00"
            />
            <Campo
              rotulo="Telefone com DDD"
              valor={telefone}
              aoMudar={setTelefone}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(00) 00000-0000"
            />
          </Etapa>

          <Etapa visivel={cartaoOk && contatoOk}>
            <Campo
              rotulo="CEP"
              valor={endereco.zipCode}
              aoMudar={buscarCep}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              dica={
                cepBuscando
                  ? 'procurando…'
                  : endereco.city
                    ? `${endereco.street}, ${endereco.neighborhood} — ${endereco.city}/${endereco.state}`
                    : undefined
              }
            />

            {/* O CEP falhou: os campos aparecem para preencher à mão, em vez
                de travar a compra num serviço de terceiro que caiu. */}
            {cepFalhou && (
              <>
                <Campo rotulo="Rua" valor={endereco.street} aoMudar={(v) => setEndereco((e) => ({ ...e, street: v }))} />
                <Campo rotulo="Bairro" valor={endereco.neighborhood} aoMudar={(v) => setEndereco((e) => ({ ...e, neighborhood: v }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Cidade" valor={endereco.city} aoMudar={(v) => setEndereco((e) => ({ ...e, city: v }))} />
                  <Campo rotulo="UF" valor={endereco.state} aoMudar={(v) => setEndereco((e) => ({ ...e, state: v.toUpperCase().slice(0, 2) }))} />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Número" valor={endereco.number} aoMudar={(v) => setEndereco((e) => ({ ...e, number: v }))} inputMode="numeric" />
              <Campo rotulo="Complemento" valor={endereco.complement} aoMudar={(v) => setEndereco((e) => ({ ...e, complement: v }))} opcional />
            </div>
          </Etapa>
        </>
      )}

      {meio === 'pix' && (
        <Etapa visivel>
          <Campo
            rotulo="CPF"
            valor={documento}
            aoMudar={setDocumento}
            inputMode="numeric"
            placeholder="000.000.000-00"
          />
          <Campo
            rotulo="Telefone com DDD"
            valor={telefone}
            aoMudar={setTelefone}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
          />
        </Etapa>
      )}

      {recusado && <Erro texto={recusado} />}
      {erro && <Erro texto={erro} />}

      <button
        type="submit"
        disabled={enviando || (meio === 'cartao' ? !(cartaoOk && contatoOk && enderecoOk) : !contatoOk)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-vela/35 bg-vela/15 px-4 py-4 font-corpo text-[14px] text-pergaminho disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Flame size={16} strokeWidth={1.5} className="text-vela" />
        {enviando
          ? 'Acendendo…'
          : meio === 'pix'
            ? `Gerar o Pix de R$ ${valorEmReais.toFixed(2).replace('.', ',')}`
            : `Pagar R$ ${valorEmReais.toFixed(2).replace('.', ',')}`}
      </button>

      <p className="flex items-center justify-center gap-1.5 font-corpo text-[11px] text-pergaminho/45">
        <Lock size={11} strokeWidth={1.5} />
        Pagamento criptografado. Não guardamos os dados do seu cartão.
      </p>
    </form>
  );
}

/**
 * Uma etapa do formulário.
 *
 * Fica fora do DOM até a anterior estar completa — e não apenas escondida:
 * campo invisível ainda é campo tabulável, e o leitor de tela anunciaria
 * treze campos onde a tela mostra quatro.
 */
function Etapa({ visivel = false, children }: { visivel?: boolean; children: React.ReactNode }) {
  if (!visivel) return null;
  return <div className="painel-do-checkout flex flex-col gap-3">{children}</div>;
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  inputMode,
  autoComplete,
  opcional,
  dica,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'tel' | 'text';
  autoComplete?: string;
  opcional?: boolean;
  dica?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-corpo text-[11px] text-pergaminho/55">
        {rotulo}
        {opcional && <span className="text-pergaminho/30"> · opcional</span>}
      </span>
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="rounded-xl border border-pergaminho/15 bg-pergaminho/[0.04] px-4 py-3 font-corpo text-[14px] text-pergaminho placeholder:text-pergaminho/25 outline-none focus:border-vela/45"
      />
      {dica && <span className="font-corpo text-[11px] text-pergaminho/45">{dica}</span>}
    </label>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-3 font-corpo text-[12px] text-red-300/85 leading-relaxed">
      {texto}
    </p>
  );
}
