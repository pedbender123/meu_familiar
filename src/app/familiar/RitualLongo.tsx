'use client';
import { utmsDaSessao } from '@/components/checkout/utms';

import { useEffect, useRef, useState } from 'react';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { marcar } from '@/lib/marcar';
import { tocar } from '@/lib/som';
import { usePrefereMenosMovimento } from '@/lib/movimento';
import {
  CORACAO, OBJETIVOS, MAX_OBJETIVOS, CORES, ELEMENTOS,
  grupoDoPerfilLongo, energiaDoPerfil,
} from '@/lib/quiz/perfil-longo';
import { GRUPOS, type GrupoId } from '@/lib/quiz/grupos';
import { FAMILIARES } from '@/lib/familiares';
import { signoDe } from '@/lib/signos';
import { Constelacao } from '@/components/funil/Constelacao';
import {
  PassoDoRitual,
  BotaoDoRitual,
  Escolha,
  CartoesDeEscolha,
  EscolhaMultipla,
  EscolhaDeCor,
  CartoesQuatro,
} from '@/components/funil/PassoDoRitual';
import { RodaDeHora } from '@/components/funil/RodaDeHora';
import { EscolhaDeCidade, palpitarEstado } from '@/components/funil/EscolhaDeCidade';
import { LeituraDaMao } from '@/components/funil/LeituraDaMao';
import { RodaDeNascimento } from '@/components/funil/RodaDeNascimento';
import { MedidorDoVeu } from '@/components/funil/MedidorDoVeu';

/**
 * O funil longo — a segunda aposta sobre o que faz alguém comprar.
 *
 * ── Contra o que ele está sendo testado ───────────────────────────────────
 *
 * O `/atravessar` faz sete perguntas e mostra o preço em pouco mais de um
 * minuto. Aposta em curiosidade: chegar ao valor enquanto a pessoa ainda quer
 * saber. Ele resolveu o problema de chegar até lá — mas quem chega sai sem
 * clicar em plano nenhum.
 *
 * Este aqui aposta no contrário: investimento acumulado. Doze passos, cada um
 * devolvendo alguma coisa (o signo que aparece sob o dedo, o medidor que
 * sobe, a recapitulação que prova que o sistema estava prestando atenção).
 * Quem respondeu doze passos larga mais difícil que quem respondeu sete — é a
 * mesma razão pela qual o formato pegou no mercado.
 *
 * ── O que foi tirado do funil de referência, e por quê ────────────────────
 *
 * O original (um app concorrente de astrologia) tem leitura de palma por
 * câmera e um medidor de "precisão da previsão" com número fabricado. Os dois
 * ficaram de fora: a câmera é permissão pedida antes da venda, que é atrito
 * caro no pior momento; e o número inventado é afirmação falsa sobre o
 * produto. O medidor daqui mostra completude real do perfil.
 *
 * ── As perguntas são as mesmas do funil curto ─────────────────────────────
 *
 * De propósito. Se as perguntas mudassem junto com o formato, o teste mediria
 * duas coisas ao mesmo tempo e não diria qual delas fez diferença. As sete da
 * isca já estão escritas, equilibradas (25% por grupo em 16.384 caminhos) e
 * decidem o mesmo grupo nos dois lados.
 */
type Fase =
  | 'genero'
  | 'nascimento'
  | 'hora'
  | 'cidade'
  | 'lendo'
  | 'energia1'
  | 'coracao'
  | 'objetivos'
  | 'cor'
  | 'elemento'
  | 'energia2'
  | 'recap'
  | 'palma'
  | 'revelacao'
  | 'email';

const GENEROS = [
  { valor: 'f', rotulo: 'Mulher', icone: 'feminino' as const },
  { valor: 'm', rotulo: 'Homem', icone: 'masculino' as const },
  { valor: 'n', rotulo: 'Prefiro não dizer', icone: 'neutro' as const },
];

/** Os passos que a barra conta. `lendo` e os medidores não entram: eles são
 *  recompensa, e numerar recompensa faz ela parecer tarefa. */
const NUMERADOS: Fase[] = [
  'genero', 'nascimento', 'hora', 'cidade',
  'coracao', 'objetivos', 'cor', 'elemento', 'palma', 'email',
];

const HOJE = new Date();

export function RitualLongo({
  hero,
  rodape,
}: {
  hero?: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const semMovimento = usePrefereMenosMovimento();

  const [fase, setFase] = useState<Fase>('genero');
  const [genero, setGenero] = useState('');
  const [data, setData] = useState({ ano: HOJE.getFullYear() - 28, mes: 5, dia: 15 });
  const [hora, setHora] = useState({ hora: 12, minuto: 0 });
  const [sabeHora, setSabeHora] = useState<boolean | null>(null);
  // O estado começa no palpite do fuso; a cidade não, porque o fuso não sabe
  // — metade do país inteiro está em `America/Sao_Paulo`.
  const [local, setLocal] = useState(() => ({ estado: '', cidade: '' }));
  useEffect(() => setLocal((l) => (l.estado ? l : { ...l, estado: palpitarEstado() })), []);
  const cidade = local.cidade ? `${local.cidade}, ${local.estado}` : '';
  const [coracao, setCoracao] = useState('');
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [cor, setCor] = useState('');
  const [elemento, setElemento] = useState('');
  const [temPalma, setTemPalma] = useState(false);
  const [dados, setDados] = useState({ nome: '', email: '' });
  const [aceitou, setAceitou] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const abriu = useRef(false);
  useEffect(() => {
    if (abriu.current) return;
    abriu.current = true;
    marcar('ritual_aberto');
  }, []);

  /**
   * Trocar de fase é a ÚNICA forma de andar no funil, e ela marca sozinha.
   *
   * Antes as fases eram trocadas com `setFase` direto e só duas marcações
   * existiam: abriu e criou pedido. O painel via a entrada e a saída e nada
   * no meio — ou seja, não dava para saber em qual dos doze passos as pessoas
   * desistiam, que é a única pergunta que este funil precisa responder.
   *
   * Juntar as duas coisas numa função só impede o esquecimento: quem
   * adicionar um passo novo ganha a marcação de graça.
   */
  function irPara(proxima: Fase) {
    marcar(`funil_${proxima}`);
    setFase(proxima);
  }

  const grupo: GrupoId = grupoDoPerfilLongo({ elemento, objetivos });
  const signo = signoDe(data.mes + 1, data.dia);
  const nascimento = `${data.ano}-${String(data.mes + 1).padStart(2, '0')}-${String(data.dia).padStart(2, '0')}`;

  const energia = energiaDoPerfil({
    genero, nascimento: fase !== 'genero', hora: sabeHora === true,
    cidade, coracao, objetivos, cor, elemento, palma: temPalma,
  });

  const passo = Math.max(1, NUMERADOS.indexOf(fase) + 1);

  async function enviar() {
    setErro('');
    if (dados.nome.trim().length < 3) {
      return setErro('Diga como quer ser chamada — pelo menos três letras.');
    }
    setEnviando(true);
    try {
      const r = await fetch('/api/mini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfilLongo: { genero, hora: sabeHora ? hora : null, cidade, coracao, objetivos, cor, elemento, palma: temPalma },
          grupo,
          nome: dados.nome,
          dataNascimento: nascimento,
          email: aceitou ? dados.email : '',
          genero,
          funil: 'familiar',
          // Os UTMs da chegada, para a venda aparecer na Utmify com o anúncio
          // que a trouxe. Ver `utmJsonDoCorpo` em `lib/rastreio.ts`.
          utm: utmsDaSessao(),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'O véu está denso esta noite. Tente novamente.');
        setEnviando(false);
        return;
      }
      marcar('pedido_criado');
      window.location.assign(`/seu-familiar/${d.id}`);
    } catch {
      setErro('O véu está denso esta noite. Tente novamente em instantes.');
      setEnviando(false);
    }
  }

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8">
        {hero && fase === 'genero' && hero}

        {fase === 'genero' && (
          <PassoDoRitual
            passo={1}
            total={NUMERADOS.length}
            titulo="Para quem ele vem?"
            subtitulo="Um minuto de perguntas e ele atravessa."
          >
            <CartoesDeEscolha
              opcoes={GENEROS}
              valor={genero}
              onEscolher={(v) => {
                setGenero(v);
                tocar('clique');
                irPara('nascimento');
              }}
            />
          </PassoDoRitual>
        )}

        {fase === 'nascimento' && (
          <PassoDoRitual
            passo={2}
            total={NUMERADOS.length}
            onVoltar={() => irPara('genero')}
            titulo="Quando você nasceu?"
            subtitulo="Role até a sua data — o céu daquele dia se ajusta sozinho."
            acao={<BotaoDoRitual onClick={() => irPara('hora')}>Continuar</BotaoDoRitual>}
          >
            <RodaDeNascimento {...data} onChange={setData} />
          </PassoDoRitual>
        )}

        {fase === 'hora' && (
          <PassoDoRitual
            passo={3}
            total={NUMERADOS.length}
            onVoltar={() => irPara('nascimento')}
            titulo="Sabe a hora em que nasceu?"
            subtitulo="É ela que mostra onde a Lua estava. Sem a hora a leitura continua inteira — só menos afiada num ponto."
            acao={
              <div className="flex flex-col items-center gap-2.5 w-full">
                <BotaoDoRitual onClick={() => { setSabeHora(true); irPara('cidade'); }}>
                  Continuar
                </BotaoDoRitual>
                <button
                  onClick={() => { setSabeHora(false); irPara('cidade'); }}
                  className="font-corpo text-sm text-pergaminho/50 hover:text-vela underline underline-offset-4 transition"
                >
                  Não lembro
                </button>
              </div>
            }
          >
            <RodaDeHora {...hora} onChange={setHora} />
          </PassoDoRitual>
        )}

        {fase === 'cidade' && (
          <PassoDoRitual
            passo={4}
            total={NUMERADOS.length}
            onVoltar={() => irPara('hora')}
            titulo="Onde você nasceu?"
            subtitulo="É o que ancora o céu no lugar certo."
          >
            <EscolhaDeCidade
              {...local}
              onChange={setLocal}
              onEscolhida={() => {
                tocar('clique');
                irPara('lendo');
              }}
            />
          </PassoDoRitual>
        )}

        {fase === 'lendo' && (
          <LendoOCeu
            signo={signo.nome}
            simbolo={signo.simbolo}
            semMovimento={semMovimento}
            aoTerminar={() => irPara('energia1')}
          />
        )}

        {fase === 'energia1' && (
          <MedidorDoVeu
            percentual={energia}
            titulo="O céu já está desenhado."
            legenda="Conte um pouco mais e a leitura fica mais afiada."
            onContinuar={() => irPara('coracao')}
          />
        )}

        {fase === 'coracao' && (
          <PassoDoRitual
            passo={5}
            total={NUMERADOS.length}
            onVoltar={() => irPara('energia1')}
            titulo="Onde anda o seu coração?"
          >
            <Escolha
              opcoes={CORACAO.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
              valor={coracao}
              onEscolher={(v) => { setCoracao(v); tocar('clique'); irPara('objetivos'); }}
            />
          </PassoDoRitual>
        )}

        {fase === 'objetivos' && (
          <PassoDoRitual
            passo={6}
            total={NUMERADOS.length}
            onVoltar={() => irPara('coracao')}
            titulo="O que você procura agora?"
            subtitulo={`Escolha até ${MAX_OBJETIVOS}. É por aí que ele vai começar.`}
            acao={
              <BotaoDoRitual onClick={() => irPara('cor')} disabled={objetivos.length === 0}>
                Continuar
              </BotaoDoRitual>
            }
          >
            <EscolhaMultipla
              opcoes={OBJETIVOS.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
              selecionados={objetivos}
              max={MAX_OBJETIVOS}
              onAlternar={(v) =>
                setObjetivos((g) => (g.includes(v) ? g.filter((x) => x !== v) : [...g, v]))
              }
            />
          </PassoDoRitual>
        )}

        {fase === 'cor' && (
          <PassoDoRitual
            passo={7}
            total={NUMERADOS.length}
            onVoltar={() => irPara('objetivos')}
            titulo="Qual cor te chama?"
            subtitulo="Ela vira o tom da sua carta."
          >
            <EscolhaDeCor
              opcoes={CORES}
              valor={cor}
              onEscolher={(v) => { setCor(v); tocar('clique'); irPara('elemento'); }}
            />
          </PassoDoRitual>
        )}

        {fase === 'elemento' && (
          <PassoDoRitual
            passo={8}
            total={NUMERADOS.length}
            onVoltar={() => irPara('cor')}
            titulo="Que elemento te governa?"
          >
            <CartoesQuatro
              opcoes={ELEMENTOS}
              valor={elemento}
              onEscolher={(v: string) => { setElemento(v); tocar('clique'); irPara('energia2'); }}
            />
          </PassoDoRitual>
        )}

        {fase === 'energia2' && (
          <MedidorDoVeu
            percentual={energia}
            titulo="Quase lá."
            legenda="Falta a sua mão para fechar a leitura."
            rotuloDoBotao="Ver o que ele juntou"
            onContinuar={() => irPara('recap')}
          />
        )}

        {fase === 'recap' && (
          <Recapitulacao
            signo={signo}
            sabeHora={sabeHora}
            cidade={cidade}
            coracao={coracao}
            objetivos={objetivos}
            elemento={elemento}
            onSeguir={() => irPara('palma')}
          />
        )}

        {fase === 'palma' && (
          <LeituraDaMao
            onContinuar={(temFoto) => { setTemPalma(temFoto); irPara('revelacao'); }}
            onPular={() => irPara('revelacao')}
          />
        )}

        {fase === 'revelacao' && (
          <RevelacaoDoGrupo grupo={grupo} onSeguir={() => irPara('email')} />
        )}

        {fase === 'email' && (
          <PassoDoRitual
            passo={NUMERADOS.length}
            total={NUMERADOS.length}
            onVoltar={() => irPara('revelacao')}
            titulo="Falta ele saber como te chamar."
            subtitulo="É o nome que vai na carta, no retrato e na leitura."
          >
            <div className="flex flex-col gap-4">
              <Campo
                rotulo="Como você quer ser chamada"
                valor={dados.nome}
                onChange={(v) => setDados({ ...dados, nome: v })}
                placeholder="o nome que é seu de verdade"
                autoFocus
                maxLength={40}
              />

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aceitou}
                  onChange={(e) => setAceitou(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--ouro-velho)] cursor-pointer"
                />
                <span className="font-corpo font-light text-[13px] leading-snug text-escrita-corpo">
                  Aceito os{' '}
                  <a href="/termos" target="_blank" className="underline decoration-escrita/30">
                    termos
                  </a>{' '}
                  e a{' '}
                  <a href="/privacidade" target="_blank" className="underline decoration-escrita/30">
                    política de privacidade
                  </a>
                  , e quero receber a revelação por e-mail.
                </span>
              </label>

              {aceitou && (
                <div className="anima-surgir">
                  <Campo
                    rotulo="Para onde ele manda"
                    tipo="email"
                    valor={dados.email}
                    onChange={(v) => setDados({ ...dados, email: v })}
                    placeholder="seu@email.com"
                    onEnter={enviar}
                  />
                </div>
              )}

              <BotaoDoRitual
                onClick={enviar}
                disabled={
                  enviando ||
                  dados.nome.trim().length < 3 ||
                  (aceitou && !dados.email.trim())
                }
              >
                {enviando ? 'Atravessando o véu...' : 'Revelar quem me encontrou'}
              </BotaoDoRitual>
            </div>
          </PassoDoRitual>
        )}

        {erro && (
          <p className="font-corpo text-sm text-center text-red-400 max-w-[36ch]">{erro}</p>
        )}

        {rodape}
      </main>
    </>
  );
}

/**
 * A cena de "lendo o céu".
 *
 * Existe para dar peso ao que veio antes: sem uma pausa, a data que a pessoa
 * acabou de rolar some sem consequência visível, e o passo vira formulário. A
 * espera é curta de propósito — três segundos lê como cálculo, dez lê como
 * site travado.
 */
function LendoOCeu({
  signo,
  simbolo,
  semMovimento,
  aoTerminar,
}: {
  signo: string;
  simbolo: string;
  semMovimento: boolean;
  aoTerminar: () => void;
}) {
  const FALAS = [
    'Abrindo o céu daquele dia…',
    `O Sol estava em ${signo}.`,
    'A Lua responde em seguida…',
    'Alguma coisa se virou na sua direção.',
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (semMovimento) {
      aoTerminar();
      return;
    }
    if (i >= FALAS.length) {
      const t = setTimeout(aoTerminar, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((n) => n + 1), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, semMovimento]);

  return (
    <FolhaPergaminho>
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <span
          className="text-5xl text-ouro-velho leading-none"
          style={{ animation: semMovimento ? undefined : 'pulsar 2.4s ease-in-out infinite' }}
        >
          {simbolo}
        </span>
        <p className="font-display italic text-xl text-escrita min-h-[3.5rem] max-w-[26ch]">
          {FALAS[Math.min(i, FALAS.length - 1)]}
        </p>
      </div>
    </FolhaPergaminho>
  );
}

/**
 * A recapitulação.
 *
 * O passo mais importante do formato, e o mais fácil de fazer errado: ele tem
 * que devolver o que a pessoa deu, com as palavras dela. Uma lista genérica
 * ("perfil completo ✓") não prova nada; ver a própria escolha citada de volta
 * é o que faz o sistema parecer atento em vez de automático.
 */
function Recapitulacao({
  signo,
  sabeHora,
  cidade,
  coracao,
  objetivos,
  elemento,
  onSeguir,
}: {
  signo: { nome: string; simbolo: string };
  sabeHora: boolean | null;
  cidade: string;
  coracao: string;
  objetivos: string[];
  elemento: string;
  onSeguir: () => void;
}) {
  const rotuloDe = (lista: { valor: string; rotulo: string }[], v: string) =>
    lista.find((o) => o.valor === v)?.rotulo ?? '—';

  return (
    <div className="w-full max-w-xl flex flex-col gap-5 anima-surgir">
      <FolhaPergaminho>
        <div className="flex flex-col gap-5 self-stretch">
          <div className="text-center">
            <h2 className="font-display italic text-2xl sm:text-3xl text-escrita text-balance">
              Isto é o que ele juntou sobre você.
            </h2>
          </div>

          <div className="flex justify-center py-1">
            <Constelacao signo={signo.nome} tamanho={92} animada />
          </div>

          <ul className="flex flex-col gap-3">
            <Linha rotulo="O céu do seu nascimento" valor={`Sol em ${signo.nome}`} />
            <Linha
              rotulo="A Lua"
              valor={sabeHora ? 'Refinada pela hora que você deu' : 'Lida pelo dia, sem a hora'}
            />
            {cidade && <Linha rotulo="Onde tudo começou" valor={cidade} />}
            <Linha rotulo="O seu coração" valor={rotuloDe(CORACAO, coracao)} />
            <Linha
              rotulo="O que você procura"
              valor={objetivos.map((o) => rotuloDe(OBJETIVOS, o)).join(' · ') || '—'}
            />
            <Linha rotulo="O elemento que te governa" valor={rotuloDe(ELEMENTOS, elemento)} />
          </ul>
        </div>
      </FolhaPergaminho>

      <BotaoDoRitual onClick={onSeguir}>Falta a sua mão</BotaoDoRitual>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <li className="flex flex-col gap-0.5 border-b border-escrita/10 pb-2.5">
      <span className="font-corpo text-[0.6rem] tracking-[0.16em] uppercase text-escrita-fraca">
        {rotulo}
      </span>
      <span className="font-corpo text-[0.98rem] text-escrita leading-snug">{valor}</span>
    </li>
  );
}

/** A revelação do grupo — a mesma do funil curto, para o teste comparar só o formato. */
function RevelacaoDoGrupo({ grupo, onSeguir }: { grupo: GrupoId; onSeguir: () => void }) {
  const g = GRUPOS[grupo];
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 text-center anima-surgir">
      <span className="font-corpo text-[0.65rem] tracking-[0.24em] uppercase text-violeta">
        Alguma coisa te reconheceu
      </span>
      <h1 className="font-display italic text-3xl sm:text-4xl leading-tight text-vela text-balance">
        {g.nome}
      </h1>
      <p className="font-corpo font-light text-[0.95rem] text-pergaminho/80 leading-relaxed max-w-[38ch]">
        {g.retrato}
      </p>
      <ul className="flex gap-4 justify-center">
        {g.familiares.map((f) => (
          <li key={f} className="flex flex-col items-center gap-1.5 opacity-75">
            <SigiloFamiliar sigilo={FAMILIARES[f].sigilo} tamanho={62} variante="quarto" animado={false} />
            <span className="font-corpo text-[11px] text-pergaminho/35">?</span>
          </li>
        ))}
      </ul>
      <p className="font-corpo font-light text-sm text-pergaminho/65 leading-relaxed max-w-[36ch]">
        Três guardam essa natureza. Um deles veio atrás de você — e tem um nome
        que só dá pra quem perguntar.
      </p>
      <BotaoDoRitual onClick={onSeguir}>Quero saber qual é o meu</BotaoDoRitual>
    </div>
  );
}

function Campo({
  rotulo, valor, onChange, onEnter, placeholder, tipo = 'text', maxLength, autoFocus,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  tipo?: string;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-corpo text-[0.65rem] tracking-[0.18em] uppercase text-escrita-fraca">
        {rotulo}
      </span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete={tipo === 'email' ? 'email' : 'name'}
        className="entrada-ritual bg-transparent border border-escrita/25 rounded-xl px-4 py-3 text-lg text-escrita placeholder:text-escrita-fraca/50 focus:border-ouro-velho outline-none font-corpo"
      />
    </label>
  );
}
