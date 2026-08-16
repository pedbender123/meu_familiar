'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { marcar } from '@/lib/marcar';
import { evento } from '@/lib/pixel';
import { LinhaDeProgresso } from '@/components/LinhaDeProgresso';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { usePrefereMenosMovimento } from '@/lib/movimento';
import type { Item } from '@/lib/quiz/itens';
import type { ProdutoId } from '@/lib/produtos';

/**
 * O ritual: uma cena, e-mail, nome e data — depois o resto das cenas.
 *
 * ── O que mudou em relação à versão anterior ──────────────────────────────
 *
 * A tela antiga tinha uma **cópia própria** das 8 perguntas, escrita à mão
 * dentro do componente e divergente do `familiares.ts`. Aqui as cenas vêm do
 * banco de itens (`lib/quiz/itens.ts`), que é o mesmo que o motor de pontuação
 * usa — não há como a tela mostrar uma pergunta que a conta não conhece.
 *
 * ── Por que e-mail, nome e data vêm logo no início ────────────────────────
 *
 * Antes o e-mail era pedido depois de 4 cenas e nome/data só no final, depois
 * da última. Isso empurrava a mensagem final do familiar (que precisa do
 * nome para ser pessoal) para depois de um formulário de quatro campos — o
 * pior lugar para perder alguém que já respondeu tudo. Agora só a primeira
 * cena vem antes: quem chegou até ali já investiu o suficiente para não
 * estranhar três perguntas rápidas, e o resto do ritual segue sem mais
 * interrupção até a última cena, que já dispara a revelação.
 *
 * ── A ordem das opções é embaralhada ──────────────────────────────────────
 *
 * SPEC 2.6, efeito de ordem. O embaralhamento é feito **uma vez por sessão**
 * (`useMemo` sem dependência), não a cada render: reembaralhar no meio faria a
 * opção pular de lugar debaixo do dedo da pessoa. A resposta guardada é sempre
 * o índice ORIGINAL do item, não a posição na tela.
 */
interface Etapa {
  tipo: 'cena' | 'nome' | 'data' | 'guardar';
  item?: Item;
}

type Respostas = Record<string, number>;

interface Empate {
  entre: { familiar: string; nome: string; chamado: string }[];
}

export function RitualCliente({
  itens,
  ordemDasOpcoes,
  produtoPadrao,
}: {
  itens: Item[];
  /**
   * Ordem embaralhada das opções, por id de item, sorteada **no servidor**.
   *
   * Sortear aqui exigiria chamar `Math.random`/`Date.now` durante o render, o
   * que o React 19 proíbe — e com razão: render precisa ser puro para poder
   * ser repetido. Como a página é renderizada a cada visita, cada pessoa
   * recebe a sua ordem e ela fica estável enquanto a aba estiver aberta.
   */
  ordemDasOpcoes: Record<string, number[]>;
  produtoPadrao: ProdutoId;
}) {
  const semMovimento = usePrefereMenosMovimento();

  const etapas: Etapa[] = useMemo(() => {
    const cenas = itens.map((item) => ({ tipo: 'cena' as const, item }));
    return [
      ...cenas.slice(0, 1),
      { tipo: 'guardar' as const },
      { tipo: 'nome' as const },
      { tipo: 'data' as const },
      ...cenas.slice(1),
    ];
  }, [itens]);

  const busca = useSearchParams();

  /**
   * A resposta que veio da landing, no formato `id:indice`.
   *
   * A variante "espelho" mostra a primeira cena na própria página de vendas.
   * Quando a pessoa responde ali, ela chega aqui já com uma cena feita — e
   * repetir a mesma pergunta seria a forma mais rápida de fazê-la desistir.
   */
  const daLanding = useMemo(() => {
    const bruto = busca.get('r');
    if (!bruto) return null;
    const [id, indice] = bruto.split(':');
    const n = Number(indice);
    const item = itens.find((i) => i.id === id);
    if (!item || !Number.isInteger(n) || n < 0 || n >= item.opcoes.length) {
      return null;
    }
    return { id, indice: n };
    // Só na montagem: mudar de etapa não pode reprocessar a URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [etapa, setEtapa] = useState(daLanding ? 1 : 0);
  const [respostas, setRespostas] = useState<Respostas>(
    daLanding ? { [daLanding.id]: daLanding.indice } : {}
  );
  const [escolhaVisivel, setEscolhaVisivel] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [empate, setEmpate] = useState<Empate | null>(null);

  const atual = etapas[etapa];
  const respondidas = Object.keys(respostas).length;

  /** Número da cena dentro das 26, independente das etapas intercaladas. */
  const numeroDaCena = atual.item
    ? itens.findIndex((i) => i.id === atual.item!.id) + 1
    : 0;

  const abriu = useRef(false);
  useEffect(() => {
    if (abriu.current) return;
    abriu.current = true;
    marcar('ritual_aberto');
    if (daLanding) marcar('cena', 1);
  }, [daLanding]);

  // Um marco por etapa alcançada. `plano_visto` não está aqui: ele é marcado
  // na tela de revelação parcial, que é onde a oferta passou a viver.
  useEffect(() => {
    if (atual.tipo === 'nome') marcar('nome_ok');
    if (atual.tipo === 'data') marcar('data_ok');
  }, [atual.tipo]);

  function escolher(indiceOriginal: number, posicaoNaTela: number) {
    if (!atual.item || escolhaVisivel !== null) return;

    setEscolhaVisivel(posicaoNaTela);
    const respostasAtualizadas = { ...respostas, [atual.item.id]: indiceOriginal };
    setRespostas(respostasAtualizadas);
    marcar('cena', numeroDaCena);

    // Última etapa: não há mais "próxima cena" para avançar — é daqui que o
    // ritual é enviado. `respostas` ainda não teria a escolha atual no
    // momento do envio (setRespostas é assíncrono), por isso a versão
    // atualizada é passada direto para `enviar`, em vez de lida do estado.
    const ehUltimaEtapa = etapa === etapas.length - 1;

    // A pausa existe para a tinta assentar na opção escolhida antes de virar.
    // Sem ela a tela pula e a escolha não é confirmada visualmente.
    setTimeout(
      () => {
        setEscolhaVisivel(null);
        if (ehUltimaEtapa) {
          enviar(undefined, respostasAtualizadas);
        } else {
          setEtapa((e) => e + 1);
        }
      },
      semMovimento ? 0 : 420
    );
  }

  function voltar() {
    if (etapa === 0) return;
    setErro('');
    setEtapa((e) => e - 1);
  }

  async function enviar(desempate?: string, respostasFinal?: Respostas) {
    setErro('');
    if (!email.trim()) return setErro('Diga onde a revelação deve te encontrar.');
    if (!nome.trim()) return setErro('Diga seu nome, para que ele possa te reconhecer.');
    if (!dataNascimento) return setErro('Diga quando você chegou a este mundo.');

    setEnviando(true);
    try {
      const resposta = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas: respostasFinal ?? respostas,
          nome,
          dataNascimento,
          email,
          produto: produtoPadrao,
          ...(desempate ? { desempate } : {}),
        }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro || 'O véu está denso esta noite. Tente novamente.');
        setEnviando(false);
        return;
      }

      // Empate real: quem decide é a pessoa (SPEC 2.4).
      if (dados.empate) {
        setEmpate(dados.empate);
        setEnviando(false);
        return;
      }

      marcar('pedido_criado');

      // Cupom de 100%: não há o que cobrar, o servidor já liberou o pedido.
      /**
       * Vai para a revelação PARCIAL, não para o pagamento.
       *
       * A pessoa acabou de gastar cinco minutos; mostrar uma tela de cobrança
       * agora, sobre uma coisa que ela ainda não viu, é o pior momento
       * possível. Ela recebe a mensagem do familiar primeiro, e decide depois.
       */
      window.location.assign(`/seu-familiar/${dados.id}`);
    } catch {
      setErro('O véu está denso esta noite. Tente novamente em instantes.');
      setEnviando(false);
    }
  }

  if (empate) {
    return (
      <Quarto respondidas={itens.length} total={itens.length}>
        <FolhaPergaminho>
          <p className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
            Um último passo
          </p>
          <h2 className="font-display italic text-2xl sm:text-3xl text-escrita text-center text-balance max-w-[24ch]">
            Dois pares de olhos te encontraram ao mesmo tempo.
          </h2>
          <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[40ch]">
            Só um pode atravessar. Escolha por quem você fica.
          </p>

          <div className="flex flex-col gap-3 self-stretch mt-1">
            {empate.entre.map((op) => (
              <button
                key={op.familiar}
                onClick={() => enviar(op.familiar)}
                disabled={enviando}
                className="group text-left border border-escrita/20 rounded-xl px-5 py-4 hover:border-ouro-velho hover:bg-ouro-velho/5 transition disabled:opacity-50"
              >
                <span className="block font-display italic text-lg text-escrita">
                  {op.nome}
                </span>
                <span className="block font-corpo font-light text-sm text-escrita-corpo mt-1">
                  &ldquo;{op.chamado}&rdquo;
                </span>
              </button>
            ))}
          </div>
        </FolhaPergaminho>
      </Quarto>
    );
  }

  return (
    <Quarto respondidas={respondidas} total={itens.length}>
      <FolhaPergaminho>
        <p className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
          {atual.tipo === 'cena'
            ? 'Ele observa'
            : atual.tipo === 'guardar'
              ? 'Uma pausa'
              : 'Quase lá'}
        </p>

        {atual.tipo === 'cena' && atual.item && (
          enviando ? (
            <p className="font-corpo text-sm text-vela text-center anima-surgir py-10">
              Selando o ritual...
            </p>
          ) : (
            <Cena
              key={atual.item.id}
              item={atual.item}
              ordem={ordemDasOpcoes[atual.item.id] ?? [0, 1, 2, 3]}
              escolhida={respostas[atual.item.id]}
              destacada={escolhaVisivel}
              onEscolher={escolher}
            />
          )
        )}

        {atual.tipo === 'nome' && (
          <Campo
            key="nome"
            titulo="Diga seu nome, para que ele possa te reconhecer"
            valor={nome}
            onChange={setNome}
            onAvancar={() => setEtapa((e) => e + 1)}
            podeAvancar={!!nome.trim()}
            placeholder="Seu nome"
            maxLength={40}
          />
        )}

        {/*
          Último campo antes de voltar para as cenas. Daqui em diante é só
          responder até a última — que já dispara a revelação sozinha, sem
          mais nenhum campo no meio do caminho.
        */}
        {atual.tipo === 'data' && (
          <Campo
            key="data"
            titulo="Quando você chegou a este mundo?"
            tipo="date"
            valor={dataNascimento}
            onChange={setDataNascimento}
            onAvancar={() => setEtapa((e) => e + 1)}
            podeAvancar={!!dataNascimento}
          />
        )}

        {atual.tipo === 'guardar' && (
          <GuardarProgresso
            key="guardar"
            valor={email}
            onChange={setEmail}
            cena={respondidas}
            onAvancar={() => setEtapa((e) => e + 1)}
          />
        )}

      </FolhaPergaminho>

      {erro && (
        <p className="font-corpo text-sm text-center text-red-400 max-w-[38ch]">
          {erro}
        </p>
      )}

      {etapa > 0 && (
        <button
          onClick={voltar}
          className="font-corpo text-xs text-pergaminho/40 hover:text-pergaminho/75 transition underline underline-offset-4"
        >
          voltar uma cena
        </button>
      )}
    </Quarto>
  );
}

/* ── moldura ──────────────────────────────────────────────────────────── */

function Quarto({
  children,
  respondidas,
  total,
}: {
  children: React.ReactNode;
  respondidas: number;
  total: number;
}) {
  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center gap-6 px-5 py-10 sm:py-14">
        <LinhaDeProgresso total={total} respondidas={respondidas} />
        {children}
      </main>
    </>
  );
}

/* ── uma cena ─────────────────────────────────────────────────────────── */

function Cena({
  item,
  ordem,
  escolhida,
  destacada,
  onEscolher,
}: {
  item: Item;
  ordem: number[];
  escolhida?: number;
  destacada: number | null;
  onEscolher: (indiceOriginal: number, posicao: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6 self-stretch anima-surgir">
      <h2 className="font-display italic text-2xl sm:text-3xl leading-snug text-escrita text-center text-balance max-w-[26ch] mx-auto">
        {item.cena}
      </h2>

      <div className="flex flex-col gap-3">
        {ordem.map((indiceOriginal, posicao) => {
          const opcao = item.opcoes[indiceOriginal];
          const estaEscolhida =
            destacada === posicao || escolhida === indiceOriginal;

          return (
            <button
              key={indiceOriginal}
              onClick={() => onEscolher(indiceOriginal, posicao)}
              aria-pressed={estaEscolhida}
              className={[
                'relative overflow-hidden text-left font-corpo font-light rounded-xl px-5 py-4',
                'border transition-colors duration-200',
                estaEscolhida
                  ? 'border-ouro-velho text-escrita'
                  : 'border-escrita/20 text-escrita-corpo hover:border-ouro-velho/60 hover:bg-ouro-velho/5',
              ].join(' ')}
              style={{ animationDelay: `${posicao * 70}ms` }}
            >
              {/* a tinta que preenche a opção escolhida, da esquerda pra direita */}
              <span
                aria-hidden="true"
                className="absolute inset-0 origin-left bg-ouro-velho/12 transition-transform duration-500 ease-out"
                style={{ transform: `scaleX(${estaEscolhida ? 1 : 0})` }}
              />
              <span className="relative">{opcao.texto}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── guardar o progresso ──────────────────────────────────────────────── */

/**
 * O e-mail pedido no meio do caminho.
 *
 * ── Por que aqui, e por que com este texto ────────────────────────────────
 *
 * A justificativa é verdadeira: o e-mail guarda o progresso e é para onde a
 * revelação vai. Não é pretexto — quem sair agora recebe **um** lembrete com o
 * link de onde parou, e nada além disso.
 *
 * Isso importa porque a versão desonesta desta mesma tela é fácil de escrever:
 * bastaria inventar que o resultado "expira em 10 minutos" ou que a vaga é
 * limitada. Nada aqui expira e nada é limitado, então nada aqui diz isso.
 *
 * ── Pular é de verdade ────────────────────────────────────────────────────
 *
 * O botão de seguir sem dizer não é decorativo e não fica escondido em cinza
 * ilegível. Bloquear o ritual aqui converteria um pouco mais e transformaria o
 * produto num pedágio — e quem é obrigada a dar e-mail para continuar dá o
 * e-mail errado, o que não serve para nada.
 */
function GuardarProgresso({
  valor,
  onChange,
  cena,
  onAvancar,
}: {
  valor: string;
  onChange: (v: string) => void;
  cena: number;
  onAvancar: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function guardar() {
    if (!valor.trim()) return;
    setErro('');
    setSalvando(true);
    try {
      const r = await fetch('/api/progresso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: valor, cena }),
      });
      const d = await r.json().catch(() => ({ ok: true }));
      if (d.ok === false && d.erro) {
        setErro(d.erro);
        setSalvando(false);
        return;
      }
      marcar('email_ok');
      evento('Lead');
      onAvancar();
    } catch {
      // Falha de rede não pode prender ninguém no meio do ritual: o e-mail é
      // pedido de novo, de qualquer forma, antes do pagamento.
      onAvancar();
    }
  }

  return (
    <div className="flex flex-col gap-5 self-stretch anima-surgir">
      <h2 className="font-display italic text-2xl sm:text-3xl leading-snug text-escrita text-center text-balance max-w-[26ch] mx-auto">
        Onde a revelação deve te encontrar?
      </h2>

      <p className="font-corpo font-light text-sm text-escrita-corpo text-center leading-relaxed max-w-[42ch] mx-auto">
        Guardamos seu progresso neste e-mail — se você fechar a aba agora, dá
        para voltar de onde parou. É também para onde o PDF e as imagens vão no
        final.
      </p>

      <input
        autoFocus
        type="email"
        inputMode="email"
        autoComplete="email"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        placeholder="seu@email.com"
        aria-label="Seu e-mail"
        className="bg-transparent border-b border-escrita/25 focus:border-ouro-velho outline-none px-1 py-3 font-corpo text-lg text-escrita text-center placeholder:text-escrita-fraca/50 transition-colors"
      />

      {erro && <p className="font-corpo text-sm text-center text-red-700">{erro}</p>}

      <button
        onClick={guardar}
        disabled={salvando || !valor.trim()}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-3.5 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {salvando ? 'Guardando...' : 'Guardar e continuar'}
      </button>

      <button
        onClick={onAvancar}
        className="font-corpo text-sm text-escrita-fraca hover:text-escrita underline underline-offset-4 transition"
      >
        Continuar sem guardar
      </button>

      <p className="font-corpo text-xs text-escrita-fraca text-center leading-relaxed">
        Um lembrete só, se você não terminar. Sem propaganda, sem lista.
      </p>
    </div>
  );
}

/* ── um campo ─────────────────────────────────────────────────────────── */

function Campo({
  titulo,
  auxilio,
  tipo = 'text',
  valor,
  onChange,
  onAvancar,
  podeAvancar,
  placeholder,
  maxLength,
  rotuloAvancar = 'Continuar',
  rotuloPular,
  onPular,
  erro,
}: {
  titulo: string;
  auxilio?: string;
  tipo?: 'text' | 'date' | 'time' | 'email';
  valor: string;
  onChange: (v: string) => void;
  onAvancar: () => void;
  podeAvancar: boolean;
  placeholder?: string;
  maxLength?: number;
  rotuloAvancar?: string;
  rotuloPular?: string;
  onPular?: () => void;
  erro?: string;
}) {
  return (
    <div className="flex flex-col gap-5 self-stretch anima-surgir">
      <h2 className="font-display italic text-2xl sm:text-3xl leading-snug text-escrita text-center text-balance max-w-[24ch] mx-auto">
        {titulo}
      </h2>
      {auxilio && (
        <p className="font-corpo font-light text-sm text-escrita-fraca text-center -mt-2 max-w-[38ch] mx-auto">
          {auxilio}
        </p>
      )}

      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && podeAvancar && onAvancar()}
        style={tipo === 'date' || tipo === 'time' ? { colorScheme: 'light' } : undefined}
        className="entrada-ritual bg-transparent border border-escrita/25 rounded-xl px-5 py-4 text-center text-lg text-escrita placeholder:text-escrita-fraca/60 focus:border-ouro-velho outline-none font-corpo"
      />

      {erro && <p className="font-corpo text-sm text-center text-red-700">{erro}</p>}

      <div className="flex gap-3">
        {rotuloPular && onPular && (
          <button
            onClick={onPular}
            className="flex-1 font-corpo text-sm text-escrita-fraca hover:text-escrita transition py-3"
          >
            {rotuloPular}
          </button>
        )}
        <button
          onClick={onAvancar}
          disabled={!podeAvancar}
          className="flex-1 bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
        >
          {rotuloAvancar}
        </button>
      </div>
    </div>
  );
}
