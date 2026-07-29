export const metadata = {
  robots: { index: false, follow: false },
};

export default function Termos() {
  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="max-w-lg font-corpo font-light text-pergaminho/90 leading-relaxed flex flex-col gap-6">
        <h1 className="font-display italic text-3xl text-pergaminho mb-2">
          Termos e Privacidade
        </h1>

        <section>
          <h2 className="font-corpo font-medium text-pergaminho mb-1">O que fazemos</h2>
          <p>
            O Bruxário é um produto de entretenimento e autoconhecimento simbólico.
            As leituras são geradas com auxílio de inteligência artificial e não
            substituem orientação profissional de nenhuma natureza — médica,
            psicológica, financeira, legal ou de qualquer outra ordem. Não
            prometemos previsões literais de futuro, saúde, dinheiro ou relações.
          </p>
        </section>

        <section>
          <h2 className="font-corpo font-medium text-pergaminho mb-1">Dados que coletamos</h2>
          <p>
            Para gerar e entregar sua revelação, coletamos nome, e-mail, data e
            hora de nascimento (opcional) e as respostas do ritual. O CPF é
            pedido separadamente pelo processador de pagamento, na hora do
            checkout. Esses dados são usados apenas para calcular seu
            familiar, gerar a leitura e as artes, processar o pagamento e,
            eventualmente, enviar comunicações sobre o seu registro.
          </p>
        </section>

        <section>
          <h2 className="font-corpo font-medium text-pergaminho mb-1">Seus direitos (LGPD)</h2>
          <p>
            Você pode solicitar a exclusão dos seus dados a qualquer momento
            escrevendo para{' '}
            <a href="mailto:ola@bruxario.com.br" className="underline text-violeta">
              ola@bruxario.com.br
            </a>
            . O link da sua revelação é permanente e privado — não é indexado por
            buscadores.
          </p>
        </section>

        <section>
          <h2 className="font-corpo font-medium text-pergaminho mb-1">Pagamento</h2>
          <p>
            Os pagamentos são processados por instituição regulada pelo Banco
            Central. Nenhum dado de cartão passa pelos nossos servidores.
          </p>
        </section>
      </div>
    </main>
  );
}
