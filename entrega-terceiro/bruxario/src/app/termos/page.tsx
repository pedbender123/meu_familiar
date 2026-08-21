import Link from 'next/link';
import { PaginaLegal, Secao, Lista, Destaque } from '@/components/PaginaLegal';
import { LEGAL } from '@/lib/legal';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';
import { PRODUTOS, precoFormatado } from '@/lib/produtos';

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
          O ritual tem {TOTAL_DE_ITENS} cenas e é gratuito. O que se compra é a
          leitura escrita sobre você:
        </p>
        <Lista
          itens={[
            <>
              <strong className="font-medium">
                {`${PRODUTOS.revelacao.nome} — R$ ${precoFormatado(PRODUTOS.revelacao)}`}
              </strong>
              : o seu familiar, a leitura, a carta, o PDF e as imagens. O PDF
              chega no seu e-mail e é seu para sempre; o link da revelação, que
              permite outra pessoa abrir, dura{' '}
              {PRODUTOS.revelacao.diasDeLinkPublico} dias.
            </>,
          ]}
        />
        <Destaque>
          É <strong className="font-medium">compra única</strong>. Não existe
          assinatura, não existe cobrança recorrente e não existe conta para
          criar — o que você compra chega por e-mail.
        </Destaque>
      </Secao>

      <Secao titulo="Pagamento">
        <p>
          O processamento é feito por um provedor de pagamento externo. A
          entrega acontece depois da confirmação: Pix costuma confirmar na
          hora; boleto pode levar até três dias úteis.
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
          Peça pelo{' '}
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
          Fora da janela de arrependimento não há reembolso automático — o
          texto é entregue na hora e não tem como ser devolvido. Mas se algo
          deu errado de verdade, escreva: problema de entrega, cobrança em
          duplicidade ou leitura que não chegou a gente resolve.
        </p>
      </Secao>

      <Secao titulo="Conteúdo gerado por inteligência artificial">
        <p>
          A leitura é escrita por IA a partir das suas escolhas. Ela pode conter
          imprecisões e não deve ser tratada como verdade sobre você — trate como
          espelho, não como veredito. Quem decide o que fazer com o que leu é
          você.
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
