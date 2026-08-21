'use client';

import { useState } from 'react';
import type { Cupom } from '@/lib/cupons';

/**
 * Criar e desligar cupons, do painel.
 *
 * É a segunda coisa no painel que escreve no banco (a primeira é o estorno), e
 * pela mesma razão: a alternativa é você abrir SSH e escrever SQL na mão toda
 * vez que quiser dar um código para um amigo — o que, além de chato, é como se
 * digita `UPDATE` sem `WHERE` às duas da manhã.
 *
 * Não existe apagar cupom, só desligar. Cupom apagado deixa pedidos apontando
 * para um código que não existe mais, e aí o histórico de quanto cada campanha
 * custou some junto.
 */
export function PainelDeCupons({ inicial }: { inicial: Cupom[] }) {
  const [cupons, setCupons] = useState(inicial);
  const [codigo, setCodigo] = useState('');
  const [desconto, setDesconto] = useState('100');
  const [usosMax, setUsosMax] = useState('');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    const r = await fetch('/api/painel/cupom');
    if (r.ok) setCupons((await r.json()).cupons);
  }

  async function criar() {
    setErro('');
    setSalvando(true);
    try {
      const r = await fetch('/api/painel/cupom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          desconto_percentual: Number(desconto),
          usos_max: usosMax.trim() ? Number(usosMax) : null,
          nota: nota.trim() || null,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setErro(d.erro || 'Não deu.');
      } else {
        setCodigo('');
        setUsosMax('');
        setNota('');
        await recarregar();
      }
    } catch {
      setErro('Não deu para salvar agora.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(c: Cupom) {
    await fetch('/api/painel/cupom', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: c.codigo, ativo: !c.ativo }),
    });
    await recarregar();
  }

  const campo =
    'bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho placeholder:text-pergaminho/35 focus:border-vela focus:outline-none';

  return (
    <section className="w-full max-w-4xl flex flex-col gap-2">
      <h2 className="font-corpo font-medium text-sm text-pergaminho/80">Cupons</h2>

      <div className="rounded-xl border border-pergaminho/12 p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="CÓDIGO"
            className={campo}
            aria-label="Código"
          />
          <input
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            placeholder="% desconto"
            inputMode="numeric"
            className={campo}
            aria-label="Percentual de desconto"
          />
          <input
            value={usosMax}
            onChange={(e) => setUsosMax(e.target.value)}
            placeholder="usos (vazio = ∞)"
            inputMode="numeric"
            className={campo}
            aria-label="Máximo de usos"
          />
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="nota sua"
            className={campo}
            aria-label="Nota"
          />
        </div>

        {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={criar}
            disabled={salvando || !codigo.trim()}
            className="bg-vela text-tinta font-corpo text-xs font-medium px-5 py-2 rounded-full hover:brightness-110 transition disabled:opacity-40"
          >
            {salvando ? 'Criando...' : 'Criar cupom'}
          </button>
          <p className="font-corpo text-[11px] text-pergaminho/40">
            100% libera a revelação sem passar pelo pagamento.
          </p>
        </div>
      </div>

      {cupons.length > 0 && (
        <div className="w-full overflow-x-auto rounded-xl border border-pergaminho/12">
          <table className="w-full border-collapse font-corpo text-xs min-w-[34rem]">
            <thead>
              <tr className="text-pergaminho/45">
                {['código', 'desconto', 'usos', 'nota', ''].map((c) => (
                  <th key={c} scope="col" className="text-left font-medium px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-pergaminho/80">
              {cupons.map((c) => (
                <tr
                  key={c.codigo}
                  className={`border-t border-pergaminho/8 ${c.ativo ? '' : 'opacity-40'}`}
                >
                  <td className="px-3 py-2 font-medium tracking-wider">{c.codigo}</td>
                  <td className="px-3 py-2 tabular-nums">{`${c.desconto_percentual}%`}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {c.usos_max === null ? `${c.usos}` : `${c.usos}/${c.usos_max}`}
                  </td>
                  <td className="px-3 py-2 text-pergaminho/50">{c.nota ?? ''}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => alternar(c)}
                      className="text-pergaminho/50 hover:text-vela underline underline-offset-2"
                    >
                      {c.ativo ? 'desligar' : 'religar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
