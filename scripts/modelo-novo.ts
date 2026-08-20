import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { definirInterruptor, buscarInterruptor } from '../src/lib/interruptores';
import { CHAVE_DO_MODELO_NOVO } from '../src/lib/modelo-de-venda';

/**
 * Vira a chave do modelo de venda. **Sem deploy, sem reiniciar nada.**
 *
 * ```
 * npm run modelo-novo            # mostra como está
 * npm run modelo-novo -- ligar   # Revelação grátis, oferta de 3 degraus
 * npm run modelo-novo -- desligar
 * ```
 *
 * Desligar é o rollback e é instantâneo: nenhum código muda, nada é revertido,
 * e quem estiver no meio de um pagamento continua com o preço que viu.
 */
function main() {
  const acao = process.argv[2];
  const atual = buscarInterruptor(CHAVE_DO_MODELO_NOVO);
  const ligado = !!atual?.ligado && atual.percentual >= 100;

  if (acao !== 'ligar' && acao !== 'desligar') {
    console.log(`modelo novo: ${ligado ? 'LIGADO' : 'desligado'}`);
    console.log(
      ligado
        ? '  Revelação grátis · oferta de três degraus · planos vendáveis'
        : '  Revelação a R$ 9,80 · entrega leva à revelação · planos travados'
    );
    console.log('\nuse: npm run modelo-novo -- ligar   |   -- desligar');
    return;
  }

  definirInterruptor({
    chave: CHAVE_DO_MODELO_NOVO,
    ligado: acao === 'ligar',
    percentual: 100,
    nota: 'Revelação grátis + venda por assinatura. Desligado = modelo de agosto/2026.',
  });

  console.log(`modelo novo: ${acao === 'ligar' ? 'LIGADO' : 'desligado'}`);
}

main();
