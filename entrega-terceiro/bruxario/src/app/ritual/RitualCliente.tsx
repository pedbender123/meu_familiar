'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { BuscaDeCidade, type CidadeEscolhida } from '@/components/funil/BuscaDeCidade';
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
  tipo: 'cena' | 'formulario';
  item?: Item;
}

type Respostas = Record<string, number>;

interface Empate {
  entre: { familiar: string; nome: string; chamado: string }[];
}

/**
 * Os parâmetros de campanha da URL, no vocabulário da Utmify.
 *
 * `src` e `sck` entram porque algumas plataformas de anúncio usam esses nomes
 * em vez de `utm_*` — ler os dois custa nada e evita perder a origem.
 */
function lerUtms(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const busca = new URLSearchParams(window.location.search);
  const chaves = [
    'src', 'sck', 'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term',
  ];
  const achados: Record<string, string> = {};
  for (const chave of chaves) {
    const valor = busca.get(chave);
    if (valor) achados[chave] = valor.slice(0, 120);
  }
  return achados;
}

export function RitualCliente({
  itens,
  ordemDasOpcoes,
  produtoPadrao,
  hero,
  rodape,
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
  /**
   * Título da porta de entrada sem landing. Some depois da primeira resposta
   * — dali em diante ele só empurraria a cena para baixo da dobra.
   * Ausente em `/ritual`, que vem depois de uma landing que já prometeu.
   */
  hero?: ReactNode;
  /** Aviso legal e links de Termos/Privacidade. Exigência, corpo pequeno. */
  rodape?: ReactNode;
}) {
  const semMovimento = usePrefereMenosMovimento();

  /**
   * As 26 cenas primeiro, e **só então** quem você é.
   *
   * ── Como era, e por que mudou ─────────────────────────────────────────
   *
   * A ordem antiga era: cena 1 → e-mail → nome → data → cenas 2 a 26. Três
   * campos de digitação logo depois da primeira pergunta, antes de a pessoa
   * ter recebido nada. Cada um deles é um pedágio, e pedágio no começo cobra
   * de quem ainda não sabe se quer o que está do outro lado.
   *
   * Agora o ritual inteiro acontece primeiro. Quem chega ao formulário
   * atravessou 26 cenas — já investiu, já quer ver o resultado, e o
   * formulário deixa de ser um pedágio para virar o último passo de uma coisa
   * que ela decidiu terminar.
   *
   * ── O que se perde, e foi decisão explícita ───────────────────────────
   */
  const etapas: Etapa[] = useMemo(
    () => [
      ...itens.map((item) => ({ tipo: 'cena' as const, item })),
      { tipo: 'formulario' as const },
    ],
    [itens]
  );

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
  const [horaNascimento, setHoraNascimento] = useState('');
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(null);
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

  /**
   * `Lead` no pixel, uma vez por ritual.
   *
   * É o único evento que sai daqui: a pessoa deixou um endereço, então há
   * alguém para o anúncio otimizar. O `Purchase` sai da tela de obrigado, com
   * `event_id`, e a compra é confirmada pelo webhook.
   */
  const jaMarcouLead = useRef(false);
  useEffect(() => {
    if (jaMarcouLead.current || !email.includes('@')) return;
    jaMarcouLead.current = true;
    evento('Lead');
  }, [email]);

  function escolher(indiceOriginal: number, posicaoNaTela: number) {
    if (!atual.item || escolhaVisivel !== null) return;

    setEscolhaVisivel(posicaoNaTela);
    const respostasAtualizadas = { ...respostas, [atual.item.id]: indiceOriginal };
    setRespostas(respostasAtualizadas);

    // A pausa existe para a tinta assentar na opção escolhida antes de virar.
    // Sem ela a tela pula e a escolha não é confirmada visualmente.
    //
    // A última cena não envia mais nada: depois dela vem o formulário, e é o
    // botão de lá que fecha o ritual. Por isso `respostasAtualizadas` não
    // precisa mais viajar até `enviar` — quando o botão for tocado, o estado
    // já assentou há muito tempo.
    setTimeout(
      () => {
        setEscolhaVisivel(null);
        setEtapa((e) => e + 1);
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
    if (!nome.trim()) return setErro('Diga seu nome, para que ele possa te reconhecer.');
    if (!email.trim()) return setErro('Diga onde a revelação deve te encontrar.');
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
          // Vazio quando a pessoa não sabe: o servidor trata a ausência com
          // meio-dia e marca a hora como aproximada. Chutar aqui esconderia
          // dela que o ascendente é palpite.
          horaNascimento: horaNascimento || undefined,
          cidadeNascimento: cidade?.cidade,
          estadoNascimento: cidade?.estado,
          email,
          produto: produtoPadrao,
          /**
           * Os UTMs da URL do anúncio, lidos aqui e gravados no pedido.
           *
           * É o servidor que vai reportar a venda à Utmify, horas depois,
           * quando o pagamento confirmar — e nessa hora não há aba aberta
           * para consultar. Se eles não viajarem agora, a campanha que trouxe
           * a pessoa se perde.
           */
          utm: lerUtms(),
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
      <Quarto respondidas={itens.length} total={itens.length} rodape={rodape}>
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
    <Quarto
      respondidas={respondidas}
      total={itens.length}
      hero={respondidas === 0 ? hero : undefined}
      rodape={rodape}
    >
      <FolhaPergaminho>
        <p className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
          {atual.tipo === 'cena' ? 'Ele observa' : 'O ritual terminou'}
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

        {atual.tipo === 'formulario' && (
          <FormularioFinal
            nome={nome}
            onNome={setNome}
            email={email}
            onEmail={setEmail}
            data={dataNascimento}
            onData={setDataNascimento}
            hora={horaNascimento}
            onHora={setHoraNascimento}
            cidade={cidade}
            onCidade={setCidade}
            enviando={enviando}
            onEnviar={() => enviar()}
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
  hero,
  rodape,
}: {
  children: React.ReactNode;
  respondidas: number;
  total: number;
  hero?: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center gap-6 px-5 py-10 sm:py-14">
        <LinhaDeProgresso total={total} respondidas={respondidas} />
        {hero}
        {children}
        {rodape}
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

/* ── o formulário final ───────────────────────────────────────────────── */

/**
 * Tudo o que precisamos saber, numa tela só, **depois** do ritual inteiro.
 *
 * ── Por que uma tela e não cinco passos ───────────────────────────────────
 *
 * Passo a passo é a forma certa de fazer perguntas quando cada resposta é uma
 * decisão — foi assim que as 26 cenas foram desenhadas, e é por isso que elas
 * funcionam. Mas nome, e-mail e nascimento não são decisões: são dados que a
 * pessoa já tem na cabeça. Fatiá-los em cinco telas transforma trinta
 * segundos de digitação em cinco momentos de "ainda tem mais?", e é no
 * terceiro deles que a aba fecha.
 *
 * Aqui ela vê o fim inteiro de uma vez, e o fim é curto.
 *
 * ── A hora é opcional de verdade ──────────────────────────────────────────
 *
 * Muita gente não sabe a hora em que nasceu, e essa é a pergunta que mais
 * trava formulário de astrologia. Deixar em branco é um caminho declarado,
 * não um campo que a pessoa descobre que pode pular: o servidor assume
 * meio-dia e marca o dado como aproximado, e o que depende dela — ascendente
 * e casas — sai como estimativa em vez de sair errado calado.
 *
 * ── A cidade não muda quase nada, e mesmo assim é pedida ──────────────────
 *
 * `coordenadas.ts` usa a capital do estado (o erro de longitude cabe dentro
 * do erro da hora informada de memória). O nome exato entra porque é dela,
 * porque aparece na carta, e porque no dia em que houver uma base
 * geocodificada o dado já vai estar no banco de todo mundo que passou por
 * aqui.
 */
function FormularioFinal({
  nome,
  onNome,
  email,
  onEmail,
  data,
  onData,
  hora,
  onHora,
  cidade,
  onCidade,
  enviando,
  onEnviar,
}: {
  nome: string;
  onNome: (v: string) => void;
  email: string;
  onEmail: (v: string) => void;
  data: string;
  onData: (v: string) => void;
  hora: string;
  onHora: (v: string) => void;
  cidade: CidadeEscolhida | null;
  onCidade: (v: CidadeEscolhida | null) => void;
  enviando: boolean;
  onEnviar: () => void;
}) {
  const [mostrarHora, setMostrarHora] = useState(false);
  const completo = !!nome.trim() && email.includes('@') && !!data;

  return (
    <div className="flex flex-col gap-6 self-stretch anima-surgir">
      <div className="flex flex-col gap-2">
        <h2 className="font-display italic text-2xl sm:text-3xl leading-snug text-escrita text-center text-balance max-w-[26ch] mx-auto">
          Ele já sabe quem você é. Falta ele saber seu nome.
        </h2>
        <p className="font-corpo font-light text-sm text-escrita-corpo text-center leading-relaxed max-w-[40ch] mx-auto">
          Últimos campos, e a revelação aparece na tela.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Rotulo texto="Seu nome">
          <input
            autoFocus
            type="text"
            value={nome}
            onChange={(e) => onNome(e.target.value)}
            maxLength={40}
            autoComplete="given-name"
            placeholder="Como te chamam"
            className="w-full bg-transparent border border-escrita/20 rounded-xl px-4 py-3 font-corpo text-sm text-escrita placeholder:text-escrita-fraca focus:border-ouro-velho outline-none"
          />
        </Rotulo>

        <Rotulo texto="Seu e-mail">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full bg-transparent border border-escrita/20 rounded-xl px-4 py-3 font-corpo text-sm text-escrita placeholder:text-escrita-fraca focus:border-ouro-velho outline-none"
          />
          <span className="font-corpo text-[11px] text-escrita-fraca leading-relaxed">
            É por ele que você entra na plataforma depois. Sem lista, sem
            propaganda.
          </span>
        </Rotulo>

        <Rotulo texto="Quando você nasceu">
          <input
            type="date"
            value={data}
            onChange={(e) => onData(e.target.value)}
            className="w-full bg-transparent border border-escrita/20 rounded-xl px-4 py-3 font-corpo text-sm text-escrita focus:border-ouro-velho outline-none"
          />
        </Rotulo>

        {mostrarHora ? (
          <Rotulo texto="A que horas (se souber)">
            <input
              type="time"
              value={hora}
              onChange={(e) => onHora(e.target.value)}
              className="w-full bg-transparent border border-escrita/20 rounded-xl px-4 py-3 font-corpo text-sm text-escrita focus:border-ouro-velho outline-none"
            />
            <span className="font-corpo text-[11px] text-escrita-fraca leading-relaxed">
              Em branco está tudo bem — o mapa sai com o ascendente estimado, e
              você pode corrigir depois na sua conta.
            </span>
          </Rotulo>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarHora(true)}
            className="self-start font-corpo text-xs text-escrita-fraca hover:text-escrita underline underline-offset-4 transition"
          >
            Sei a hora em que nasci — quero informar
          </button>
        )}

        <Rotulo texto="Onde você nasceu">
          <BuscaDeCidade valor={cidade} onEscolher={onCidade} />
        </Rotulo>
      </div>

      <button
        onClick={onEnviar}
        disabled={!completo || enviando}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {enviando ? 'Selando o ritual...' : 'Revelar meu familiar'}
      </button>
    </div>
  );
}

function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-corpo text-[0.65rem] tracking-[0.18em] uppercase text-escrita-fraca">
        {texto}
      </span>
      {children}
    </label>
  );
}
