import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  async redirects() {
    return [
      /**
       * `/vendas` saiu do ar — e vira a raiz, que é o funil que vende.
       *
       * ── O que ela era ─────────────────────────────────────────────────
       *
       * A porta do funil de sete perguntas (`FunilDeVendas`): três perguntas,
       * uma revelação por grupo, e o preço antes do teste de verdade. Uma
       * aposta de que dá para vender com menos atrito, feita quando as 26
       * cenas converteram zero numa campanha de agosto.
       *
       * ── Por que ela sai ───────────────────────────────────────────────
       *
       * Porque a aposta perdeu. Quem vende é o funil das 26 cenas, e não é
       * coincidência: **o teste é o melhor qualificador de lead que existe
       * aqui**. Quem atravessa vinte e seis cenas já decidiu que quer o
       * resultado; quem responde três está passeando. Um caminho que continua
       * publicado enquanto não vende é dinheiro de anúncio caindo no funil
       * errado — e pior, num caminho que a campanha nem controla: `/vendas`
       * era rota fixa, fora do registro de `lib/funis.ts`, então a escolha de
       * funil da campanha não valia nada para quem entrava por ali.
       *
       * O funil de sete perguntas em si NÃO morre: ele continua no registro
       * como `atravessar`, e volta na hora em que uma campanha o escolher.
       * O que morre é o endereço publicado.
       *
       * ── Por que redirecionar, e não apagar ────────────────────────────
       *
       * Porque tem anúncio no ar apontando para lá. Um 404 perde o clique já
       * pago; o redirecionamento entrega a pessoa no funil certo. O Next leva
       * a query junto, então `?c=`, os UTMs e o `?e=rm` chegam inteiros do
       * outro lado — sem isso, tirar a página do ar apagaria a atribuição de
       * toda campanha que ainda usa o link antigo.
       *
       * `permanent: false` de propósito: 308 fica gravado no navegador da
       * pessoa e não sai mais nem depois de a rota voltar. Enquanto isto é
       * uma decisão de funil, e não uma mudança de endereço definitiva, o
       * temporário é o honesto.
       */
      {
        source: "/vendas",
        destination: "/",
        permanent: false,
      },

      /**
       * As outras duas portas de funil, pelo mesmo motivo.
       *
       * `/atravessar` era a continuação de `/vendas` (a segunda pergunta em
       * diante) e ficou órfã junto com ela; `/familiar` é o ritual longo. As
       * duas continuam existindo como código e como histórico — o que deixou
       * de existir é o endereço, porque endereço publicado é por onde entra
       * tráfego pago, e tráfego pago só tem um destino agora.
       *
       * A query vai junto: um anúncio antigo apontando para cá não perde
       * `?c=` nem os UTMs no caminho.
       */
      {
        source: "/atravessar",
        destination: "/",
        permanent: false,
      },
      {
        source: "/familiar",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
