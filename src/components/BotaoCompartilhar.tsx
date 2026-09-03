'use client';

import { useState } from 'react';
import { Share2, Download, Link2, Check, MessageCircle, Send } from 'lucide-react';

/**
 * Compartilhamento em duas naturezas diferentes, e a distinção importa:
 *
 * - **Link** — é o produto. O SPEC 0.5 diz que a leitura mora num endereço
 *   permanente, não num arquivo, e o link é o que faz outra pessoa chegar no
 *   quiz. É o motor de aquisição.
 * - **Imagem** — é subproduto. Serve pro story, mas quem vê uma imagem não tem
 *   pra onde clicar.
 *
 * Por isso o link vem primeiro no menu e as imagens depois.
 */

/** Deep links que abrem o app já na escolha de contato, com a mensagem pronta. */
function linkWhatsApp(texto: string, url: string) {
  // api.whatsapp.com/send abre o app instalado e cai no web quando não há app.
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(`${texto}\n\n${url}`)}`;
}

function linkTelegram(texto: string, url: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`;
}

async function baixarOuCompartilhar(
  url: string,
  nomeArquivo: string,
  texto: string
) {
  try {
    const resposta = await fetch(url);
    const blob = await resposta.blob();
    const arquivo = new File([blob], nomeArquivo, { type: blob.type });

    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: texto });
      return;
    }
  } catch {
    // segue para o download simples
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
}

export function BotaoCompartilhar({
  pedidoId,
  textoCompartilhar,
  urlPerfil,
}: {
  pedidoId: string;
  textoCompartilhar: string;
  /** Endereço permanente da revelação. Ausente = deriva do próprio navegador. */
  urlPerfil?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  /**
   * O endereço que a pessoa manda para os amigos: **a revelação dela**, com a
   * marca de indicação.
   *
   * ── Isto já apontou para a home, e voltou ───────────────────────────────
   *
   * O link chegou a ser `/?s=<código>`, com o raciocínio de que quem recebe a
   * revelação de outra pessoa não tem nada a fazer ali além de ler o resultado
   * alheio — melhor mandar para a porta da frente, onde ele faz o próprio.
   *
   * O raciocínio ignorava por que alguém compartilha. Ninguém manda "olha esse
   * site"; manda **"olha o que deu pra mim"**. A revelação é a coisa que a
   * pessoa quer mostrar, e mandar a home no lugar dela entrega ao amigo um
   * anúncio em vez da história — o link some no meio da conversa, e quem
   * compartilhou percebe: o que ele copia da barra de endereço funciona, e o
   * botão de compartilhar não.
   *
   * Também é o link com preview: `/revelacao/[id]` gera Open Graph com o nome
   * secreto e a arte do familiar (ver `generateMetadata`), enquanto a home
   * mostra o card genérico do site. No WhatsApp isso é a diferença entre uma
   * imagem que dá vontade de tocar e uma linha azul.
   *
   * ── O `?s=` continua indo junto ─────────────────────────────────────────
   *
   * São os 8 primeiros caracteres do id, e é o que credita a indicação a quem
   * compartilhou — o `Farejador` lê `?s=` em qualquer página, então ele
   * funciona aqui igual funcionava na home. O que muda é só onde o amigo cai.
   *
   * A conversão continua existindo, e num lugar melhor: a revelação já mostra
   * a quem não é dono o convite para fazer o próprio ritual.
   */
  function enderecoPermanente() {
    if (urlPerfil) return urlPerfil;
    const codigo = pedidoId.replace(/-/g, '').slice(0, 8).toLowerCase();
    return typeof window !== 'undefined'
      ? `${window.location.origin}/revelacao/${pedidoId}?s=${codigo}`
      : '';
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(enderecoPermanente());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado (http sem TLS, permissão negada): o menu fica
      // aberto para a pessoa copiar da barra de endereço
    }
  }

  /**
   * No celular o menu nativo do sistema ganha de qualquer lista nossa: mostra
   * os apps que a pessoa realmente usa, na ordem dela, inclusive os que a gente
   * nunca listaria. Só caímos no menu próprio quando ele não existe — desktop,
   * sobretudo.
   */
  async function compartilharNativo() {
    if (!navigator.share) {
      setAberto((v) => !v);
      return;
    }
    try {
      await navigator.share({
        title: 'Meu familiar',
        text: textoCompartilhar,
        url: enderecoPermanente(),
      });
    } catch {
      // a pessoa cancelou — não é erro
    }
  }

  const itemClasse =
    'flex items-center gap-3 font-corpo text-sm text-pergaminho px-4 py-3 rounded-xl hover:bg-pergaminho/10 transition text-left w-full';

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={compartilharNativo}
          className="inline-flex items-center gap-2 bg-vela text-tinta font-corpo font-medium px-6 py-3 rounded-full hover:brightness-110 transition"
        >
          <Share2 size={16} strokeWidth={1.75} /> Compartilhar
        </button>
        <button
          onClick={() => setAberto((v) => !v)}
          aria-label="Mais opções de compartilhamento"
          aria-expanded={aberto}
          className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-pergaminho/20 text-pergaminho/70 hover:bg-pergaminho/10 transition"
        >
          <Link2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute z-20 mt-2 left-1/2 -translate-x-1/2 flex flex-col gap-1 bg-tinta border border-pergaminho/15 rounded-2xl p-2 shadow-xl min-w-[250px]">
            <button onClick={copiarLink} className={itemClasse}>
              {copiado ? (
                <Check size={15} strokeWidth={1.75} className="text-vela" />
              ) : (
                <Link2 size={15} strokeWidth={1.5} />
              )}
              {copiado ? 'Link copiado' : 'Copiar o link'}
            </button>

            <a
              href={linkWhatsApp(textoCompartilhar, enderecoPermanente())}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAberto(false)}
              className={itemClasse}
            >
              <MessageCircle size={15} strokeWidth={1.5} /> Enviar no WhatsApp
            </a>

            <a
              href={linkTelegram(textoCompartilhar, enderecoPermanente())}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAberto(false)}
              className={itemClasse}
            >
              <Send size={15} strokeWidth={1.5} /> Enviar no Telegram
            </a>

            <div className="h-px bg-pergaminho/10 my-1 mx-2" />

            <button
              onClick={() => {
                setAberto(false);
                baixarOuCompartilhar(
                  `/api/storage/${pedidoId}/story.png`,
                  'meu-familiar-story.png',
                  textoCompartilhar
                );
              }}
              className={itemClasse}
            >
              <Download size={15} strokeWidth={1.5} /> Imagem de Story
            </button>
            <button
              onClick={() => {
                setAberto(false);
                baixarOuCompartilhar(
                  `/api/storage/${pedidoId}/feed.png`,
                  'meu-familiar-feed.png',
                  textoCompartilhar
                );
              }}
              className={itemClasse}
            >
              <Download size={15} strokeWidth={1.5} /> Imagem de Feed
            </button>
          </div>
        </>
      )}
    </div>
  );
}
