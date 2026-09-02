import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { registrarVisita } from '@/lib/analitica';
import {
  COOKIE_ATRIBUICAO,
  deveSubstituir,
  lerAtribuicao,
  lerToque,
  normalizarOrigem,
  origemDoReferer,
  serializarAtribuicao,
} from '@/lib/rastreio';
import { registrarToque, toqueRecenteIgual } from '@/lib/toques';
import {
  buscarCampanhaPorCodigo,
  buscarPeca,
  campanhaDoUtm,
  pecaDoUtm,
} from '@/lib/campanhas';
import { buscarPedidoPorCodigoCurto } from '@/lib/db';
import { COOKIE_DO_FUNIL, ehFunil } from '@/lib/funis';
import { anotarIdentidade } from '@/lib/identidade';

/**
 * Recebe uma página vista.
 *
 * ── Por que uma chamada do navegador, e não o servidor contando sozinho ───
 *
 * Contar no render parece mais simples e é pior: robô de rede social, robô de
 * busca e o pré-carregamento do próprio Next disparam render sem ninguém ter
 * olhado nada. Exigir que o JavaScript rode filtra quase tudo isso de graça —
 * é o mesmo motivo pelo qual toda ferramenta de analítica faz assim.
 *
 * ── Os dois cookies ───────────────────────────────────────────────────────
 *
 * `bx_v` é o visitante: um id aleatório, sem relação com identidade nenhuma,
 * que só serve para separar "20 visitas" de "20 pessoas".
 *
 * `bx_de` é a origem, gravada na PRIMEIRA visita e nunca sobrescrita depois.
 * Isso é deliberado: se alguém chega pelo TikTok, sai, e volta digitando o
 * endereço, a venda é do TikTok. Deixar a última visita sobrescrever daria o
 * crédito ao "direto" e faria toda campanha parecer pior do que é.
 *
 * `bx_at` é a atribuição completa — campanha, peça, indicação e como o
 * crédito foi decidido. `bx_de` continua existindo ao lado dele porque os
 * pedidos antigos foram gravados com ele, e apagá-lo reescreveria a história.
 *
 * ── Por que o toque é registrado AQUI e não no proxy ──────────────────────
 *
 * O proxy roda no runtime Edge, onde não existe better-sqlite3. Além disso o
 * proxy responde a robô de rede social e a pré-carregamento do Next, que não
 * são pessoas — e um toque falso é pior que um toque perdido, porque entra na
 * conta de aquisição de uma campanha.
 */
const ANO = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  let corpo: {
    caminho?: string;
    de?: string;
    c?: string;
    utmCampanha?: string;
    utmConteudo?: string;
    utmConjunto?: string;
    /** `utm_medium`. Algumas agências mandam o conjunto de anúncios aqui. */
    utmMeio?: string;
    s?: string;
    e?: string;
    referencia?: string;
    largura?: number;
    funil?: string;
    url?: string;
    fbclid?: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Caminho vem do cliente, então é tratado como texto hostil: cortado, sem
  // query string (que pode carregar dado pessoal em links compartilhados) e
  // limitado a um tamanho que não enche a tabela.
  const caminho = String(corpo.caminho ?? '/')
    .split('?')[0]
    .slice(0, 120);

  const visitanteExistente = req.cookies.get('bx_v')?.value;
  const visitante =
    visitanteExistente && /^[a-f0-9-]{36}$/.test(visitanteExistente)
      ? visitanteExistente
      : randomUUID();

  /**
   * O tracker próprio: anota quem é este navegador e de onde ele veio.
   *
   * `_fbp` e `_fbc` são cookies de PRIMEIRA PARTE no nosso domínio, então
   * chegam aqui sozinhos, no header `Cookie` — não é preciso o navegador
   * disparar nada para lê-los. É o que permite mandar `Purchase` do servidor
   * amanhã, pelo webhook, com o identificador de quem clicou no anúncio hoje.
   *
   * Nunca derruba a visita: rastreio quebrado não pode custar uma página.
   */
  try {
    anotarIdentidade({
      visitante,
      fbp: req.cookies.get('_fbp')?.value ?? null,
      fbc: req.cookies.get('_fbc')?.value ?? null,
      fbclid: corpo.fbclid ?? null,
      urlEntrada: corpo.url ?? null,
      referer: corpo.referencia ?? null,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  } catch (erro) {
    console.error('[visita] identidade falhou:', erro);
  }

  const origemExistente = req.cookies.get('bx_de')?.value ?? null;
  /**
   * `outro` é um CHUTE, não uma resposta — normalmente vem de um `utm_source`
   * que a plataforma de anúncio manda abreviado (ver `ALIAS_DE_ORIGEM` em
   * `lib/rastreio.ts`) e que não bate com nada conhecido. Deixar ele vencer
   * o referrer (que muitas vezes SABE de verdade, tipo `instagram.com`)
   * transformava tráfego de anúncio real em "Outros" no relatório. Só um
   * valor RECONHECIDO pode vencer sem consultar o referrer.
   */
  const declarada = normalizarOrigem(origemExistente) ?? normalizarOrigem(corpo.de);
  const doReferer = origemDoReferer(corpo.referencia);
  const origem = declarada && declarada !== 'outro' ? declarada : (doReferer ?? declarada);

  const largura = Number(corpo.largura);
  const dispositivo = !Number.isFinite(largura)
    ? null
    : largura < 640
      ? 'celular'
      : largura < 1024
        ? 'tablet'
        : 'computador';

  /**
   * O toque: o que trouxe a pessoa NESTA chegada.
   *
   * Roda antes da visita porque é ele que pode atualizar a atribuição, e a
   * visita grava a origem já decidida.
   */
  const toque = lerToque({
    c: corpo.c,
    s: corpo.s,
    e: corpo.e,
    de: corpo.de,
    referer: corpo.referencia ?? null,
  });

  /**
   * A campanha desta chegada, por dois caminhos.
   *
   * ── O `?c=` ganha, e isto foi revertido uma vez ───────────────────────
   *
   * Em 01/09 esta ordem chegou a ser invertida: o ID da Meta passaria a
   * vencer o `?c=`, porque medindo o banco dava para ver três campanhas do
   * gerenciador caindo dentro de uma campanha nossa.
   *
   * A medição estava certa e a conclusão estava errada, por confundir duas
   * coisas com o mesmo nome. **Campanha aqui não é campanha de mídia.** É um
   * recorte interno do funil — serve para filtrar o que aconteceu no site
   * dentro de uma janela, e quem decide o recorte é quem monta o link. O
   * painel não gerencia marketing, e não é ele que fala com a UTMify: quem
   * fala é `reportarVenda`, mandando o `utm_json` cru, que nunca passa por
   * aqui.
   *
   * Deixar o ID da Meta mandar encheu o painel de linhas com nome de número,
   * uma por campanha do gerenciador, quebrando exatamente o recorte que o
   * dono usa para ler o próprio funil.
   *
   * Então: **o `?c=` é explícito e ganha.** Alguém montou aquele link à mão,
   * para um lugar específico — bio, indicação, teste, um combinado com um
   * sócio. O UTM continua criando campanha quando é a única coisa que
   * existe, que é o caso do tráfego que chega sem link nosso.
   */
  const campanha =
    (toque.codigoCampanha ? buscarCampanhaPorCodigo(toque.codigoCampanha) : undefined) ??
    campanhaDoUtm(corpo.utmCampanha, origem);

  /*
    O `utm_medium` entra junto na busca do conjunto: nem toda agência põe o
    `{{adset.id}}` no `utm_term`, e ler só um campo agrupava os criativos por
    posicionamento achando que era conjunto. Isto é recorte interno, como o
    resto — não muda nada do que a UTMify recebe.
  */
  const peca = !campanha
    ? undefined
    : ((toque.codigoPeca ? buscarPeca(campanha.id, toque.codigoPeca) : undefined) ??
      pecaDoUtm(campanha.id, corpo.utmConteudo, corpo.utmConjunto, corpo.utmMeio));

  const indicador = toque.codigoIndicacao
    ? buscarPedidoPorCodigoCurto(toque.codigoIndicacao)
    : undefined;

  /**
   * Chegou por campanha é chegar por campanha, com `?c=` ou sem.
   *
   * `lerToque` só sabe classificar como `campanha` quem trouxe o nosso código
   * na URL — ele não vê o UTM. Sem esta linha, o tráfego pago da Meta (que
   * traz `utm_source=ig`) entraria como **rede social**, e o relatório
   * mostraria anúncio pago somado ao alcance orgânico do Instagram: dois
   * canais com custo e significado opostos no mesmo balde.
   *
   * A campanha resolvida é a prova. Se ela existe, foi campanha.
   */
  const tipoDoToque = campanha ? 'campanha' : toque.tipo;

  // Campanha manda na origem: o código não diz a plataforma, a campanha diz.
  const origemDoToque =
    tipoDoToque === 'campanha' ? (campanha?.plataforma ?? 'anuncio') : toque.origem;

  try {
    // Um por tipo a cada meia hora — sem isso, recarregar a página vira toque.
    if (!toqueRecenteIgual(visitante, tipoDoToque)) {
      registrarToque({
        visitante,
        tipo: tipoDoToque,
        origem: origemDoToque,
        campanhaId: campanha?.id ?? null,
        pecaId: peca?.id ?? null,
        indicadoPor: indicador?.id ?? null,
        // Código de campanha que não existe no banco não pode contar como
        // aquisição: seria creditar uma campanha inventada na URL.
        contaAquisicao:
          toque.contaAquisicao && (tipoDoToque !== 'campanha' || !!campanha),
        caminho,
        referencia: dominioDe(corpo.referencia),
      });
    }
  } catch (erro) {
    console.error('[api/visita] toque', erro);
  }

  try {
    registrarVisita({
      visitante,
      caminho,
      origem,
      // Só o domínio de onde veio, nunca a URL inteira: a URL pode carregar
      // identificadores do outro site, e o domínio já responde a pergunta.
      referencia: dominioDe(corpo.referencia),
      dispositivo,
      // O toque, não o crédito: `deveSubstituir` pode recusar este clique, e
      // é justamente o clique recusado que se quer poder auditar depois.
      campanha_id: campanha?.id ?? null,
      peca_id: peca?.id ?? null,
    });
  } catch (erro) {
    // Analítica nunca pode derrubar o site. Falhou, perdeu-se um ponto.
    console.error('[api/visita]', erro);
  }

  const resposta = NextResponse.json({ ok: true });
  const comum = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ANO,
  };

  resposta.cookies.set('bx_v', visitante, comum);

  /**
   * O funil que a raiz decidiu, grudado na pessoa.
   *
   * Primeiro carimbo vence: uma vez sorteada, ela fica no mesmo funil até o
   * cookie expirar. Deixar um carregamento posterior sobrescrever devolveria
   * o problema que este cookie existe para resolver.
   */
  if (ehFunil(corpo.funil) && !req.cookies.get(COOKIE_DO_FUNIL)?.value) {
    resposta.cookies.set(COOKIE_DO_FUNIL, corpo.funil, comum);
  }
  // `outro` não trava o cookie: é um chute, não uma origem de verdade. Travar
  // ele faria toda visita seguinte da mesma sessão herdar "outro" via
  // `origemExistente`, mesmo quando o referrer da PRÓXIMA página souber a
  // resposta certa — foi exatamente o que inflava "Outros" no relatório.
  if (origem && origem !== 'outro' && !origemExistente) {
    resposta.cookies.set('bx_de', origem, comum);
  }

  /**
   * A atribuição só muda quando `deveSubstituir` deixa: o primeiro toque
   * vence, com duas exceções nomeadas — remarketing, e clique numa campanha
   * DIFERENTE da que estava creditada. Ver `lib/rastreio.ts`.
   */
  const atual = lerAtribuicao(req.cookies.get(COOKIE_ATRIBUICAO)?.value);
  if (deveSubstituir(atual, toque, campanha?.id ?? null)) {
    resposta.cookies.set(
      COOKIE_ATRIBUICAO,
      serializarAtribuicao({
        // O mesmo tipo que foi para `toques`: cookie dizendo "social" e
        // tabela dizendo "campanha" seria a mesma visita contada de dois
        // jeitos, e o dia em que os dois relatórios discordassem ninguém
        // saberia qual acreditar.
        tipo: tipoDoToque,
        origem: origemDoToque,
        campanhaId: campanha?.id ?? null,
        pecaId: peca?.id ?? null,
        indicadoPor: indicador?.id ?? null,
      }),
      comum
    );
  }

  return resposta;
}

function dominioDe(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.endsWith('bruxario.com.br') ? null : host.slice(0, 60);
  } catch {
    return null;
  }
}
