'use client';

import { useState } from 'react';
import { Chama } from '@/components/Chama';

interface Pergunta {
  numero: number;
  texto: string;
  opcoes: { letra: string; texto: string }[];
}

const QUIZ: Pergunta[] = [
  {
    numero: 1,
    texto: 'A noite cai. Onde a magia te encontra?',
    opcoes: [
      { letra: 'a', texto: 'Na janela de casa, com uma vela acesa' },
      { letra: 'b', texto: 'No meio da mata escura' },
      { letra: 'c', texto: 'No telhado, sob o céu aberto' },
      { letra: 'd', texto: 'Na beira da água parada' },
    ],
  },
  {
    numero: 2,
    texto: 'Seu poder desperta quando...',
    opcoes: [
      { letra: 'a', texto: 'Todos dormem e só você pensa' },
      { letra: 'b', texto: 'Alguém que você ama precisa de você' },
      { letra: 'c', texto: 'Você precisa virar outra pessoa pra sobreviver' },
      { letra: 'd', texto: 'Você cria algo do nada' },
    ],
  },
  {
    numero: 3,
    texto: 'Te confiaram um segredo perigoso. Você...',
    opcoes: [
      { letra: 'a', texto: 'Guarda pra sempre, nem sob tortura' },
      { letra: 'b', texto: 'Transforma em arte, disfarçado' },
      { letra: 'c', texto: 'Usa na hora exata em que for preciso' },
      { letra: 'd', texto: 'Conta só pra lua' },
    ],
  },
  {
    numero: 4,
    texto: 'Qual sensação te chama mais?',
    opcoes: [
      { letra: 'a', texto: 'Calor de vela e lã num dia frio' },
      { letra: 'b', texto: 'Vento gelado no rosto, em pé num lugar alto' },
      { letra: 'c', texto: 'Chuva batendo no telhado' },
      { letra: 'd', texto: 'Silêncio tão fundo que dá pra ouvir o próprio sangue' },
    ],
  },
  {
    numero: 5,
    texto: 'Seu defeito mágico:',
    opcoes: [
      { letra: 'a', texto: 'Desconfio até da minha sombra' },
      { letra: 'b', texto: 'Me sacrifico demais pelos outros' },
      { letra: 'c', texto: 'Mudo tanto que ninguém me acompanha' },
      { letra: 'd', texto: 'Começo dez feitiços e não termino nenhum' },
    ],
  },
  {
    numero: 6,
    texto: 'Escolha um objeto do grimório:',
    opcoes: [
      { letra: 'a', texto: 'Um espelho negro que não reflete você' },
      { letra: 'b', texto: 'Um novelo vermelho que nunca acaba' },
      { letra: 'c', texto: 'Uma chave antiga sem porta conhecida' },
      { letra: 'd', texto: 'Um vidro com água da primeira chuva' },
    ],
  },
  {
    numero: 7,
    texto: 'Como você luta suas batalhas?',
    opcoes: [
      { letra: 'a', texto: 'Em silêncio — quando percebem, já acabou' },
      { letra: 'b', texto: 'De frente, custe o que custar' },
      { letra: 'c', texto: 'Desaparecendo pra vencer depois' },
      { letra: 'd', texto: 'Esperando o momento exato de agir' },
    ],
  },
  {
    numero: 8,
    texto: 'Que lua te encontra acordada?',
    opcoes: [
      { letra: 'a', texto: 'Lua Nova (começos e segredos)' },
      { letra: 'b', texto: 'Lua Crescente (desejo e movimento)' },
      { letra: 'c', texto: 'Lua Cheia (poder e revelação)' },
      { letra: 'd', texto: 'Lua Minguante (corte e descanso)' },
    ],
  },
];

const TOTAL_PASSOS = 12; // 8 perguntas + nome + data + hora + email

type Respostas = Record<number, string>;

export default function Ritual() {
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [horaNascimento, setHoraNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function escolher(letra: string) {
    const pergunta = QUIZ[etapa];
    setRespostas((prev) => ({ ...prev, [pergunta.numero]: letra }));
    setTimeout(() => setEtapa((e) => e + 1), 220);
  }

  function avancar() {
    setErro('');
    setEtapa((e) => e + 1);
  }

  async function enviarRitual() {
    setErro('');
    if (!email.trim()) return setErro('Diga onde a revelação deve te encontrar.');

    setEnviando(true);
    try {
      const resposta = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respostas, nome, dataNascimento, horaNascimento, email }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro || 'O véu está denso esta noite. Tente novamente.');
        setEnviando(false);
        return;
      }
      window.location.href = `/pagamento/${dados.id}`;
    } catch {
      setErro('O véu está denso esta noite. Tente novamente em instantes.');
      setEnviando(false);
    }
  }

  const perguntaAtual = etapa < QUIZ.length ? QUIZ[etapa] : null;
  const passoInfo = etapa - QUIZ.length; // 0=nome, 1=data, 2=hora, 3=email

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-10">
      <Chama progresso={(etapa + 1) / TOTAL_PASSOS} />

      <div className="w-full max-w-md mt-8">
        {perguntaAtual ? (
          <div key={perguntaAtual.numero} className="flex flex-col gap-6 animate-[surgir_0.4s_ease]">
            <p className="text-center text-xs font-corpo tracking-widest text-violeta uppercase">
              Passo {perguntaAtual.numero} de {TOTAL_PASSOS}
            </p>
            <h2 className="text-center font-display italic text-2xl text-pergaminho">
              {perguntaAtual.texto}
            </h2>
            <div className="flex flex-col gap-3">
              {perguntaAtual.opcoes.map((op) => (
                <button
                  key={op.letra}
                  onClick={() => escolher(op.letra)}
                  className="text-left font-corpo font-light border border-pergaminho/20 rounded-xl px-5 py-4 text-pergaminho hover:border-vela hover:bg-vela/5 transition"
                >
                  {op.texto}
                </button>
              ))}
            </div>
          </div>
        ) : passoInfo === 0 ? (
          <div key="nome" className="flex flex-col gap-6 animate-[surgir_0.4s_ease]">
            <p className="text-center text-xs font-corpo tracking-widest text-violeta uppercase">
              Passo 9 de {TOTAL_PASSOS}
            </p>
            <h2 className="text-center font-display italic text-2xl text-pergaminho">
              Diga seu nome, para que ele possa te reconhecer
            </h2>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={40}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && nome.trim() && avancar()}
              className="bg-transparent border border-pergaminho/20 rounded-xl px-5 py-4 text-center text-lg text-pergaminho focus:border-vela outline-none font-corpo"
              placeholder="Seu nome"
            />
            <button
              onClick={avancar}
              disabled={!nome.trim()}
              className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        ) : passoInfo === 1 ? (
          <div key="data" className="flex flex-col gap-6 animate-[surgir_0.4s_ease]">
            <p className="text-center text-xs font-corpo tracking-widest text-violeta uppercase">
              Passo 10 de {TOTAL_PASSOS}
            </p>
            <h2 className="text-center font-display italic text-2xl text-pergaminho">
              Quando você chegou a este mundo?
            </h2>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              autoFocus
              style={{ colorScheme: 'dark' }}
              className="entrada-ritual bg-transparent border border-pergaminho/20 rounded-xl px-5 py-4 text-center text-lg text-pergaminho focus:border-vela outline-none font-corpo"
            />
            <button
              onClick={avancar}
              disabled={!dataNascimento}
              className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        ) : passoInfo === 2 ? (
          <div key="hora" className="flex flex-col gap-6 animate-[surgir_0.4s_ease]">
            <p className="text-center text-xs font-corpo tracking-widest text-violeta uppercase">
              Passo 11 de {TOTAL_PASSOS}
            </p>
            <h2 className="text-center font-display italic text-2xl text-pergaminho">
              A que horas, se souber?
            </h2>
            <p className="text-center font-corpo font-light text-xs text-pergaminho/50 -mt-3">
              Isso afina a leitura da lua — mas não é obrigatório.
            </p>
            <input
              type="time"
              value={horaNascimento}
              onChange={(e) => setHoraNascimento(e.target.value)}
              autoFocus
              style={{ colorScheme: 'dark' }}
              className="entrada-ritual bg-transparent border border-pergaminho/20 rounded-xl px-5 py-4 text-center text-lg text-pergaminho focus:border-vela outline-none font-corpo"
            />
            <div className="flex gap-3">
              <button
                onClick={avancar}
                className="flex-1 font-corpo text-sm text-pergaminho/60 hover:text-pergaminho/90 transition py-3"
              >
                Prefiro não dizer
              </button>
              <button
                onClick={avancar}
                className="flex-1 bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <div key="email" className="flex flex-col gap-6 animate-[surgir_0.4s_ease]">
            <p className="text-center text-xs font-corpo tracking-widest text-violeta uppercase">
              Passo 12 de {TOTAL_PASSOS}
            </p>
            <h2 className="text-center font-display italic text-2xl text-pergaminho">
              Onde a revelação deve te encontrar?
            </h2>
            <p className="text-center font-corpo font-light text-sm text-pergaminho/60 -mt-3">
              É onde guardamos o registro do seu ritual.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && email.trim() && enviarRitual()}
              className="bg-transparent border border-pergaminho/20 rounded-xl px-5 py-4 text-center text-lg text-pergaminho focus:border-vela outline-none font-corpo"
              placeholder="seu@email.com"
            />

            {erro && <p className="text-sm text-center text-red-300">{erro}</p>}

            <button
              onClick={enviarRitual}
              disabled={enviando || !email.trim()}
              className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
            >
              {enviando ? 'Atravessando o véu...' : 'Revelar meu familiar'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes surgir {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .entrada-ritual::-webkit-calendar-picker-indicator {
          filter: invert(0.85) sepia(1) saturate(4) hue-rotate(2deg);
          cursor: pointer;
        }
      `}</style>
    </main>
  );
}
