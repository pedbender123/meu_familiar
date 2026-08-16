'use client';

import { useEffect, useRef, useState } from 'react';
import { BotaoDoRitual } from './PassoDoRitual';
import { MarcacaoDaPalma } from './MarcacaoDaPalma';
import { usePrefereMenosMovimento } from '@/lib/movimento';
import { analisarPalma, servidorConfigurado, type PalmAnalysis } from '@/lib/palma/deteccao';

/**
 * A leitura da mão: foto pela câmera, varredura visível, e o reconhecimento.
 *
 * ── O que é medido de verdade ─────────────────────────────────────────────
 *
 * Os 21 pontos da mão saem do modelo **Hand Landmarker** do MediaPipe, servido
 * da própria aplicação — sem CDN em tempo de execução. Com eles montamos o
 * sistema de coordenadas da SUA palma (posição, tamanho, rotação e lado), e
 * ao longo do corredor de cada linha procuramos vincos escuros de verdade na
 * foto. O traçado final é a sequência de vincos achados.
 *
 * O que é canônico é só a REGIÃO onde cada linha é procurada. Quando menos de
 * 30% dos passos acham vinco, a linha volta ao corredor padrão e a tela diz
 * que não achou sulco nítido — porque apresentar o corredor genérico como se
 * fosse a mão da pessoa seria inventar uma medida sobre o corpo dela.
 *
 * **Não é leitura clínica**, e a interface diz isso.
 *
 * ── Dois caminhos para a detecção ─────────────────────────────────────────
 *
 * No navegador (padrão), com WebGL: custa zero, escala de graça, e a foto não
 * sai do aparelho. Sem WebGL, cai para o servidor — mesmo arquivo de modelo,
 * uma cópia só, sem versões divergindo. A consequência de privacidade é real
 * e a tela avisa: quando o plano B entra, a foto SAI do aparelho.
 *
 * ── A foto não sai do aparelho ────────────────────────────────────────────
 *
 * Ela vira um `dataURL` na memória da aba, é desenhada num canvas e some
 * quando a página fecha. Nada é enviado ao servidor e nada é guardado — e a
 * tela diz isso, porque pedir a câmera sem explicar o destino é o que faz
 * gente boa fechar a aba.
 */
export function LeituraDaMao({
  onContinuar,
  onPular,
}: {
  onContinuar: (temFoto: boolean) => void;
  onPular: () => void;
}) {
  const semMovimento = usePrefereMenosMovimento();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [etapa, etapaSet] = useState<'convite' | 'camera' | 'varrendo' | 'pronto'>('convite');
  const [foto, setFoto] = useState<string | null>(null);
  const [analise, setAnalise] = useState<PalmAnalysis | null>(null);
  const [linhasVisiveis, setLinhasVisiveis] = useState(0);
  const [erro, setErro] = useState('');

  // Desligar a câmera ao sair é obrigatório: sem isto a luz do aparelho fica
  // acesa depois que a pessoa já avançou, e nada denuncia mais um site.
  useEffect(() => {
    return () => {
      fluxo.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function abrirCamera() {
    setErro('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      fluxo.current = s;
      etapaSet('camera');
      // O elemento só existe depois do render desta etapa.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      // Permissão negada ou aparelho sem câmera: a foto da galeria resolve, e
      // travar aqui perderia a pessoa por um passo que é opcional.
      setErro('Não consegui abrir a câmera. Você pode escolher uma foto.');
      arquivoRef.current?.click();
    }
  }

  function capturar() {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth || 720;
    c.height = v.videoHeight || 960;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    setFoto(c.toDataURL('image/jpeg', 0.82));
    fluxo.current?.getTracks().forEach((t) => t.stop());
    etapaSet('varrendo');
  }

  function daGaleria(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      setFoto(String(leitor.result));
      etapaSet('varrendo');
    };
    leitor.readAsDataURL(f);
  }

  /**
   * A análise de verdade. Roda enquanto a faixa de luz varre a foto — a
   * espera na tela é o tempo do modelo carregando e detectando, não teatro
   * cronometrado.
   */
  useEffect(() => {
    if (etapa !== 'varrendo' || !foto) return;
    let vivo = true;
    analisarPalma(foto)
      .then((a) => {
        if (!vivo) return;
        setAnalise(a);
        setTimeout(() => vivo && etapaSet('pronto'), semMovimento ? 0 : 700);
      })
      .catch(() => {
        if (!vivo) return;
        setAnalise(null);
        etapaSet('pronto');
      });
    return () => {
      vivo = false;
    };
  }, [etapa, foto, semMovimento]);

  /** As quatro linhas aparecem uma a uma. */
  useEffect(() => {
    if (etapa !== 'pronto' || !analise) return;
    if (linhasVisiveis >= analise.linhas.length) return;
    const t = setTimeout(() => setLinhasVisiveis((n) => n + 1), semMovimento ? 0 : 640);
    return () => clearTimeout(t);
  }, [etapa, linhasVisiveis, analise, semMovimento]);

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 anima-surgir">
      <div className="text-center">
        <h2 className="font-display italic text-2xl sm:text-3xl leading-tight text-pergaminho text-balance">
          {etapa !== 'pronto'
            ? 'Mostre a sua mão.'
            : analise?.landmarks
              ? 'Ele viu a sua mão.'
              : 'Não deu para ler a mão.'}
        </h2>
        <p className="mt-3 font-corpo font-light text-[0.92rem] leading-relaxed text-pergaminho/70 max-w-[34ch] mx-auto">
          {etapa !== 'pronto' ? (
            <>
              Palma aberta, dedos soltos.{' '}
              {servidorConfigurado()
                ? 'A leitura tenta acontecer no seu aparelho; se ele não der conta, a foto é enviada só para achar a mão — e não fica guardada.'
                : 'A foto não sai do seu aparelho.'}
            </>
          ) : (
            <ResumoDaLeitura analise={analise} />
          )}
        </p>
      </div>

      <div
        className="relative w-full aspect-[3/4] max-h-[52vh] rounded-3xl overflow-hidden"
        style={{
          border: '1px solid color-mix(in srgb, var(--vela) 25%, transparent)',
          background: 'color-mix(in srgb, var(--tinta) 60%, transparent)',
        }}
      >
        {etapa === 'camera' && (
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {foto && etapa === 'varrendo' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="Sua mão" className="absolute inset-0 w-full h-full object-cover" />
        )}

        {foto && etapa === 'pronto' && (
          <MarcacaoDaPalma
            photo={foto}
            analise={analise}
            linhasVisiveis={linhasVisiveis}
            className="absolute inset-0 w-full h-full"
          />
        )}

        {etapa === 'convite' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <MaoDesenhada />
          </div>
        )}

        {(etapa === 'camera' || etapa === 'varrendo') && <Moldura />}

        {etapa === 'varrendo' && <Varredura semMovimento={semMovimento} />}

      </div>

      {erro && <p className="font-corpo text-sm text-red-400 text-center">{erro}</p>}

      <input
        ref={arquivoRef}
        type="file"
        accept="image/*"
        onChange={daGaleria}
        className="hidden"
      />

      {etapa === 'convite' && (
        <div className="w-full flex flex-col items-center gap-3">
          <BotaoDoRitual onClick={abrirCamera}>Abrir a câmera</BotaoDoRitual>
          <button
            onClick={() => arquivoRef.current?.click()}
            className="font-corpo text-sm text-pergaminho/55 hover:text-vela underline underline-offset-4 transition"
          >
            Escolher uma foto
          </button>
          <button
            onClick={onPular}
            className="font-corpo text-[13px] text-pergaminho/35 hover:text-pergaminho/60 transition"
          >
            Prefiro não mostrar
          </button>
        </div>
      )}

      {etapa === 'camera' && (
        <BotaoDoRitual onClick={capturar}>Capturar</BotaoDoRitual>
      )}

      {etapa === 'varrendo' && (
        <p className="font-display italic text-lg text-pergaminho/60">Lendo os vincos…</p>
      )}

      {etapa === 'pronto' && (
        <div className="w-full flex flex-col items-center gap-3">
          <BotaoDoRitual onClick={() => onContinuar(!!analise?.landmarks)}>
            Continuar
          </BotaoDoRitual>
          {!analise?.landmarks && (
            <button
              onClick={() => {
                setFoto(null);
                setAnalise(null);
                setLinhasVisiveis(0);
                etapaSet('convite');
              }}
              className="font-corpo text-sm text-pergaminho/55 hover:text-vela underline underline-offset-4 transition"
            >
              Tentar outra foto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** O contorno que ensina onde pôr a mão. */
function MaoDesenhada() {
  return (
    <svg width="150" height="190" viewBox="0 0 100 128" fill="none" aria-hidden="true">
      <path
        d="M30 122V74c0-4-6-6-6-12V44c0-3 4-3 4 0v18h4V26c0-4 6-4 6 0v34h4V18c0-4 6-4 6 0v42h4V24c0-4 6-4 6 0v36h4V38c0-4 6-4 6 0v40c0 24-8 44-18 44H30Z"
        stroke="var(--vela)"
        strokeOpacity="0.4"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cantos de enquadramento — diz onde a leitura acontece. */
function Moldura() {
  const canto = 'absolute size-9 border-vela/60';
  return (
    <div aria-hidden="true" className="absolute inset-6 pointer-events-none">
      <span className={`${canto} left-0 top-0 border-l-2 border-t-2 rounded-tl-xl`} />
      <span className={`${canto} right-0 top-0 border-r-2 border-t-2 rounded-tr-xl`} />
      <span className={`${canto} left-0 bottom-0 border-l-2 border-b-2 rounded-bl-xl`} />
      <span className={`${canto} right-0 bottom-0 border-r-2 border-b-2 rounded-br-xl`} />
    </div>
  );
}

/** A faixa de luz que atravessa a foto durante a leitura. */
function Varredura({ semMovimento }: { semMovimento: boolean }) {
  if (semMovimento) return null;
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 h-24 pointer-events-none"
      style={{
        background:
          'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--vela) 38%, transparent), transparent)',
        animation: 'varrer 1.4s ease-in-out infinite',
      }}
    />
  );
}

/**
 * O que a leitura conseguiu, dito sem enfeite.
 *
 * Os três casos têm mensagens diferentes de propósito: "não vi mão nenhuma",
 * "vi a mão mas os vincos estão apagados" e "vi tudo" são situações distintas,
 * e juntá-las numa frase só é como se esconde uma falha técnica atrás de
 * linguagem mística.
 */
function ResumoDaLeitura({ analise }: { analise: PalmAnalysis | null }) {
  if (!analise?.landmarks) {
    return (
      <>
        Não achei uma mão nesta foto. Tente com a palma mais perto da câmera,
        com luz de frente e a mão inteira dentro do quadro.
      </>
    );
  }

  const achados = analise.linhas.reduce((s, l) => s + l.achados, 0);
  const total = analise.linhas.reduce((s, l) => s + l.total, 0);

  if (analise.confianca === 'fraca') {
    return (
      <>
        Achei a sua mão, mas os vincos estão apagados nesta foto — o traçado
        abaixo é o corredor onde cada linha costuma correr, não o que está
        desenhado na sua palma.
        {analise.motivo === 'servidor' && ' A leitura foi feita no servidor.'}
      </>
    );
  }

  return (
    <>
      {achados} vincos encontrados em {total} pontos procurados.
      {analise.motivo === 'servidor' &&
        ' Seu navegador não tem aceleração gráfica, então a mão foi encontrada no servidor.'}
    </>
  );
}
