'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { CirculoMagico } from '@/components/CirculoMagico';

const MENSAGENS = [
  'Seu familiar está atravessando o véu...',
  'As sombras se organizam ao redor do seu nome...',
  'A lua confere seus signos em silêncio...',
  'Faltam poucos passos para o encontro...',
];

export default function Obrigado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [mensagemIndice, setMensagemIndice] = useState(0);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const rotacao = setInterval(() => {
      setMensagemIndice((i) => (i + 1) % MENSAGENS.length);
    }, 3200);
    return () => clearInterval(rotacao);
  }, []);

  useEffect(() => {
    let ativo = true;
    const poll = setInterval(async () => {
      try {
        const resposta = await fetch(`/api/pedido/${id}`);
        const dados = await resposta.json();
        if (!ativo) return;
        if (dados.status === 'entregue') {
          clearInterval(poll);
          router.push(`/revelacao/${id}`);
        } else if (dados.status === 'erro') {
          setErro(true);
        }
      } catch {
        // silencioso — tenta de novo no próximo ciclo
      }
    }, 2000);
    return () => {
      ativo = false;
      clearInterval(poll);
    };
  }, [id, router]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-8 text-center">
      <CirculoMagico />
      <h1 className="font-display italic text-2xl text-pergaminho max-w-sm">
        {erro
          ? 'O véu está denso esta noite — atualize esta página em instantes.'
          : MENSAGENS[mensagemIndice]}
      </h1>
      {!erro && (
        <p className="font-corpo font-light text-sm text-pergaminho/60">
          Isso pode levar um minuto. Não feche esta página.
        </p>
      )}
    </main>
  );
}
