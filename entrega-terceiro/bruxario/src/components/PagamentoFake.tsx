'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flame } from 'lucide-react';

/**
 * Modo sem gateway: usado quando não há `DIRECTPAG_API_TOKEN`
 * configurados. Aprova na hora e segue o pipeline inteiro
 * (quiz → leitura → artes → link), que é como o projeto foi desenvolvido antes
 * de existir credencial de pagamento — e continua sendo o jeito de testar o
 * fluxo completo sem cobrar ninguém.
 */
export function PagamentoFake({
  pedidoId,
}: {
  pedidoId: string;
}) {
  // Já começa "enviando": a confirmação dispara sozinha ao montar, então esse
  // é o estado real na primeira renderização. Setar isso dentro do efeito
  // causaria uma renderização em cascata sem necessidade.
  const [enviando, setEnviando] = useState(true);
  const [erro, setErro] = useState('');

  const confirmar = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/pedido/${pedidoId}/pagamento`, {
        method: 'POST',
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro || 'O véu está denso esta noite. Tente novamente.');
        setEnviando(false);
        return;
      }
      window.location.href = dados.redirect;
    } catch {
      setErro('O véu está denso esta noite. Tente novamente em instantes.');
      setEnviando(false);
    }
  }, [pedidoId]);

  // Confirmar ao montar é o propósito desta tela — ela não tem botão para o
  // caminho felizardo. O `set-state-in-effect` existe para impedir cascata de
  // renders, e aqui não há: `confirmar` só toca estado no caminho de erro, e o
  // caminho de sucesso termina em `window.location.href`, saindo da página.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    confirmar();
  }, [confirmar]);

  function tentarNovamente() {
    setErro('');
    setEnviando(true);
    confirmar();
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <Flame className="text-vela" size={30} strokeWidth={1.5} />
      <h1 className="font-display italic text-3xl text-pergaminho max-w-sm">
        Encontramos. Ele está esperando do outro lado.
      </h1>

      {erro ? (
        <>
          <p className="text-sm text-red-300 max-w-xs">{erro}</p>
          <button
            onClick={tentarNovamente}
            disabled={enviando}
            className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-60"
          >
            Tentar novamente
          </button>
        </>
      ) : (
        <p className="font-corpo font-light text-pergaminho/70 text-sm">
          Preparando sua revelação...
        </p>
      )}
    </div>
  );
}
