/**
 * A lua de hoje, desenhada na fase de verdade.
 *
 * ── Por que não quatro imagens ────────────────────────────────────────────
 *
 * O jeito fácil seria quatro PNGs (nova, crescente, cheia, minguante) e um
 * `if`. Mas a lua real não tem quatro estados: ela muda um pouco todo dia, e
 * um bloco que a pessoa abre diariamente é justamente onde essa diferença é
 * percebida — se o desenho é o mesmo por sete dias, o bloco parece estático e
 * a pessoa para de olhar.
 *
 * ── Como o terminador é desenhado ─────────────────────────────────────────
 *
 * A sombra da lua é limitada por duas curvas: a borda do disco (um semicírculo
 * fixo) e o **terminador**, que é uma elipse vista de lado. Conforme a fase
 * anda, essa elipse é achatada até virar uma reta (no quarto) e depois infla
 * para o outro lado. É exatamente isso que o `rx` do segundo arco faz aqui —
 * ele vai de `r` a `0` e volta a `r`, e o sinal decide para que lado a barriga
 * aponta.
 *
 * No hemisfério sul a lua cresce ao contrário do que a maioria das
 * ilustrações mostra: a crescente aparece iluminada à ESQUERDA. Como o
 * produto é brasileiro, é assim que ela é desenhada — quem olhar para o céu
 * vai ver a mesma coisa.
 */
export function LuaDesenhada({
  grausDaFase,
  tamanho = 56,
}: {
  /** 0 nova · 90 quarto crescente · 180 cheia · 270 quarto minguante. */
  grausDaFase: number;
  tamanho?: number;
}) {
  const r = 50;
  const fase = ((grausDaFase % 360) + 360) % 360;

  // Quanto o terminador está "aberto": 0 no quarto (reta), 1 na nova/cheia.
  const cosseno = Math.cos((fase * Math.PI) / 180);
  const rx = Math.abs(cosseno) * r;

  const crescendo = fase < 180;
  const varreduraDisco = crescendo ? 0 : 1;

  /**
   * O lado para onde o terminador faz barriga — e é aqui que está o único
   * ponto realmente traiçoeiro deste desenho.
   *
   * Quando `cos > 0` (antes do quarto crescente, ou depois do minguante), a
   * elipse curva **para dentro** da metade iluminada e recorta uma foice
   * fina. Quando `cos < 0`, ela curva para fora e a lua fica gibosa. Trocar
   * este sinal não quebra nada visivelmente — só desenha 15% de luz onde
   * deveria haver 85%, e vice-versa, o que passa despercebido até alguém
   * comparar com o céu.
   */
  const terminadorRecortaAFoice = cosseno > 0;
  const varreduraTerminador = terminadorRecortaAFoice === crescendo ? 0 : 1;

  const iluminado = `
    M 50 0
    A ${r} ${r} 0 0 ${varreduraDisco} 50 100
    A ${rx} ${r} 0 0 ${varreduraTerminador} 50 0
    Z
  `;

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* O disco apagado: a lua que não some quando não está iluminada. */}
      <circle cx="50" cy="50" r={r} fill="var(--pergaminho)" opacity="0.07" />

      {/* Halo quente — é a vela do quarto batendo nela, não luz própria. */}
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--vela)" strokeWidth="1" opacity="0.25" />

      {fase > 4 && fase < 356 && (
        <path d={iluminado} fill="var(--vela)" opacity="0.92" />
      )}
    </svg>
  );
}
