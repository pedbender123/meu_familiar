import { cookies } from 'next/headers';
import { Landing } from './LandingPrincipal';
import { FunilDeVendas } from './atravessar/FunilDeVendas';
import { RitualLongo } from './familiar/RitualLongo';
import { buscarCampanhaPorCodigo } from '@/lib/campanhas';
import {
  COOKIE_DO_FUNIL,
  FUNIL_PADRAO,
  FUNIS,
  ehFunil,
  funisDaCampanha,
  sortearEntre,
  type FunilId,
} from '@/lib/funis';
import { lerCodigoDeCampanha, normalizarOrigem } from '@/lib/rastreio';
import { FunilEscolhido } from '@/components/FunilEscolhido';
import { PortaDoRitual } from './PortaDoRitual';
import { modeloNovoLigado } from '@/lib/modelo-de-venda';

export const dynamic = 'force-dynamic';

/**
 * A raiz: um endereço só, e a campanha decide o que aparece.
 *
 * ── Por que a decisão mora aqui ───────────────────────────────────────────
 *
 * Ela morava no proxy, que roda no runtime Edge e não alcança o banco. Sem
 * poder perguntar nada, a única saída era codificar a escolha na URL — foi
 * assim que nasceram `/atravessar`, `/familiar` e o `?f=`: três endereços
 * dizendo a mesma coisa, e um link de anúncio que precisava ser trocado toda
 * vez que o teste mudava.
 *
 * Aqui é componente de servidor. Ele lê `?c=`, acha a campanha, e serve o que
 * ELA manda servir. O link do anúncio nunca muda; o que ele mostra, sim.
 *
 * ── Quem vê a landing ─────────────────────────────────────────────────────
 *
 * Quem chega sem marcação nenhuma: digitou o endereço, foi indicado por
 * alguém, ou está voltando depois de comprar. Essa pessoa não entra em teste
 * — a landing é justamente a página que responde as perguntas dela.
 *
 * ── Por que rende a página, e não redireciona ─────────────────────────────
 *
 * Redirect trocaria a URL na barra de endereço no meio do carregamento, e
 * gastaria uma ida-e-volta a mais na conexão do celular — no pior momento,
 * que é a primeira impressão.
 */
export default async function Raiz({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; de?: string; s?: string }>;
}) {
  const { c, de, s } = await searchParams;
  const biscoitos = await cookies();

  const { funil, viaMarcador } = await decidir({ c, de, s, biscoitos });

  /**
   * O funil escolhido viaja para o cliente, que o grava no cookie pela
   * `/api/visita` — mas SÓ quando a chegada teve marcador. Ver `decidir`
   * abaixo: sem `?c=`, `?de=` ou `?s=`, a raiz nunca lê nem grava o cookie de
   * funil, então `<FunilEscolhido>` nem é renderizado nesse caso.
   *
   * Componente de servidor não escreve cookie no meio de um render — só rota
   * e ação podem. E `/api/visita` já é chamada em toda página pelo
   * `Farejador`, então o carimbo pega carona numa requisição que existiria de
   * qualquer jeito, em vez de custar uma nova.
   */
  return (
    <>
      {viaMarcador && <FunilEscolhido funil={funil} />}
      {funil === 'padrao' ? (
        /*
         * Tráfego marcado no funil `padrao` abre DIRETO na primeira cena.
         *
         * A landing explicativa ficava entre o anúncio e a pergunta, e era
         * material demais para quem ainda não decidiu nada — os doze
         * familiares, o método, a tabela de planos. Tudo isso deixa o cérebro
         * calcular o que vem no fim antes de chegar lá, e quem calcula fecha a
         * aba. A `/vendas` já tinha aprendido isso no funil de sete perguntas.
         *
         * Sem marcador (`viaMarcador` falso), a landing continua: ali é quem
         * digitou o endereço, foi indicado ou já é cliente, e essa pessoa
         * precisa das respostas — e do link de login, que só existe lá.
         */
        viaMarcador && modeloNovoLigado() ? (
          <PortaDoRitual />
        ) : (
          <Landing />
        )
      ) : funil === 'familiar' ? (
        <RitualLongo />
      ) : (
        <FunilDeVendas />
      )}
    </>
  );
}

/**
 * Qual funil serve esta chegada.
 *
 * ── A raiz sem marcador é sempre a landing ────────────────────────────────
 *
 * `/` puro — sem `?c=`, `?de=` nem `?s=` — é a via universal de volta ao
 * site: é o endereço que fica salvo, que se digita de cabeça, que se manda
 * pra alguém sem link de campanha junto. Ele NUNCA consulta nem grava o
 * cookie de funil. Antes disso ser corrigido, uma visita antiga marcada
 * deixava o cookie preso e sequestrava até a digitação pura do domínio — e
 * pior, a própria visita pura gravava o cookie e podia depois sequestrar uma
 * campanha nova. Os dois sentidos eram bug.
 *
 * ── Com marcador, a ordem é ───────────────────────────────────────────────
 *
 *  1. **O cookie**, se esta chegada já tem um. Existe só para não sortear de
 *     novo o A/B a cada recarregada da mesma sessão marcada — não para
 *     grudar em visitas futuras sem marcador nenhum.
 *  2. **A campanha do `?c=`**. Uma página só: todo mundo vê aquela. Mais de
 *     uma: sorteia entre elas e gruda.
 *  3. **Origem de rede social sem campanha** (`?de=instagram`, link antigo já
 *     publicado que não dá para editar): cai no funil que a campanha mais
 *     recente estiver usando, para não ficar fora do teste que está no ar.
 *  4. **Marcador que não resolveu em nada**: landing, mas ainda marcado — o
 *     cookie é gravado assim mesmo, pra não ficar re-sorteando a cada
 *     recarregada de quem clicou um link de campanha apagada.
 */
async function decidir({
  c,
  de,
  s,
  biscoitos,
}: {
  c?: string;
  de?: string;
  s?: string;
  biscoitos: Awaited<ReturnType<typeof cookies>>;
}): Promise<{ funil: FunilId; campanha: string | null; viaMarcador: boolean }> {
  const { campanha: codigo } = lerCodigoDeCampanha(c);
  const marcadoPorRede = !!normalizarOrigem(de) || !!s;
  const temMarcador = !!codigo || marcadoPorRede;

  if (!temMarcador) {
    return { funil: FUNIL_PADRAO, campanha: null, viaMarcador: false };
  }

  const guardado = biscoitos.get(COOKIE_DO_FUNIL)?.value;
  if (ehFunil(guardado)) {
    return { funil: guardado, campanha: null, viaMarcador: true };
  }

  if (codigo) {
    const camp = buscarCampanhaPorCodigo(codigo);
    if (camp) {
      const lista = funisDaCampanha(camp.funis);
      return {
        funil: lista.length === 1 ? lista[0] : sortearEntre(lista),
        campanha: camp.id,
        viaMarcador: true,
      };
    }
  }

  /**
   * Link de rede social ou de indicação, sem campanha.
   *
   * Estes links já estão publicados em lugares que não dá para editar — a bio
   * do perfil, stories antigos, mensagens repassadas. Mandá-los para a landing
   * os deixaria de fora do que está sendo testado; mandá-los para um funil
   * fixo os congelaria numa escolha velha. Então eles seguem a campanha mais
   * recente que declarou funis.
   */
  if (marcadoPorRede) {
    const recente = campanhaMaisRecenteComFunis();
    if (recente) {
      const lista = funisDaCampanha(recente);
      return {
        funil: lista.length === 1 ? lista[0] : sortearEntre(lista),
        campanha: null,
        viaMarcador: true,
      };
    }
  }

  return { funil: FUNIL_PADRAO, campanha: null, viaMarcador: true };
}

function campanhaMaisRecenteComFunis(): string | null {
  const { listarCampanhas } = require('@/lib/campanhas') as typeof import('@/lib/campanhas');
  const viva = listarCampanhas().find((x) => x.funis && (!x.fim || new Date(x.fim) > new Date()));
  return viva?.funis ?? null;
}

export { FUNIS };
