import { NextRequest, NextResponse } from 'next/server';


/**
 * Dá identidade ao visitante ANTES da primeira página renderizar.
 *
 * ── Por que aqui e não na rota de visita ──────────────────────────────────
 *
 * O cookie de visitante era criado pela chamada de telemetria, que só roda
 * **depois** da página aparecer — então a primeira visita, justamente a que
 * importa para medir de onde veio a pessoa, ficava sem identidade. O
 * middleware roda antes de tudo e pode escrever cookie, que é o que falta.
 *
 * ── O teste A/B foi removido ──────────────────────────────────────────────
 *
 * Existiu aqui um cookie `bx_ab` que sorteava entre duas páginas de vendas.
 * A página perdedora foi apagada e só sobrou uma — mas o sorteio continuou
 * rodando por um tempo, rotulando gente como "promessa"/"espelho" no banco
 * quando todas viam a MESMA tela. O painel comparava duas colunas que eram a
 * mesma coisa. Dado que mente é pior que dado que falta, então saiu inteiro.
 *
 * ── O que este arquivo pode usar ──────────────────────────────────────────
 *
 * Roda no runtime Edge: sem `better-sqlite3`, sem `fs`, sem nada de Node. Por
 * isso ele só carimba cookies — quem grava no banco é a rota de telemetria,
 * que roda em Node e lê estes mesmos cookies.
 *
 * ── A origem é capturada aqui também ──────────────────────────────────────
 *
 * Antes ela dependia do JavaScript de telemetria ter rodado. Quem chegava do
 * anúncio e fechava a página em dois segundos não deixava rastro de origem
 * nenhum — e são justamente esses que a campanha precisa contar.
 */

const ANO = 60 * 60 * 24 * 365;

const ORIGENS = new Set([
  'tiktok',
  'instagram',
  'bio',
  'stories',
  'whatsapp',
  'youtube',
  'amigo',
  'anuncio',
]);

/**
 * As origens que merecem a página de VENDAS em vez da landing expositiva.
 *
 * ── Por que isto existe ───────────────────────────────────────────────────
 *
 * Os links já publicados — no anúncio que está rodando, na bio, nos stories
 * antigos — apontam para a raiz. Exigir que todos sejam trocados significaria
 * pausar o anúncio, editar, republicar, e ainda assim perder quem salvou o
 * link antigo. Mais barato é a raiz reconhecer de onde a pessoa vem.
 *
 * ── Quem NÃO entra na lista, e por quê ────────────────────────────────────
 *
 * `amigo` e `whatsapp` ficam de fora de propósito. Quem chega por indicação
 * pessoal já vem com confiança emprestada de alguém, e para essa pessoa a
 * página expositiva é melhor: ela explica o método, mostra os preços e
 * responde as perguntas que ela vai fazer de volta para quem indicou.
 *
 * A página de vendas é para o desconhecido que rolava o feed.
 */
const ORIGENS_DE_VENDAS = new Set([
  'instagram',
  'tiktok',
  'stories',
  'bio',
  'anuncio',
  'youtube',
]);

/** Hosts de rede social, para reconhecer quem chega sem `?de=`. */
const REDES = ['instagram', 'tiktok', 'facebook', 'youtube', 'youtu.be', 'threads'];

function veioDeRede(referer: string | null): boolean {
  if (!referer) return false;
  try {
    const host = new URL(referer).hostname;
    return REDES.some((r) => host.includes(r));
  } catch {
    return false;
  }
}

/** Não gasta ciclo em imagem, fonte, rota de API ou arquivo interno do Next. */
export const config = {
  matcher: ['/((?!_next|api|og|favicon|.*\\.).*)'],
};

export default function proxy(req: NextRequest) {
  const resposta = NextResponse.next();

  const comum = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ANO,
  };

  let visitante = req.cookies.get('bx_v')?.value;
  if (!visitante || !/^[a-f0-9-]{36}$/.test(visitante)) {
    visitante = crypto.randomUUID();
    resposta.cookies.set('bx_v', visitante, comum);
  }

  // Primeira origem vence e nunca é sobrescrita: quem chegou pelo anúncio e
  // voltou depois digitando o endereço continua sendo venda do anúncio.
  const de = req.nextUrl.searchParams.get('de');
  const limpo = de
    ? de.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
    : null;

  if (limpo && !req.cookies.get('bx_de')?.value) {
    resposta.cookies.set('bx_de', ORIGENS.has(limpo) ? limpo : 'outro', comum);
  }

  /**
   * A raiz entrega a página de vendas para quem vem de rede social.
   *
   * É **rewrite**, não redirect: a barra de endereço continua mostrando
   * `bruxario.com.br`, que é o link que a pessoa clicou e o que ela vai
   * repassar. Um redirect trocaria a URL na cara dela no meio do carregamento
   * e ainda gastaria um ida-e-volta a mais na conexão do celular.
   *
   * Só vale para a raiz, e só nesta chegada — quem já está navegando pelo site
   * e volta para `/` continua vendo a página expositiva.
   */
  const naRaiz = req.nextUrl.pathname === '/';
  const deVendas = limpo ? ORIGENS_DE_VENDAS.has(limpo) : false;

  /**
   * Link de campanha (`?c=ig01`) é tráfego pago por definição — ele só existe
   * porque alguém pagou para publicá-lo. Vai para a página de vendas sempre,
   * sem depender da lista de origens.
   *
   * O toque em si NÃO é gravado aqui: o proxy roda no runtime Edge, onde não
   * existe SQLite, e responde a robô de rede social e a pré-carregamento do
   * Next — que não são pessoas. Quem grava é `/api/visita`, chamado pelo
   * `Farejador` depois que o JavaScript roda.
   */
  const temCampanha = /^[a-z0-9]{2,4}$/i.test(
    req.nextUrl.searchParams.get('c') ?? ''
  );

  /**
   * Link de indicação também vai para a página de vendas.
   *
   * Quem recebe o link de uma amiga não conhece o produto — está no mesmo
   * estado mental de quem viu um anúncio, e a página expositiva pede uma
   * decisão que ela ainda não tem como tomar.
   */
  const temIndicacao = /^[a-f0-9]{6,8}$/i.test(
    req.nextUrl.searchParams.get('s') ?? ''
  );

  /**
   * O proxy NÃO escolhe mais o funil.
   *
   * Ele rodava no runtime Edge, onde não existe banco — então a escolha
   * precisava caber numa regra estática, e foi daí que nasceram `/atravessar`,
   * `/familiar` e o `?f=`: três endereços dizendo a mesma coisa porque o único
   * lugar que decidia não conseguia perguntar nada.
   *
   * Agora quem decide é a raiz (`app/page.tsx`), que é componente de servidor
   * e lê a campanha no banco. O proxy voltou a fazer só o que o Edge faz bem:
   * carimbar cookie de visitante e de origem, barato e em toda requisição.
   */
  return resposta;
}
