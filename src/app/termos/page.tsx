import Link from 'next/link';
import { PaginaLegal, Secao, Lista, Destaque } from '@/components/PaginaLegal';
import { LEGAL } from '@/lib/legal';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';
import { vitrineEmEscada, beneficiosDosDireitos, emReais } from '@/nucleo/vitrine';
import { escadaDaOferta } from '@/nucleo/oferta';

export const metadata = {
  title: 'Termos de uso — Bruxário',
  description: 'O que o Bruxário é, o que você leva, e como cancelar.',
};

/**
 * Termos de Uso.
 *
 * Duas decisões de redação que são jurídicas, não estilísticas:
 *
 * 1. **A natureza do serviço vem primeiro, em destaque.** Se alguém alegar que
 *    entendeu como serviço psicológico, a defesa é ter dito na primeira linha,
 *    de forma legível — não numa cláusula 14 em cinza claro.
 * 2. **O arrependimento de 7 dias é escrito como benefício.** É exigência do
 *    CDC (art. 49) de qualquer forma; escondê-lo em letra miúda só perde a
 *    chance de parecer confiável sem custo nenhum.
 *
 * E o que NÃO tem aqui: cláusula excluindo responsabilidade. Em relação de
 * consumo ela é nula (CDC art. 51) e só serve para dar má impressão e perder
 * na primeira reclamação.
 *
 * ── Os preços saem do BANCO, não do texto ─────────────────────────────────
 *
 * Até 19/08 esta página listava os produtos à mão, e o resultado foi o pior
 * tipo de erro que um termo de uso pode ter: ela afirmava "é compra única —
 * não existe assinatura nem cobrança recorrente" enquanto o checkout vendia um
 * plano mensal. Também dizia que o Oráculo não existia, e listava dois
 * produtos que tinham saído de venda.
 *
 * Termo de uso que contradiz o que o sistema faz não é desatualizado, é prova
 * contra a gente. Agora a lista vem de `vitrineEmEscada()` e `escadaDaOferta()`
 * — as mesmas funções que montam as telas de venda. Mudou o preço numa
 * migração, mudou aqui junto.
 */
export default function Termos() {
  /**
   * As listas vêm das mesmas funções que montam as telas de venda. Ver a nota
   * no topo do arquivo sobre por que isto não é escrito à mão.
   */
  const avulsas = escadaDaOferta().filter((i) => !i.recorrente);
  const planos = vitrineEmEscada().filter((i) => !i.anual);

  return (
    <PaginaLegal
      titulo="Termos de uso"
      resumo="O que o Bruxário é, o que você leva em cada plano, e como desistir."
    >
      <Secao titulo="O que o Bruxário é — e o que não é">
        <Destaque>
          O Bruxário é <strong className="font-medium">entretenimento e
          autoconhecimento simbólico</strong>. Não é serviço psicológico, médico,
          jurídico ou financeiro, e não substitui nenhum deles.
        </Destaque>
        <p>
          As perguntas se inspiram em modelos de personalidade estudados, mas o
          resultado <strong className="font-medium">não é um teste psicológico
          validado</strong> e não é diagnóstico de coisa nenhuma. Nada aqui
          prevê o futuro, cura, garante dinheiro, traz alguém de volta ou diz
          resultado de exame.
        </p>
        <p>
          Se você está passando por algo sério, procure ajuda de verdade. O CVV
          atende no <strong className="font-medium">188</strong>, de graça, 24
          horas.
        </p>
      </Secao>

      <Secao titulo="Quem pode usar">
        <p>
          {`Maiores de ${LEGAL.idadeMinima} anos.`} Ao usar o Bruxário você
          declara ter essa idade e que as informações que der são suas e
          verdadeiras.
        </p>
      </Secao>

      <Secao titulo="O que você leva">
        <p>
          O ritual tem {TOTAL_DE_ITENS} cenas e é gratuito. Descobrir o seu
          familiar — o nome e a imagem dele — não custa nada e continua seu.
        </p>
        <p>
          <strong className="font-medium">O que é grátis:</strong> o nome e a
          imagem do seu familiar, as métricas do seu teste, o dia de hoje no
          calendário, 1 leitura e 5 mensagens do Oráculo por mês. Tudo isso
          dentro da sua conta, e sem prazo para acabar.
        </p>
        <p>
          <strong className="font-medium">O texto da revelação</strong> — a
          leitura escrita sobre você — é o que se compra. Logo depois do ritual
          aparecem duas compras únicas:
        </p>
        <Lista
          itens={avulsas.map((item) => (
            <span key={item.plano.id}>
              <strong className="font-medium">
                {`${item.plano.nome} — ${emReais(item.plano.preco_centavos)}`}
              </strong>
              {`: ${beneficiosDosDireitos(item.direitos).join(', ')}. `}
              <span>
                Compra única, sem renovação — o acesso que ela abre não expira.
              </span>
            </span>
          ))}
        />
        <p>
          <strong className="font-medium">E os planos mensais</strong>, que
          abrem a plataforma inteira e{' '}
          <strong className="font-medium">renovam todo mês</strong> até você
          cancelar:
        </p>
        <Lista
          itens={planos.map((item) => (
            <span key={item.plano.id}>
              <strong className="font-medium">
                {`${item.plano.nome} — ${emReais(item.plano.preco_centavos)} por mês`}
              </strong>
              {`: ${item.beneficios.join(', ')}.`}
            </span>
          ))}
        />
        <Destaque>
          As cotas do Oráculo são <strong className="font-medium">por mês e
          por dia</strong>, e não acumulam: o que você não usar num mês não
          passa para o seguinte. O limite diário existe para o serviço não cair
          nas mãos de uso automatizado, e está escrito na sua conta.
        </Destaque>
      </Secao>

      <Secao titulo="Pagamento">
        <p>
          O processamento é feito pelo Mercado Pago. Nenhum dado de cartão passa
          pelos nossos servidores — o formulário é dele, não nosso.
        </p>
        <p>
          <strong className="font-medium">As compras únicas</strong> (as duas da
          lista acima) são cobradas uma vez só. Não há renovação, não há
          mensalidade escondida, e o acesso que elas abrem não expira.
        </p>
        <p>
          <strong className="font-medium">Os planos mensais são
          recorrentes.</strong> Você é cobrado a cada período enquanto não
          cancelar, sempre pelo mesmo valor que contratou. Se o preço do plano
          mudar, o seu só muda no ciclo seguinte e com aviso por e-mail antes —
          nunca no meio de um período já pago.
        </p>
        <p>
          A liberação acontece depois da confirmação do pagamento. Pix costuma
          confirmar na hora; boleto pode levar até três dias úteis.
        </p>
      </Secao>

      <Secao titulo="Cancelar a assinatura">
        <Destaque>
          Cancelar leva um pedido pelo{' '}
          <Link
            href={LEGAL.canalDeContato}
            className="text-ouro-profundo underline underline-offset-2"
          >
            contato
          </Link>
          , e vale na hora. Sem multa, sem carência, sem aviso prévio e sem tela
          de retenção.
        </Destaque>
        <p>
          Ao cancelar, você <strong className="font-medium">continua com
          acesso até o fim do período que já pagou</strong> — não cortamos no
          meio do mês que você comprou. Depois disso a conta volta ao plano
          gratuito: o seu familiar, a sua revelação já gerada e o seu histórico
          continuam lá. Você perde o alcance do calendário e as cotas maiores do
          Oráculo, não o que já era seu.
        </p>
      </Secao>

      <Secao titulo="Desistir nos primeiros 7 dias">
        <Destaque>
          Compra feita pela internet dá direito a desistir em até{' '}
          {LEGAL.diasDeArrependimento} dias, com devolução integral, sem precisar
          explicar por quê. É o art. 49 do Código de Defesa do Consumidor, e aqui
          vale mesmo que você já tenha lido tudo.
        </Destaque>
        <p>
          Vale para as compras únicas e também para a{' '}
          <strong className="font-medium">primeira cobrança</strong> de um plano
          mensal. Peça pelo{' '}
          <Link
            href={LEGAL.canalDeContato}
            className="text-ouro-profundo underline underline-offset-2"
          >
            contato
          </Link>
          , escolhendo &ldquo;Quero reembolso&rdquo;. Não tem formulário
          escondido, não tem ligação, não tem tela de retenção. O estorno volta
          pelo mesmo meio do pagamento e o prazo depende do banco.
        </p>
      </Secao>

      <Secao titulo="Depois dos 7 dias">
        <p>
          Fora da janela de arrependimento não há reembolso automático da compra
          única — o texto é entregue na hora e não tem como ser devolvido. Nos
          planos mensais, o cancelamento encerra as cobranças seguintes mas não
          devolve o mês corrente, que você usou.
        </p>
        <p>
          Mas se algo deu errado de verdade, escreva: problema de entrega,
          cobrança em duplicidade, cobrança depois de cancelar ou leitura que
          não chegou a gente resolve.
        </p>
      </Secao>

      <Secao titulo="Conteúdo gerado por inteligência artificial">
        <p>
          A leitura é escrita por IA a partir das suas escolhas. Ela pode conter
          imprecisões e não deve ser tratada como verdade sobre você — trate como
          espelho, não como veredito. Quem decide o que fazer com o que leu é
          você.
        </p>
        <p>
          O mesmo vale para o <strong className="font-medium">Oráculo</strong> e
          para o <strong className="font-medium">calendário</strong>. As cartas
          são sorteadas, as posições dos astros são calculadas de verdade, e o
          texto em volta é escrito por IA — nada disso prevê o futuro nem
          garante resultado nenhum. É leitura simbólica, do começo ao fim.
        </p>
        <p>
          O Oráculo guarda o que você conta para que as leituras seguintes façam
          sentido com as anteriores. Você pode pedir para apagar essa memória a
          qualquer momento pelo contato, sem perder a conta.
        </p>
      </Secao>

      <Secao titulo="Do que é de quem">
        <p>
          As ilustrações dos doze familiares, os textos do site, a marca e o
          desenho do teste são nossos. Você pode compartilhar livremente a sua
          revelação, as imagens e o PDF que recebeu — inclusive nas suas redes. O
          que não pode é revender, redistribuir como se fosse seu ou usar nossas
          ilustrações em outro produto.
        </p>
        <p>
          O que <strong className="font-medium">você</strong> escreve continua
          sendo seu. Se deixar um comentário, você nos autoriza a mostrá-lo no
          mural junto da sua revelação — e pode pedir para tirar quando quiser.
        </p>
      </Secao>

      <Secao titulo="O que não pode">
        <p>
          Automatizar acesso, raspar o site, tentar burlar o pagamento, revender
          o serviço, ou usar o canal de contato para enviar conteúdo ilegal.
          Nessas situações podemos suspender o acesso — avisando por e-mail e
          devolvendo o que for devido.
        </p>
      </Secao>

      <Secao titulo="Responsabilidade">
        <p>
          Fazemos o possível para o site funcionar e as entregas acontecerem, mas
          não garantimos disponibilidade ininterrupta — servidor cai, fornecedor
          falha, internet oscila. Se a entrega não acontecer, reprocessamos ou
          devolvemos o dinheiro.
        </p>
        <p>
          O que não assumimos é responsabilidade por decisões que você tomar a
          partir de uma leitura simbólica. É para isso que a primeira seção desta
          página existe.
        </p>
      </Secao>

      <Secao titulo="Lei e foro">
        <p>
          Valem as leis brasileiras. Sendo relação de consumo, você pode
          processar no foro do seu domicílio, como o CDC garante.
        </p>
      </Secao>
    </PaginaLegal>
  );
}
