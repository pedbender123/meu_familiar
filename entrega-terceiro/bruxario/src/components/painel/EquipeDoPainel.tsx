'use client';

import { useState } from 'react';

interface Acesso {
  email: string;
  nota: string | null;
  criado_em: string;
  ultimo_acesso_em: string | null;
}

function quando(iso: string | null): string {
  if (!iso) return 'nunca entrou';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * A lista da equipe, com o dono no topo e sem botão de remover ao lado dele.
 *
 * O dono aparece porque a tela ficaria mentindo por omissão sem ele — a lista
 * de "quem entra no painel" que não mostra quem mais entra. Ele aparece sem
 * ação nenhuma porque não há ação possível: ele vem do ambiente, não da
 * tabela.
 */
export function EquipeDoPainel({
  dono,
  inicial,
}: {
  dono: string;
  inicial: Acesso[];
}) {
  const [equipe, setEquipe] = useState<Acesso[]>(inicial);
  const [email, setEmail] = useState('');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  async function agir(corpo: Record<string, unknown>) {
    setOcupado(true);
    setErro('');
    try {
      const r = await fetch('/api/painel/equipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'Não deu certo.');
      } else {
        setEquipe(d.equipe);
        setEmail('');
        setNota('');
      }
    } catch {
      setErro('Falha de rede. Tente de novo.');
    }
    setOcupado(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 p-4 rounded-xl border border-pergaminho/12">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-sm text-pergaminho placeholder:text-pergaminho/30 focus:border-vela outline-none"
          />
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="quem é (opcional)"
            maxLength={60}
            className="sm:w-48 bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-sm text-pergaminho placeholder:text-pergaminho/30 focus:border-vela outline-none"
          />
          <button
            onClick={() => agir({ acao: 'adicionar', email, nota })}
            disabled={ocupado || !email.trim()}
            className="bg-vela text-tinta font-corpo text-sm font-medium px-5 py-2 rounded-lg hover:brightness-110 transition disabled:opacity-40"
          >
            Dar acesso
          </button>
        </div>
        {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}
      </div>

      <ul className="flex flex-col gap-1.5">
        <li className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-vela/30 bg-vela/5">
          <div className="flex flex-col">
            <span className="font-corpo text-sm text-pergaminho">{dono}</span>
            <span className="font-corpo text-[11px] text-pergaminho/45">
              dono · vê e altera tudo · não pode ser removido
            </span>
          </div>
        </li>

        {equipe.map((a) => (
          <li
            key={a.email}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-pergaminho/12"
          >
            <div className="flex flex-col">
              <span className="font-corpo text-sm text-pergaminho">
                {a.email}
                {a.nota && (
                  <span className="text-pergaminho/45"> · {a.nota}</span>
                )}
              </span>
              <span className="font-corpo text-[11px] text-pergaminho/45">
                somente leitura · desde {quando(a.criado_em)} · último acesso:{' '}
                {quando(a.ultimo_acesso_em)}
              </span>
            </div>
            <button
              onClick={() => agir({ acao: 'remover', email: a.email })}
              disabled={ocupado}
              className="font-corpo text-xs text-pergaminho/45 hover:text-red-400 transition disabled:opacity-40 shrink-0"
            >
              remover
            </button>
          </li>
        ))}

        {equipe.length === 0 && (
          <li className="px-4 py-6 text-center font-corpo text-sm text-pergaminho/35">
            Só você, por enquanto.
          </li>
        )}
      </ul>
    </div>
  );
}
