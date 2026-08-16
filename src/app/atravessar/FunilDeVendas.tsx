'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { marcar } from '@/lib/marcar';
import { tocar } from '@/lib/som';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { RodaDeNascimento } from '@/components/funil/RodaDeNascimento';
import { BotaoDoRitual } from '@/components/funil/PassoDoRitual';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { usePrefereMenosMovimento } from '@/lib/movimento';
import { ISCA, grupoDaIsca } from '@/lib/quiz/isca';
import { GRUPOS, type GrupoId } from '@/lib/quiz/grupos';
import { FAMILIARES } from '@/lib/familiares';

/**
 * O funil de anúncio. **Existe para uma coisa: transformar visitante em venda.**
 *
 * ── O problema que ele resolve ────────────────────────────────────────────
 *
 * Quem chega de anúncio caía direto nas 26 cenas do teste. Na campanha de
 * 07/08: 216 pessoas, 28 responderam a primeira cena, 7 chegaram ao preço,
 * 1 clicou. Zero vendas. Ninguém investe treze minutos numa coisa que ainda
 * não sabe se quer.
 *
 * ── A ordem aqui é deliberada e é o ponto todo ────────────────────────────
 *
 * Três perguntas → **revelação** → formulário → oferta.
 *
 * A revelação vem ANTES do e-mail. É a inversão que importa: pedir o e-mail
 * antes é cobrar um pedágio de quem não recebeu nada; pedir depois é oferecer
 * um lugar para guardar o que ela acabou de ganhar. A mesma informação, dois
 * custos psicológicos completamente diferentes.
 *
 * ── As devolutivas ────────────────────────────────────────────────────────
 *
 * Entre uma pergunta e outra, uma linha curta reconhece a resposta. Não é
 * enfeite: é o que faz a pessoa sentir que está sendo lida em vez de
 * preenchendo formulário — e é barato, porque é texto fixo, sem IA.
 *
 * O teste de verdade (26 cenas, quatro eixos) continua existindo e continua
 * decidindo o familiar. Ele acontece depois da compra. Ver `lib/quiz/isca.ts`
 * para por que estas três perguntas não são aquelas.
 */
type Fase = 'nascimento' | 'perguntas' | 'revelacao' | 'dados';

export function FunilDeVendas({
  respostaInicial,
  hero,
  rodape,
}: {
  /** Escolha já feita antes de montar o funil. Hoje ninguém usa: `/vendas`
   *  roda o funil inteiro na própria página, então não há nada para retomar. */
  respostaInicial?: Record<string, number> | null;
  /** Título da página de vendas. Some depois da primeira resposta — a partir
   *  dali ele só ocuparia a tela com uma promessa que já foi aceita. */
  hero?: ReactNode;
  /** Termos e privacidade, embaixo. Exigência legal, corpo pequeno. */
  rodape?: ReactNode;
}) {
  const semMovimento = usePrefereMenosMovimento();

  /**
   * O nascimento vem PRIMEIRO, e isso mudou de lugar de propósito.
   *
   * Ele estava no formulário, no fim, junto do nome e do e-mail — três campos
   * de digitação em sequência, todos pedindo e nenhum devolvendo. A roda com a
   * constelação reagindo sob o dedo é a melhor recompensa que este funil tem, e
   * ela estava enterrada onde a pessoa já tinha decidido ficar.
   *
   * Na frente, ela faz o trabalho de abertura: a pessoa mexe, o céu responde, e
   * o primeiro gesto do funil já devolveu alguma coisa antes de cobrar nada.
   */
  const [fase, setFase] = useState<Fase>('nascimento');
  const [data, setData] = useState({
    ano: new Date().getFullYear() - 28,
    mes: 5,
    dia: 15,
  });
  // Quem já respondeu a primeira em `/vendas` começa na segunda. O `?r=` é
  // validado contra a isca no servidor, então aqui ele já é confiável.
  const [indice, setIndice] = useState(respostaInicial ? 1 : 0);
  const [respostas, setRespostas] = useState<Record<string, number>>(
    respostaInicial ?? {}
  );
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [eco, setEco] = useState<string | null>(null);
  const [dados, setDados] = useState({ nome: '', email: '' });
  // Marcado por padrão: o aceite é condição do contrato de compra, não
  // consentimento de marketing — e deixá-lo desmarcado faria a maioria chegar
  // ao pagamento sem e-mail, empurrando a coleta para depois em todos os
  // casos. Desmarcar esconde o campo e encurta o caminho até o preço.
  const [aceitou, setAceitou] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const abriu = useRef(false);
  useEffect(() => {
    if (abriu.current) return;
    abriu.current = true;
    marcar('ritual_aberto');
  }, []);

  const pergunta = ISCA[indice];
  const nascimento = `${data.ano}-${String(data.mes + 1).padStart(2, '0')}-${String(data.dia).padStart(2, '0')}`;
  const grupo: GrupoId = grupoDaIsca(respostas);

  function responder(opcao: number) {
    if (escolhida !== null) return;
    setEscolhida(opcao);
    setRespostas((r) => ({ ...r, [pergunta.id]: opcao }));
    marcar('cena', indice + 1);
    tocar('clique');

    /**
     * 160ms, e não os 1.300ms de antes.
     *
     * A versão anterior esperava 400ms e depois trocava a tela inteira por uma
     * frase de devolutiva por mais 900ms. Somando as três perguntas, eram
     * quase quatro segundos de gente olhando para o nada — e esta é a parte do
     * funil onde a pessoa ainda está decidindo se fica.
     *
     * A devolutiva não sumiu: ela virou `eco`, uma linha curta acima da
     * pergunta seguinte. Diz a mesma coisa ("fui lida") sem cobrar a espera,
     * porque aparece JUNTO com o próximo passo em vez de no lugar dele.
     *
     * Os 160ms que sobraram existem para a barra de preenchimento da opção
     * escolhida ser vista. Abaixo disso o clique não dá retorno nenhum.
     */
    setTimeout(
      () => {
        setEco(pergunta.devolutiva);
        setEscolhida(null);
        if (indice + 1 >= ISCA.length) {
          setFase('revelacao');
          marcar('plano_visto');
        } else {
          setIndice((i) => i + 1);
        }
      },
      semMovimento ? 0 : 160
    );
  }

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
        // O e-mail só viaja se ela aceitou os termos. Sem aceite não há base
        // para guardar endereço nenhum — e ele é pedido de novo depois do
        // pagamento, onde a entrega justifica a coleta por si só.
        body: JSON.stringify({
          isca: respostas,
          grupo,
          funil: 'atravessar',
          nome: dados.nome,
          dataNascimento: nascimento,
          email: aceitou ? dados.email : '',
          aceitouTermos: aceitou,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'O véu está denso esta noite. Tente novamente.');
        setEnviando(false);
        return;
      }
      marcar('pedido_criado');
      marcar('email_ok');
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
        {hero && fase === 'nascimento' && hero}

        {fase === 'nascimento' && (
          <>
            <Passos total={ISCA.length + 1} atual={0} />
            <FolhaPergaminho>
              <div className="flex flex-col gap-6 self-stretch anima-surgir">
                <div className="text-center">
                  <h2 className="font-display italic text-2xl sm:text-3xl leading-[1.15] text-escrita text-balance">
                    Quando você nasceu?
                  </h2>
                  <p className="mt-3 font-corpo font-light text-[0.9rem] leading-relaxed text-escrita-corpo/80 max-w-[30ch] mx-auto">
                    Role até a sua data — o céu daquele dia se acende sozinho.
                  </p>
                </div>
                <RodaDeNascimento {...data} onChange={setData} />
              </div>
            </FolhaPergaminho>
            <BotaoDoRitual
              onClick={() => {
                tocar('clique');
                setFase('perguntas');
              }}
            >
              Continuar
            </BotaoDoRitual>
          </>
        )}

        {fase === 'perguntas' && (
          <>
            <Passos total={ISCA.length + 1} atual={indice + 1} />
            <FolhaPergaminho>
              {
                <div className="flex flex-col gap-6 self-stretch anima-surgir">
                  {eco && (
                    <p className="font-corpo font-light text-[13px] text-escrita-fraca text-center -mb-2">
                      {eco}
                    </p>
                  )}
                  <h2 className="font-display italic text-2xl sm:text-3xl leading-snug text-escrita text-center text-balance max-w-[24ch] mx-auto">
                    {pergunta.pergunta}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {pergunta.opcoes.map((o, i) => (
                      <button
                        key={o.texto}
                        onClick={() => responder(i)}
                        aria-pressed={escolhida === i}
                        className={[
                          'relative overflow-hidden text-left font-corpo rounded-2xl px-5 py-4 border transition-all duration-200 text-[1.02rem] leading-snug',
                          escolhida === i
                            ? 'border-ouro-velho text-escrita'
                            : 'border-escrita/18 text-escrita-corpo hover:border-ouro-velho/55 hover:bg-ouro-velho/5',
                        ].join(' ')}
                      >
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 origin-left bg-ouro-velho/12 transition-transform duration-500 ease-out"
                          style={{ transform: `scaleX(${escolhida === i ? 1 : 0})` }}
                        />
                        <span className="relative">{o.texto}</span>
                      </button>
                    ))}
                  </div>
                </div>
              }
            </FolhaPergaminho>
          </>
        )}

        {fase === 'revelacao' && (
          <Revelacao grupo={grupo} onSeguir={() => setFase('dados')} />
        )}

        {fase === 'dados' && (
          <FolhaPergaminho>
            <Formulario
              grupo={grupo}
              dados={dados}
              onChange={setDados}
              aceitou={aceitou}
              onAceitar={setAceitou}
              onEnviar={enviar}
              enviando={enviando}
            />
          </FolhaPergaminho>
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
 * A revelação, de graça, antes de pedir qualquer coisa.
 *
 * É o momento que paga as três perguntas. A pessoa recebe um retrato que
 * reconhece em si e vê que existem três candidatos — e só então é convidada
 * a dizer quem é. Sem isto, o formulário seria cobrança; com isto, é o
 * caminho natural de quem quer guardar o que acabou de descobrir.
 */
function Revelacao({ grupo, onSeguir }: { grupo: GrupoId; onSeguir: () => void }) {
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
        {g.familiares.map((id) => (
          <li key={id} className="flex flex-col items-center gap-1.5 opacity-75">
            <SigiloFamiliar
              sigilo={FAMILIARES[id].sigilo}
              tamanho={62}
              variante="quarto"
              animado={false}
            />
            <span className="font-corpo text-[11px] text-pergaminho/35">?</span>
          </li>
        ))}
      </ul>

      <p className="font-corpo font-light text-sm text-pergaminho/65 leading-relaxed max-w-[36ch]">
        Três guardam essa natureza. Um deles veio atrás de você — e tem um
        nome que só dá pra quem perguntar.
      </p>

      <button
        onClick={onSeguir}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition"
      >
        Quero saber qual é o meu
      </button>
    </div>
  );
}

function Passos({ total, atual }: { total: number; atual: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === atual ? 22 : 7,
            height: 7,
            background: i <= atual ? 'var(--vela)' : 'rgba(234,224,204,0.22)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Nome, nascimento, aceite — e o e-mail só depois do aceite.
 *
 * ── Por que o e-mail é condicional ────────────────────────────────────────
 *
 * O e-mail é o campo mais caro do formulário: é onde a pessoa pesa se confia
 * o suficiente para dar um endereço. Pedi-lo antes da compra, de quem ainda
 * não decidiu comprar, é cobrar esse pedágio no pior momento possível.
 *
 * Então ele aparece só para quem já aceitou os termos — quem aceitou já se
 * posicionou como cliente, e digitar o endereço vira consequência, não
 * concessão. Quem desmarca segue direto para o preço com dois campos, e o
 * e-mail é pedido depois do pagamento, onde a entrega justifica a coleta
 * sozinha ("para onde eu mando?" é uma pergunta óbvia de quem já pagou).
 *
 * ── O nome exige três caracteres ──────────────────────────────────────────
 *
 * Ele vai impresso na carta, no PDF e na leitura. Uma letra solta passaria na
 * validação e reapareceria numa peça já gerada, sem conserto. Ver
 * `validarNome` em `lib/validacao.ts`.
 */
function Formulario({
  grupo,
  dados,
  onChange,
  aceitou,
  onAceitar,
  onEnviar,
  enviando,
}: {
  grupo: GrupoId;
  dados: { nome: string; email: string };
  onChange: (d: { nome: string; email: string }) => void;
  aceitou: boolean;
  onAceitar: (v: boolean) => void;
  onEnviar: () => void;
  enviando: boolean;
}) {
  const set = (k: keyof typeof dados) => (v: string) => onChange({ ...dados, [k]: v });

  const nomeOk = dados.nome.trim().length >= 3;
  // Sem aceite não há campo de e-mail na tela, então ele não pode ser
  // requisito para seguir — seria um botão travado por algo invisível.
  const completo = nomeOk && (!aceitou || !!dados.email.trim());

  return (
    <div className="flex flex-col gap-4 self-stretch anima-surgir">
      <h2 className="font-display italic text-2xl leading-snug text-escrita text-center text-balance max-w-[24ch] mx-auto">
        Falta ele saber quem você é.
      </h2>
      <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[36ch] mx-auto -mt-1">
        {`Você é d${GRUPOS[grupo].nome.startsWith('Os') ? 'os' : 'as'} ${GRUPOS[grupo].nome.replace(/^Os que /, 'que ')}. Diga como ele deve te chamar.`}
      </p>

      <Campo
        rotulo="Como você quer ser chamada"
        valor={dados.nome}
        onChange={set('nome')}
        placeholder="o nome que é seu de verdade"
        autoFocus
        maxLength={40}
      />
      

      <label className="flex items-start gap-3 cursor-pointer select-none py-1">
        <input
          type="checkbox"
          checked={aceitou}
          onChange={(e) => onAceitar(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--ouro-velho,#D9A441)] cursor-pointer"
        />
        <span className="font-corpo font-light text-[13px] leading-snug text-escrita-corpo">
          Aceito os{' '}
          <a href="/termos" target="_blank" className="underline decoration-escrita/30 hover:text-escrita">
            termos
          </a>{' '}
          e a{' '}
          <a href="/privacidade" target="_blank" className="underline decoration-escrita/30 hover:text-escrita">
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
            onChange={set('email')}
            placeholder="seu@email.com"
            onEnter={() => completo && onEnviar()}
          />
        </div>
      )}

      <button
        onClick={onEnviar}
        disabled={!completo || enviando}
        className="bg-vela text-tinta font-corpo font-medium text-[1.05rem] px-8 py-4 rounded-full hover:brightness-110 active:scale-[0.985] transition-all disabled:opacity-40 disabled:active:scale-100 mt-1"
      >
        {enviando ? 'Atravessando o véu...' : 'Revelar quem me encontrou'}
      </button>

      <p className="font-corpo text-[11px] text-escrita-fraca text-center leading-relaxed">
        {aceitou
          ? 'A data entra só como textura da leitura — ela não escolhe o seu familiar. Quem escolhe são as suas respostas.'
          : 'Sem o aceite, seguimos sem e-mail: você vê tudo aqui mesmo e diz para onde mandar depois.'}
      </p>
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
        autoComplete={tipo === 'email' ? 'email' : tipo === 'text' ? 'name' : undefined}
        style={tipo === 'date' ? { colorScheme: 'light' } : undefined}
        className="entrada-ritual bg-transparent border border-escrita/25 rounded-xl px-4 py-3 text-lg text-escrita placeholder:text-escrita-fraca/50 focus:border-ouro-velho outline-none font-corpo"
      />
    </label>
  );
}
