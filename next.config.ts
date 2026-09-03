import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  async redirects() {
    return [
      /**
       * As duas outras portas de funil viram a página de vendas.
       *
       * ── O que elas eram ───────────────────────────────────────────────
       *
       * `/atravessar` era o funil de sete perguntas (três perguntas, uma
       * revelação por grupo, o preço antes do teste) e `/familiar` o ritual
       * longo. Duas apostas de que dá para vender com menos atrito, feitas
       * quando as 26 cenas converteram zero numa campanha de agosto.
       *
       * ── Por que saem ──────────────────────────────────────────────────
       *
       * Porque as apostas perderam. Quem vende é o teste inteiro, e não é
       * coincidência: **as 26 cenas são o melhor qualificador de lead que
       * existe aqui**. Quem atravessa vinte e seis cenas já decidiu que quer o
       * resultado; quem responde três está passeando.
       *
       * Os funis em si não morrem — continuam no registro de `lib/funis.ts`,
       * `ativo: false`, com o histórico legível. O que morre é o endereço
       * publicado, porque endereço publicado é por onde entra tráfego pago.
       *
       * ── Para `/vendas`, e não para `/` ────────────────────────────────
       *
       * A raiz sem marcador é a landing explicativa, que é o material que não
       * pode aparecer na frente de tráfego frio. `/vendas` é a primeira cena
       * direto — ver o comentário em `app/vendas/page.tsx`.
       *
       * `permanent: false` de propósito: 308 fica gravado no navegador da
       * pessoa e não sai mais nem depois de a rota voltar. Enquanto isto é uma
       * decisão de funil, e não uma mudança de endereço definitiva, o
       * temporário é o honesto. A query vai junto, então `?c=`, os UTMs e o
       * `?e=rm` chegam inteiros do outro lado.
       */
      {
        source: "/atravessar",
        destination: "/vendas",
        permanent: false,
      },
      {
        source: "/familiar",
        destination: "/vendas",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
