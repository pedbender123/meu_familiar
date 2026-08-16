'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { evento } from '@/lib/pixel';

export function HoroscopoForm() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !dataNascimento) return;
    setCarregando(true);
    setErro('');
    try {
      const resposta = await fetch('/api/horoscopo/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), data_nascimento: dataNascimento }),
      });
      const dados = await resposta.json();
      if (!resposta.ok || !dados.id) {
        setErro('Algo deu errado. Tente de novo.');
        setCarregando(false);
        return;
      }
      evento('Lead');
      router.push(`/horoscopo/pagamento/${dados.id}`);
    } catch {
      setErro('Algo deu errado. Tente de novo.');
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="w-full flex flex-col gap-4">
      <input
        type="text"
        placeholder="Seu nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoComplete="name"
        required
        className="w-full bg-pergaminho/5 border border-pergaminho/20 rounded-xl px-4 py-3 font-corpo text-pergaminho placeholder:text-pergaminho/40 outline-none focus:border-vela/60"
      />
      <input
        type="date"
        value={dataNascimento}
        onChange={(e) => setDataNascimento(e.target.value)}
        autoComplete="bday"
        required
        className="w-full bg-pergaminho/5 border border-pergaminho/20 rounded-xl px-4 py-3 font-corpo text-pergaminho outline-none focus:border-vela/60"
      />
      {erro && <p className="font-corpo text-sm text-red-300">{erro}</p>}
      <button
        type="submit"
        disabled={carregando}
        className="w-full bg-vela text-tinta font-corpo font-medium px-6 py-3 rounded-full hover:brightness-110 transition disabled:opacity-60"
      >
        {carregando ? 'Consultando os astros...' : 'Revelar meu horóscopo'}
      </button>
    </form>
  );
}
