import db from './db';
import type { Cobranca } from '../nucleo/cobrancas';
import { buscarPlano } from '../nucleo/planos';
import { nomeDaConta } from './acesso-plataforma';
import { rastreioDaCampanha } from './reportar-venda';
import {
  reportarPedido,
  metodoParaUtmify,
  type StatusUtmify,
  type ParametrosDeRastreio,
} from './utmify';

/**
 * A venda de assinatura, contada onde as vendas são contadas.
 *
 * ── O buraco que isto fecha ───────────────────────────────────────────────
 *
 * `reportarVenda` só sabe falar de `pedidos`. A cobrança de plano retorna do
 * webhook antes de chegar naquele ramo, então **nenhuma assinatura jamais foi
 * reportada à UTMify** — nem a primeira, nem as seguintes. Em 01/09 a primeira
 * assinatura paga de verdade entrou e não apareceu no painel da agência por
 * caminho nenhum.
 *
 * ── Por que a renovação também vem por aqui ───────────────────────────────
 *
 * Porque para a UTMify ela é uma venda: dinheiro que entrou, numa data, de uma
 * campanha. Sem isso, um assinante de seis meses aparece como uma venda só, e
 * a agência calcula o retorno da campanha sobre um sexto do que ela trouxe.
 *
 * O `orderId` é o id da cobrança — e a renovação é uma cobrança nova (ver
 * `registrarRenovacao`), então cada mês entra como uma linha própria. Fosse o
 * id da assinatura, a UTMify agruparia os seis meses num pedido só e
 * sobrescreveria o valor.
 *
 * ── Nunca lança, mas DIZ se deu certo ─────────────────────────────────────
 *
 * Roda dentro do webhook que ENTREGA o acesso. Rastreio quebrado é relatório
 * com buraco; rastreio que lança é uma pessoa que pagou e não entrou.
 *
 * Devolver `false` em vez de `void` é o que separa "engoli o erro" de
 * "escondi o erro". Enquanto ela não devolvia nada, o script de reenvio
 * imprimia ✓ para uma venda que a UTMify tinha recusado com 400 — e a única
 * pista era uma linha de log no meio de outras.
 */
export async function reportarAssinatura(
  cobranca: Cobranca,
  status: StatusUtmify,
  extras: { metodo?: string | null; taxaCentavos?: number | null; aprovadoEm?: Date } = {}
): Promise<boolean> {
  try {
    if (!cobranca.email) return false;

    const plano = buscarPlano(cobranca.plano_id);

    /**
     * O valor cobrado de verdade, e o do plano só como último recurso.
     *
     * A ordem importa na renovação: se o preço do plano subir, os meses já
     * cobrados continuam valendo o que foram cobrados. Mandar o preço de
     * tabela reescreveria a receita do passado toda vez que a tabela mudasse.
     */
    const valorCentavos = cobranca.bruto_centavos ?? cobranca.valor_centavos;

    let rastreio: ParametrosDeRastreio = {};
    try {
      if (cobranca.utm_json) rastreio = JSON.parse(cobranca.utm_json);
    } catch {
      // UTM malformado não pode impedir a venda de ser reportada.
    }

    /*
      Sem UTM na URL, a campanha ainda sabe se identificar — é o mesmo
      preenchimento que salvou a venda de 27/08 do lado dos pedidos.
    */
    if (!rastreio.utm_campaign && cobranca.campanha_id) {
      rastreio = { ...rastreio, ...rastreioDaCampanha(cobranca) };
    }

    const aceito = await reportarPedido({
      /*
        Assinatura é cobrada pelo roteador de gateway como qualquer venda, e
        hoje isso quer dizer Wiven. `cobrancas` não guarda qual gateway cobrou
        — quando guardar, este campo passa a sair de lá.
      */
      plataforma: process.env.UTMIFY_PLATAFORMA?.trim() || 'Wiven',
      orderId: cobranca.id,
      status,
      metodo: metodoParaUtmify(extras.metodo ?? cobranca.metodo),
      criadoEm: new Date(cobranca.criado_em),
      aprovadoEm: extras.aprovadoEm ?? (cobranca.pago_em ? new Date(cobranca.pago_em) : null),
      cliente: {
        nome: nomeDaConta(cobranca.email) || cobranca.email.split('@')[0],
        email: cobranca.email,
        ip: cobranca.ip_comprador,
      },
      produto: {
        id: cobranca.plano_id,
        nome: plano?.nome ?? cobranca.plano_id,
        precoCentavos: valorCentavos,
      },
      taxaCentavos: extras.taxaCentavos ?? cobranca.taxa_centavos ?? 0,
      rastreio,
    });

    anotarEnvio(cobranca.id, aceito ? null : `${status} recusado ou sem resposta`);
    return aceito;
  } catch (erro) {
    console.error('[utmify] reportar assinatura falhou:', erro);
    anotarEnvio(cobranca.id, String(erro).slice(0, 200));
    return false;
  }
}

/**
 * Grava o resultado do envio na própria cobrança — o espelho do que
 * `reportar-venda.ts` faz no pedido, e pelo mesmo motivo: enquanto a resposta
 * morria no `console`, "a UTMify está recebendo" era uma afirmação que
 * ninguém conseguia conferir.
 *
 * Nunca deixa exceção subir: falhar ao anotar um diagnóstico não pode custar
 * o acesso de quem pagou.
 */
function anotarEnvio(cobrancaId: string, erro: string | null): void {
  try {
    db.prepare(
      `UPDATE cobrancas
          SET utmify_em = CASE WHEN @erro IS NULL THEN @agora ELSE utmify_em END,
              utmify_erro = @erro
        WHERE id = @id`
    ).run({ id: cobrancaId, agora: new Date().toISOString(), erro });
  } catch (e) {
    console.error('[utmify] não consegui anotar o envio da assinatura:', e);
  }
}
