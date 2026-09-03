'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EscolhaDeCheckout } from './EscolhaDeCheckout';
import { EscolhaDoCaminho } from './EscolhaDoCaminho';
import { FUNIL_PADRAO, linkDaCampanha, type FunilId } from '@/lib/funis';
import type { NomeDoGateway } from '@/nucleo/checkouts/nomes';
import { agoraEmBrasilia } from '@/lib/periodo';

/**
 * Cria uma campanha. O `fim` em branco significa "ainda no ar" — e é o caso
 * normal na hora de subir o anúncio, quando você sabe quando começou mas não
 * quando vai parar. O relatório usa "agora" como fim enquanto isso.
 */
export function FormularioDeCampanha() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // `inicio` nasce vazio e é preenchido com "agora" no clique que abre o
  // formulário — ler o relógio durante o render é impuro (React 19 recusa), e
  // preencher na abertura é o momento semanticamente certo de qualquer jeito.
  const [form, setForm] = useState({
    nome: '',
    plataforma: 'instagram',
    inicio: '',
    fim: '',
    investido: '',
    alcance_estimado: '',
    nota: '',
  });

  /**
   * Começa no funil que já vendeu.
   *
   * Todas as vendas até aqui saíram da landing com as 26 cenas. Uma campanha
   * nova nascer apontando para uma aposta não validada seria trocar o certo
   * pelo talvez sem ninguém ter decidido isso.
   */
  const [funil, setFunil] = useState<FunilId>(FUNIL_PADRAO);

  /**
   * O link fica na tela depois de criar, em vez de a caixa simplesmente
   * fechar.
   *
   * Criar a campanha e ter que caçar o código dela na lista para montar o
   * link à mão é onde o processo quebrava: quem monta à mão erra o caminho,
   * esquece o `?c=`, ou publica o anúncio apontando para a raiz. Aqui ele sai
   * pronto, no mesmo gesto.
   */
  const [pronto, setPronto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  /** `null` = segue o padrão do servidor, como toda campanha antiga. */
  const [gateway, setGateway] = useState<NomeDoGateway | null>(null);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      const r = await fetch('/api/painel/campanha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, funis: [funil], gateway }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? 'Não deu para salvar.');
        setSalvando(false);
        return;
      }
      setSalvando(false);
      setForm((f) => ({ ...f, nome: '', investido: '', nota: '' }));
      if (d.codigo) {
        setPronto(linkDaCampanha(window.location.origin, funil, d.codigo));
      } else {
        setAberto(false);
      }
      router.refresh();
    } catch {
      setErro('Falha de rede.');
      setSalvando(false);
    }
  }

  if (pronto) {
    return (
      <div className="w-full rounded-xl border border-vela/40 bg-vela/[0.06] px-5 py-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-corpo font-medium text-sm text-pergaminho/85">
            Campanha criada. O link é este:
          </h3>
          <span className="font-corpo text-[11px] text-pergaminho/40">
            é só este — não precisa de mais nada
          </span>
        </div>

        {/*
          Numa linha só, e selecionável. Quebrado em várias, um copiar-e-colar
          desavisado leva o espaço junto e a URL chega quebrada no gerenciador
          — erro que só aparece depois de o anúncio já ter gasto dinheiro.
        */}
        <code className="font-mono text-[12px] leading-relaxed text-vela break-all select-all">
          {pronto}
        </code>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(pronto);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              } catch {
                // Área de transferência bloqueada: o link está na tela.
              }
            }}
            className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition"
          >
            {copiado ? 'Copiado' : 'Copiar o link'}
          </button>
          <button
            onClick={() => {
              setPronto(null);
              setAberto(false);
            }}
            className="font-corpo text-xs px-4 py-2 rounded-full border border-pergaminho/20 text-pergaminho/60 hover:text-pergaminho transition"
          >
            Fechar
          </button>
        </div>

        <p className="font-corpo text-[11px] leading-relaxed text-pergaminho/40">
          As macros de UTM da Meta continuam valendo e podem ser coladas depois
          do <code className="font-mono">?c=</code> — quem separa os números
          desta campanha é o código, e ele já está aí.
        </p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        onClick={() => {
          setForm((f) => ({ ...f, inicio: f.inicio || agoraEmBrasilia() }));
          setAberto(true);
        }}
        className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition"
      >
        Nova campanha
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-vela/30 bg-vela/[0.04] px-5 py-4 flex flex-col gap-3">
      <h3 className="font-corpo font-medium text-sm text-pergaminho/85">
        Nova campanha
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Campo rotulo="Nome" valor={form.nome} onChange={set('nome')}
          placeholder="Story 07/08 — teste do bilhete" />
        <div className="sm:col-span-2 flex flex-col gap-4">
          <EscolhaDoCaminho valor={funil} onChange={setFunil} />
          <EscolhaDeCheckout valor={gateway} onChange={setGateway} />
        </div>

        <Seletor rotulo="Plataforma" valor={form.plataforma} onChange={set('plataforma')}
          opcoes={['instagram', 'tiktok', 'youtube', 'whatsapp', 'outro']} />
        <Campo rotulo="Investido (R$)" valor={form.investido} onChange={set('investido')}
          placeholder="50,00" />
        <Campo rotulo="Começou em" tipo="datetime-local" valor={form.inicio} onChange={set('inicio')} />
        <Campo rotulo="Termina em (vazio = no ar)" tipo="datetime-local"
          valor={form.fim} onChange={set('fim')} />
        <Campo rotulo="Alcance estimado" valor={form.alcance_estimado}
          onChange={set('alcance_estimado')} placeholder="3000" />
      </div>

      <Campo rotulo="Nota" valor={form.nota} onChange={set('nota')}
        placeholder="público, criativo usado, o que você quer testar..." />

      {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}

      <div className="flex gap-2">
        <button onClick={salvar} disabled={salvando}
          className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition disabled:opacity-40">
          {salvando ? 'Salvando...' : 'Criar campanha'}
        </button>
        <button onClick={() => setAberto(false)}
          className="font-corpo text-xs px-4 py-2 rounded-full border border-pergaminho/20 text-pergaminho/60 hover:text-pergaminho transition">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Campo({
  rotulo, valor, onChange, placeholder, tipo = 'text',
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        {rotulo}
      </span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ colorScheme: 'light dark' }}
        className="bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho placeholder:text-pergaminho/25 focus:border-vela outline-none"
      />
    </label>
  );
}

function Seletor({
  rotulo, valor, onChange, opcoes,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        {rotulo}
      </span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: 'var(--admin-superficie)' }}
          className="border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho focus:border-vela outline-none"
      >
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
