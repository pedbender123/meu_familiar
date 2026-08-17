'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ESTADOS, coordenadaDoEstado } from '@/lib/coordenadas';

/**
 * O pedido dos dados que faltam para o mapa natal.
 *
 * ── Enquadrado como desbloqueio, não como cadastro ────────────────────────
 *
 * "Complete seu perfil" é trabalho que a pessoa faz por obrigação; "isto abre
 * o seu calendário" é uma troca que ela escolhe. O texto e o botão seguem
 * essa segunda leitura, e por isso existe o "agora não" — formulário sem
 * saída num produto de assinatura vira motivo pra fechar a aba, não pra
 * preencher.
 *
 * Só pede o que realmente falta: data e hora costumam vir herdadas do ritual
 * (`herdarNascimentoDosPedidos`), então na maioria dos casos isto é uma
 * pergunta só — o estado.
 */
export function CompletarNascimento({
  faltando,
  dataInicial,
  horaInicial,
}: {
  faltando: string[];
  dataInicial: string | null;
  horaInicial: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState(dataInicial ?? '');
  const [hora, setHora] = useState(horaInicial ?? '');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dispensado, setDispensado] = useState(false);

  if (dispensado) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const coord = coordenadaDoEstado(estado);
    if (!coord) {
      setErro('Escolha o estado onde você nasceu.');
      return;
    }

    setSalvando(true);
    try {
      const resposta = await fetch('/api/conta/nascimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          hora,
          cidade: cidade.trim() || estado,
          lat: coord.lat,
          lon: coord.lon,
        }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo?.erro ?? 'Não consegui salvar. Tente de novo.');
        return;
      }
      // `refresh` em vez de reload: o servidor recalcula o estado do perfil e
      // este bloco some sozinho, sem piscar a página inteira.
      router.refresh();
    } catch {
      setErro('Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={salvar}
      className="w-full max-w-md flex flex-col gap-4 p-5 rounded-2xl border border-vela/25 bg-vela/[0.04]"
    >
      <div className="flex flex-col gap-1.5">
        <p className="font-display italic text-xl text-pergaminho leading-snug">
          Falta uma coisa para o céu abrir.
        </p>
        <p className="font-corpo font-light text-sm text-pergaminho/60 leading-relaxed">
          Para desenhar o seu calendário eu preciso saber{' '}
          {faltando.length === 1
            ? faltando[0]
            : `${faltando.slice(0, -1).join(', ')} e ${faltando[faltando.length - 1]}`}
          .
        </p>
      </div>

      {!dataInicial && (
        <label className="flex flex-col gap-1.5">
          <span className="font-corpo text-[0.62rem] tracking-[0.18em] uppercase text-pergaminho/45">
            Data de nascimento
          </span>
          <input
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="bg-pergaminho/[0.06] border border-pergaminho/15 rounded-lg px-3 py-2.5 font-corpo text-sm text-pergaminho focus:outline-none focus:border-vela/45"
          />
        </label>
      )}

      {!horaInicial && (
        <label className="flex flex-col gap-1.5">
          <span className="font-corpo text-[0.62rem] tracking-[0.18em] uppercase text-pergaminho/45">
            Hora (aproximada serve)
          </span>
          <input
            type="time"
            required
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="bg-pergaminho/[0.06] border border-pergaminho/15 rounded-lg px-3 py-2.5 font-corpo text-sm text-pergaminho focus:outline-none focus:border-vela/45"
          />
        </label>
      )}

      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-corpo text-[0.62rem] tracking-[0.18em] uppercase text-pergaminho/45">
            Estado
          </span>
          <select
            required
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="bg-pergaminho/[0.06] border border-pergaminho/15 rounded-lg px-3 py-2.5 font-corpo text-sm text-pergaminho focus:outline-none focus:border-vela/45"
          >
            <option value="">—</option>
            {ESTADOS.map((sigla) => (
              <option key={sigla} value={sigla} className="text-tinta">
                {sigla}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-corpo text-[0.62rem] tracking-[0.18em] uppercase text-pergaminho/45">
            Cidade (opcional)
          </span>
          <input
            type="text"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="onde você nasceu"
            className="bg-pergaminho/[0.06] border border-pergaminho/15 rounded-lg px-3 py-2.5 font-corpo text-sm text-pergaminho placeholder:text-pergaminho/25 focus:outline-none focus:border-vela/45"
          />
        </label>
      </div>

      {erro && (
        <p role="alert" className="font-corpo text-sm text-vela">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={salvando}
          className="bg-vela text-tinta font-corpo font-medium text-sm px-6 py-2.5 rounded-full hover:brightness-110 disabled:opacity-50 transition"
        >
          {salvando ? 'Guardando...' : 'Abrir meu mapa'}
        </button>
        <button
          type="button"
          onClick={() => setDispensado(true)}
          className="font-corpo text-sm text-pergaminho/40 hover:text-pergaminho/70 transition-colors"
        >
          agora não
        </button>
      </div>
    </form>
  );
}
