'use client';

import { NOMES_DE_GATEWAY, ROTULO_DO_GATEWAY, type NomeDoGateway } from '@/nucleo/checkouts/nomes';

/**
 * Em qual conta cai o dinheiro desta campanha.
 *
 * ── Por que aqui, e não numa variável de ambiente ─────────────────────────
 *
 * Duas campanhas rodando ao mesmo tempo podem precisar cair em contas
 * diferentes — a do dono numa, a da agência noutra. Escolher isso é uma
 * decisão do mesmo tipo que escolher a página de vendas, e nenhuma das duas
 * devia exigir entrar na VPS.
 *
 * A primeira versão casava o nome da campanha contra o `utm_campaign` do
 * link, e era frágil: o link da Meta carrega o ID NUMÉRICO da campanha, não
 * o nome. Uma regra escrita pelo nome falharia calada — mandando a venda para
 * a conta errada sem erro nenhum no log.
 *
 * ── "Padrão" é uma escolha, não a ausência dela ───────────────────────────
 *
 * Deixar no padrão é dizer "siga o `.env`". É o que toda campanha antiga faz,
 * e é para onde se volta quando se quer desfazer.
 */

/** O que a diferença significa para quem está criando a campanha. */
const EXPLICACAO: Record<NomeDoGateway, string> = {
  mercadopago: 'Taxa baixa. O número do cartão nunca passa pelo nosso servidor.',
  cakto: 'Dormente — o Pix pela API exige o Cakto Banking, que não foi liberado.',
  wiven: 'Plaquinha e split entre contas. Taxa bem maior: 5,99% + R$ 1,99 por venda.',
};

export function EscolhaDeCheckout({
  valor,
  onChange,
}: {
  valor: NomeDoGateway | null;
  onChange: (v: NomeDoGateway | null) => void;
}) {
  const opcoes: { id: NomeDoGateway | null; nome: string; nota: string }[] = [
    {
      id: null,
      nome: 'Padrão do sistema',
      nota: 'Segue o que estiver configurado no servidor. É o que as campanhas antigas fazem.',
    },
    ...NOMES_DE_GATEWAY.map((g) => ({
      id: g as NomeDoGateway | null,
      nome: ROTULO_DO_GATEWAY[g],
      nota: EXPLICACAO[g],
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        Checkout que cobra esta campanha
      </span>

      {opcoes.map((o) => {
        const ativo = valor === o.id;
        return (
          <button
            key={o.id ?? 'padrao'}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={ativo}
            className={[
              'flex items-start gap-3 text-left rounded-lg px-3 py-2.5 border transition',
              ativo
                ? 'border-vela/50 bg-vela/10'
                : 'border-pergaminho/15 hover:border-pergaminho/30',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'flex items-center justify-center size-4 rounded-full shrink-0 border mt-0.5 transition',
                ativo ? 'border-vela bg-vela' : 'border-pergaminho/30',
              ].join(' ')}
            >
              {ativo && <span className="size-1.5 rounded-full bg-tinta" />}
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="font-corpo text-xs text-pergaminho">{o.nome}</span>
              <span className="font-corpo text-[11px] leading-snug text-pergaminho/45">
                {o.nota}
              </span>
            </span>
          </button>
        );
      })}

      {/*
        O aviso existe porque este campo move dinheiro. Errar aqui não gera
        erro nenhum — gera venda caindo na conta de outra pessoa, e a
        descoberta acontece no extrato, dias depois.
      */}
      {valor === 'wiven' && (
        <p className="font-corpo text-[11px] leading-relaxed text-vela/70 mt-1">
          As vendas desta campanha caem na conta da Wiven, e o split reparte o
          que estiver configurado no servidor. Confira antes de publicar o anúncio.
        </p>
      )}
    </div>
  );
}
