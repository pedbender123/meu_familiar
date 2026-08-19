import Link from 'next/link';
import { PaginaLegal, Secao, Lista, Destaque } from '@/components/PaginaLegal';
import { LEGAL, TERCEIROS } from '@/lib/legal';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';

export const metadata = {
  title: 'Privacidade — Bruxário',
  description: 'O que o Bruxário guarda sobre você, por quê, e como apagar.',
};

/**
 * Política de Privacidade.
 *
 * Escrita em português comum de propósito. Documento que ninguém entende não
 * protege ninguém — nem a pessoa, que não sabe o que aceitou, nem você, porque
 * cláusula ilegível é a primeira a cair quando alguém questiona.
 *
 * Os dois pontos que quase toda política de produto pequeno esquece e que aqui
 * são obrigatórios: **transferência internacional** (o texto das respostas vai
 * para o Google, fora do Brasil) e **decisão automatizada** (art. 20 — o perfil
 * é calculado por algoritmo e a leitura é escrita por IA, então existe direito
 * a pedir revisão).
 */
export default function Privacidade() {
  return (
    <PaginaLegal
      titulo="Privacidade"
      resumo="O que guardamos sobre você, por que guardamos, e como apagar quando quiser."
    >
      <Secao titulo="Quem é responsável">
        <p>
          O Bruxário é operado por {LEGAL.controlador}, {LEGAL.natureza}. É uma
          operação pequena — não há departamento nem robô: quem lê e responde é
          uma pessoa.
        </p>
        <p>
          Para qualquer assunto sobre seus dados, incluindo os pedidos da seção
          &ldquo;Seus direitos&rdquo;, use{' '}
          <Link href={LEGAL.canalDeContato} className="text-ouro-profundo underline underline-offset-2">
            a página de contato
          </Link>
          . É o canal oficial, e todo pedido que chega por lá fica registrado.
        </p>
      </Secao>

      <Secao titulo="O que coletamos">
        <Lista
          itens={[
            <>
              <strong className="font-medium">Seu nome e e-mail</strong> — para
              montar a revelação, entregar por e-mail e dar acesso à sua conta.
            </>,
            <>
              <strong className="font-medium">Data, hora e cidade de
              nascimento</strong> — para calcular seus signos, a fase da lua e,
              com o lugar, o seu mapa natal e o calendário. A hora é opcional;
              sem ela assumimos meio-dia e marcamos o resultado como
              aproximado. Da cidade guardamos o nome que você escolheu e a
              coordenada da capital do seu estado, que é a precisão que o
              cálculo usa.
            </>,
            <>
              <strong className="font-medium">Suas {TOTAL_DE_ITENS} escolhas no
              ritual</strong> e o perfil calculado a partir delas (dois eixos
              principais, dois secundários e a proximidade com cada um dos doze
              familiares).
            </>,
            <>
              <strong className="font-medium">O texto da sua leitura</strong>,
              gerado a partir do que está acima.
            </>,
            <>
              <strong className="font-medium">O que você escrever</strong> — o
              recado guardado para o Oráculo, o comentário sobre a sua revelação
              e as mensagens que mandar pelo contato.
            </>,
            <>
              <strong className="font-medium">Dados técnicos</strong> — endereço
              IP e registros de acesso, usados para limitar abuso (impedir que
              alguém dispare mil pedidos seguidos) e investigar problemas.
            </>,
            <>
              <strong className="font-medium">Medição de acesso</strong> — que
              páginas foram abertas, até que ponto do ritual você chegou, de
              qual rede social você veio e se o aparelho é celular ou
              computador. Essa contagem é nossa, fica no nosso servidor, e o
              endereço IP não é guardado junto dela. Não usamos Google
              Analytics.
            </>,
            <>
              <strong className="font-medium">Medição de anúncio pela
              Meta</strong> — se você chegou por um anúncio no Facebook ou no
              Instagram, o site avisa a Meta quando você abre uma página, começa
              o ritual e quando compra. Parte disso sai do seu navegador (o
              &ldquo;pixel&rdquo;) e parte sai do nosso servidor, e nas duas o
              seu e-mail vai transformado em{' '}
              <strong className="font-medium">código irreversível</strong> — a
              Meta usa para casar a venda com o anúncio, e não recebe o seu
              e-mail legível. É o único medidor de terceiro que existe aqui, e
              ele existe porque sem medir o anúncio não há como anunciar.
            </>,
            <>
              <strong className="font-medium">Seu @ do Instagram</strong>, se
              você registrar para receber a recompensa por compartilhar. Usado
              só para conferir a marcação e liberar o bônus.
            </>,
          ]}
        />
        <Destaque>
          Não pedimos e não guardamos CPF nem dado de cartão. Isso fica com o
          Mercado Pago, na tela de pagamento — não passa pelos nossos
          servidores.
        </Destaque>
      </Secao>

      <Secao titulo="Por que podemos usar cada coisa">
        <p>
          A LGPD exige dizer a base legal de cada uso. As nossas:
        </p>
        <Lista
          itens={[
            <>
              <strong className="font-medium">Para cumprir o que você
              comprou</strong> (execução de contrato) — nome, e-mail,
              nascimento, respostas, leitura e conta.
            </>,
            <>
              <strong className="font-medium">Com o seu consentimento</strong> —
              publicar o seu comentário no mural. Ele só aparece se você
              escrever e nós aprovarmos, e some se você pedir.
            </>,
            <>
              <strong className="font-medium">Interesse legítimo</strong> —
              dados técnicos para segurança e para impedir abuso, e a medição de
              acesso para entender o que funciona e melhorar o serviço.
            </>,
            <>
              <strong className="font-medium">Obrigação legal</strong> —
              registros de venda, pelo prazo que a lei exigir.
            </>,
          ]}
        />
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <p>
          Só com quem é necessário para o serviço funcionar. Não vendemos e não
          cedemos seus dados para ninguém anunciar nada.
        </p>
        <Lista
          itens={TERCEIROS.map((t) => (
            <>
              <strong className="font-medium">{t.nome}</strong> — {t.para}.
              Recebe: {t.oQue}.
              {t.fora && (
                <span className="text-ouro-profundo"> Processa fora do Brasil.</span>
              )}
            </>
          ))}
        />
      </Secao>

      <Secao titulo="Seus dados saem do Brasil?">
        <p>
          Em parte, sim, e a lei manda avisar. O texto das suas escolhas no
          ritual é enviado ao <strong className="font-medium">Google</strong>{' '}
          para gerar a leitura, e o processamento acontece em servidores fora do
          país. O envio é feito por conexão criptografada e sob os termos
          contratuais do fornecedor.
        </p>
        <p>
          Os dados de medição de anúncio vão para a{' '}
          <strong className="font-medium">Meta</strong>, também fora do país —
          incluindo o seu e-mail em forma de código irreversível, quando você
          compra.
        </p>
        <p>
          O que fica no Brasil: a hospedagem, o banco de dados e o envio de
          e-mails.
        </p>
      </Secao>

      <Secao titulo="Decisões tomadas por máquina">
        <p>
          Duas coisas aqui são decididas sem intervenção humana, e você tem
          direito de saber e de pedir revisão (LGPD, art. 20):
        </p>
        <Lista
          itens={[
            <>
              <strong className="font-medium">Qual familiar te encontrou</strong>{' '}
              — é calculado a partir das suas escolhas, por um método que está
              publicado na página inicial. Seu signo tem peso zero nessa conta.
              Quando dois ficam empatados de verdade, quem escolhe é você.
            </>,
            <>
              <strong className="font-medium">O texto da leitura</strong> — é
              escrito por inteligência artificial a partir do seu perfil. Pode
              conter imprecisões, e quem decide o que fazer com ele é você.
            </>,
          ]}
        />
        <p>
          Se achou que o resultado não faz sentido, escreva pelo contato. A
          gente revisa e explica como chegou ali.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          Você pode, a qualquer momento e sem justificar: confirmar que temos
          dados seus, ver quais são, corrigir o que estiver errado, pedir uma
          cópia, revogar consentimentos, saber com quem compartilhamos e{' '}
          <strong className="font-medium">pedir que apaguemos tudo</strong>.
        </p>
        <p>
          É pelo{' '}
          <Link href={LEGAL.canalDeContato} className="text-ouro-profundo underline underline-offset-2">
            contato
          </Link>
          , escolhendo o assunto &ldquo;Meus dados pessoais&rdquo;. Respondemos
          no menor prazo que conseguirmos.
        </p>
        <Destaque>
          Apagar é apagar de verdade: sua conta, suas revelações, o perfil
          calculado e o que você escreveu saem do banco. O que fica são os
          registros de venda que a lei obriga a guardar.
        </Destaque>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Enquanto sua conta existir, porque é o que permite você reabrir sua
          revelação anos depois. Se pedir para apagar, apagamos. Registros
          fiscais de compras ficam pelo prazo legal, mesmo depois disso.
        </p>
      </Secao>

      <Secao titulo="Idade mínima">
        <p>
          {`O Bruxário é para maiores de ${LEGAL.idadeMinima} anos.`} Não
          coletamos dados de crianças e adolescentes de propósito. Se descobrirmos que
          isso aconteceu, apagamos.
        </p>
      </Secao>

      <Secao titulo="Segurança">
        <p>
          O site roda sob HTTPS, as senhas não existem (o acesso é por link
          enviado ao seu e-mail) e os tokens de acesso ficam guardados apenas
          como impressão criptográfica — nem nós conseguimos lê-los.
        </p>
        <p>
          Dito isso, nenhum sistema é invulnerável, e não vamos inventar
          certificação que não temos. Se algo acontecer com seus dados, você
          será avisado.
        </p>
      </Secao>

      <Secao titulo="Cookies">
        <p>Quatro são nossos, e o site também carrega os da Meta:</p>
        <Lista
          itens={[
            <>
              <strong className="font-medium">O de sessão</strong> — mantém você
              logado depois de clicar no link de acesso. Sair da conta o apaga.
            </>,
            <>
              <strong className="font-medium">O de contagem</strong> — um número
              aleatório, sem nome nem e-mail, que serve só para não contarmos a
              mesma pessoa como dez visitantes diferentes.
            </>,
            <>
              <strong className="font-medium">O de origem</strong> — guarda de
              qual link você chegou (TikTok, Instagram), para sabermos o que
              está funcionando.
            </>,
            <>
              <strong className="font-medium">O de versão da página</strong> —
              guarda qual das versões da página inicial você viu, para as duas
              não se misturarem na medição.
            </>,
          ]}
        />
        <p>
          Além desses quatro, o pixel da Meta grava cookies próprios (
          <code className="text-[0.85em]">_fbp</code> e{' '}
          <code className="text-[0.85em]">_fbc</code>) quando você chega por um
          anúncio. <strong className="font-medium">Esses, sim, servem a
          publicidade</strong> e pertencem à Meta, não a nós — é assim que ela
          sabe que a visita virou compra.
        </p>
        <Destaque>
          Os quatro cookies nossos não seguem você por outros sites. Os da Meta
          seguem — é a função deles. Apagar os cookies do navegador zera todos,
          e o site continua funcionando igual; para bloquear só os de anúncio,
          dá para usar o bloqueador do seu navegador ou as preferências de
          anúncio da própria Meta.
        </Destaque>
      </Secao>
    </PaginaLegal>
  );
}
