import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  /*
    ── Sem redirecionamentos de funil ──────────────────────────────────────

    Houve um momento hoje em que `/atravessar` e `/familiar` caíam em
    `/vendas`, para garantir que tráfego pago só encontrasse as 26 cenas. A
    intenção estava certa e o instrumento, errado: eles não são endereços
    duplicados da página de vendas, são **os endereços próprios de cada
    aposta de funil** — e é justamente por terem endereço próprio que dá para
    testar um deles com tráfego isolado, sem misturar com o resto.

    Quem garante que ninguém cai neles por acidente é o fato de não haver link
    nenhum apontando para lá: não estão no menu, não estão na landing, não
    saem em e-mail. Só chega quem recebeu o link de propósito.
  */

};

export default nextConfig;
