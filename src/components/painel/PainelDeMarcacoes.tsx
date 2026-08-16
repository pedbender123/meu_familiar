'use client';

import { useState } from 'react';
import type { Marcacao } from '@/lib/marcacoes';

/**
 * A fila de quem diz ter compartilhado.
 *
 * ── O fluxo, que é metade automático e metade seu ─────────────────────────
 *
 * 1. A pessoa posta o story marcando @bruxario_ e registra o @ na revelação.
 *    Cai aqui como pendente.
 * 2. Você abre o Instagram, vê a marcação, acha o @ nesta lista e confirma. O
 *    bônus cai na conta dela.
 * 3. Quando alguém te marca **sem** ter registrado, você gera um link de
 *    resgate para aquele @ e manda por DM. O texto pronto está no botão.
 *
 * O passo 2 é manual porque não existe API do Instagram que responda "este
 * perfil me marcou num story". Confirmar no automático seria confirmar na
 * palavra de quem digitou num campo aberto.
 */
export function PainelDeMarcacoes({ inicial }: { inicial: Marcacao[] }) {
  const [lista, setLista] = useState(inicial);
  const [arroba, setArroba] = useState('');
  const [link, setLink] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function recarregar() {
    const r = await fetch('/api/painel/marcacao');
    if (r.ok) setLista((await r.json()).marcacoes);
  }

  async function confirmar(id: string) {
    await fetch('/api/painel/marcacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'confirmar', id }),
    });
    await recarregar();
  }

  async function gerarLink() {
    if (!arroba.trim()) return;
    const r = await fetch('/api/painel/marcacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'link', arroba }),
    });
    const d = await r.json();
    if (d.ok) {
      setLink(d.url);
      setCopiado(false);
      await recarregar();
    }
  }

  const mensagem = link
    ? `Obrigado por marcar o Bruxário! Vi seu story, mas seu @ não estava registrado na sua conta. Acesse este link para resgatar suas recompensas: ${link}`
    : '';

  async function copiar() {
    await navigator.clipboard.writeText(mensagem);
    setCopiado(true);
  }

  const pendentes = lista.filter((m) => !m.recompensado);

  return (
    <div className="w-full flex flex-col gap-6">
      <section className="rounded-2xl border border-pergaminho/12 p-4 flex flex-col gap-3">
        <h2 className="font-corpo font-medium text-sm text-pergaminho/80">
          Alguém te marcou e não está na lista?
        </h2>
        <p className="font-corpo font-light text-xs text-pergaminho/45 max-w-[62ch] leading-relaxed">
          Gere um link de resgate para o @ dela e mande por DM. O link vale uma
          vez só e queima depois do uso — se ele vazar num grupo, não vira dez
          recompensas.
        </p>
        <div className="flex gap-2">
          <input
            value={arroba}
            onChange={(e) => setArroba(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && gerarLink()}
            placeholder="@perfil que te marcou"
            className="flex-1 min-w-0 bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho placeholder:text-pergaminho/35 focus:border-vela focus:outline-none"
          />
          <button
            onClick={gerarLink}
            disabled={!arroba.trim()}
            className="bg-vela text-tinta font-corpo text-xs font-medium px-5 py-2 rounded-lg hover:brightness-110 transition disabled:opacity-40 shrink-0"
          >
            Gerar link
          </button>
        </div>

        {link && (
          <div className="flex flex-col gap-2 rounded-lg border border-vela/30 bg-vela/[0.06] p-3">
            <p className="font-corpo text-xs text-pergaminho/75 leading-relaxed break-words">
              {mensagem}
            </p>
            <button
              onClick={copiar}
              className="self-start font-corpo text-xs text-vela underline underline-offset-2"
            >
              {copiado ? 'copiado ✓' : 'copiar mensagem pronta'}
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-corpo font-medium text-sm text-pergaminho/80">
          {`Marcações (${pendentes.length} esperando conferência)`}
        </h2>
        <div className="w-full overflow-x-auto rounded-xl border border-pergaminho/12">
          <table className="w-full border-collapse font-corpo text-xs min-w-[38rem]">
            <thead>
              <tr className="text-pergaminho/45">
                {['@', 'e-mail', 'quando', 'estado', ''].map((c) => (
                  <th key={c} scope="col" className="text-left font-medium px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-pergaminho/80">
              {lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-pergaminho/35">
                    Ninguém registrou ainda.
                  </td>
                </tr>
              )}
              {lista.map((m) => (
                <tr key={m.id} className="border-t border-pergaminho/8">
                  <td className="px-3 py-2">
                    <a
                      href={`https://instagram.com/${m.arroba}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-vela hover:underline"
                    >
                      {`@${m.arroba}`}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-pergaminho/55">{m.email || '—'}</td>
                  <td className="px-3 py-2 text-pergaminho/45">
                    {new Date(m.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-2">
                    {m.recompensado ? (
                      <span className="text-pergaminho/45">recompensado</span>
                    ) : m.token ? (
                      <span className="text-violeta">link enviado</span>
                    ) : (
                      <span className="text-vela">pendente</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!m.recompensado && m.email && (
                      <button
                        onClick={() => confirmar(m.id)}
                        className="text-pergaminho/50 hover:text-vela underline underline-offset-2"
                      >
                        confirmar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
