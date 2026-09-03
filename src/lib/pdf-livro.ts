import { PDFDocument, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import {
  A5,
  COR,
  LARGURA_TEXTO,
  MARGEM,
  centralizar,
  filete,
  fundoDePergaminho,
  quebrar,
  type Fontes,
} from './pdf';
import { FONTES } from './caminhos';
import { partesDoParagrafo, type LivroLido } from '../nucleo/biblioteca/formato';

/**
 * O livro em PDF — a cópia que a pessoa leva embora.
 *
 * ── Quando ele existe ─────────────────────────────────────────────────────
 *
 * Só para quem **comprou o livro**, e só depois de sete dias (ver
 * `nucleo/carencia.ts`). Quem lê pela assinatura não baixa nada: a assinatura
 * dá acesso enquanto durar, e um PDF na mão de quem cancelou no mês seguinte
 * é o contrário disso.
 *
 * ── Por que a mesma folha da revelação ────────────────────────────────────
 *
 * Porque é o mesmo objeto. O pergaminho, o filete de ouro, as Cormorant — o
 * arquivo que sai daqui precisa ser reconhecível como coisa do Bruxário na
 * pasta de downloads daqui a dois anos, e não um PDF de texto qualquer. As
 * peças são importadas de `pdf.ts`, não copiadas: duas folhas de pergaminho
 * viram duas estéticas diferentes no primeiro ajuste.
 *
 * ── A prática fica dentro de uma moldura ──────────────────────────────────
 *
 * No leitor ela é um bloco destacado, porque é o convite para parar e fazer.
 * Em papel, um parágrafo sem moldura no meio de outros parágrafos vira só
 * mais um parágrafo — e o exercício, que é a parte que muda alguma coisa,
 * some no meio do texto.
 */

const ENTRELINHA = 15.5;
const TAMANHO_CORPO = 9.6;

export async function gerarPdfDoLivro(
  livro: LivroLido,
  titulo: string,
  dono: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(titulo);
  pdf.setAuthor('Bruxário');
  pdf.setSubject('Biblioteca do Bruxário');

  const ler = (n: string) => fs.readFileSync(path.join(FONTES, n));

  // As Cormorant vão inteiras: com `subset: true` o pdf-lib perde letras
  // delas. Está documentado em `pdf.ts`, e vale igual aqui.
  const fontes: Fontes = {
    corpo: await pdf.embedFont(ler('Sora-Regular.ttf'), { subset: true }),
    display: await pdf.embedFont(ler('CormorantGaramond-Regular-nolig.ttf'), {
      subset: false,
    }),
    displayBold: await pdf.embedFont(ler('CormorantGaramond-SemiBold-nolig.ttf'), {
      subset: false,
    }),
    ritual: await pdf.embedFont(ler('PinyonScript.ttf'), { subset: true }),
  };

  const pergaminho = await pdf.embedPng(await fundoDePergaminho());

  function novaFolha(): PDFPage {
    const pagina = pdf.addPage([A5.largura, A5.altura]);
    pagina.drawImage(pergaminho, { x: 0, y: 0, width: A5.largura, height: A5.altura });
    return pagina;
  }

  /* ── capa ─────────────────────────────────────────────────────────── */
  const capa = novaFolha();
  centralizar(capa, 'BRUXÁRIO', A5.altura - 96, fontes.corpo, 7.5, COR.escritaFraca);
  filete(capa, A5.altura - 118);

  let yCapa = A5.altura / 2 + 40;
  for (const linha of quebrar(titulo, fontes.displayBold, 26, LARGURA_TEXTO - 20)) {
    centralizar(capa, linha, yCapa, fontes.displayBold, 26, COR.escrita);
    yCapa -= 32;
  }

  filete(capa, yCapa - 6);
  centralizar(
    capa,
    `${livro.palavras.toLocaleString('pt-BR')} palavras · ${livro.minutos} min de leitura`,
    yCapa - 36,
    fontes.corpo,
    7.5,
    COR.escritaFraca
  );

  /**
   * O nome de quem comprou, na capa.
   *
   * Não é enfeite: é a marca que faz a pessoa pensar duas vezes antes de
   * repassar o arquivo no grupo do WhatsApp. Um livro com o nome de alguém na
   * capa circula bem menos que um PDF anônimo — e quem quer mesmo repassar vai
   * repassar de qualquer jeito, então isto é lembrete, não fechadura.
   */
  if (dono) {
    centralizar(capa, `Exemplar de ${dono}`, MARGEM + 26, fontes.display, 10, COR.ouroProfundo);
  }

  /* ── o miolo ──────────────────────────────────────────────────────── */
  let pagina = novaFolha();
  let y = A5.altura - MARGEM - 10;

  /** Garante espaço; abre folha nova quando não cabe. */
  function reservar(altura: number): void {
    if (y - altura >= MARGEM) return;
    pagina = novaFolha();
    y = A5.altura - MARGEM - 10;
  }

  /**
   * Escreve parágrafos respeitando o negrito do Markdown.
   *
   * ── Negrito sem fonte negrito ─────────────────────────────────────────
   *
   * Não existe Sora Bold no projeto — só Regular e Light. A saída é a velha
   * negrita falsa: desenhar o mesmo trecho duas vezes, deslocado por um terço
   * de ponto. Em corpo 9,6 o resultado é indistinguível de um peso maior, e
   * evita embutir uma quarta fonte (~100 kB em todo arquivo gerado) para
   * engrossar oitenta palavras.
   *
   * A linha é montada palavra a palavra (cada palavra pode ter um peso
   * diferente da vizinha, e medir a linha inteira com uma fonte só faz o texto
   * passar da margem), mas é DESENHADA em trechos de mesmo peso — um
   * `drawText` por palavra triplicava o tamanho do arquivo sem mudar um pixel.
   *
   * ── `aoVirarFolha` ────────────────────────────────────────────────────
   *
   * A prática é desenhada com uma régua dourada na margem, e a régua precisa
   * saber onde a folha acabou. Um retângulo em volta do bloco não serve: a
   * prática atravessa páginas, e a moldura ficaria com um lado em cada folha.
   */
  function escrever(
    paragrafos: string[],
    {
      recuo = 0,
      tamanho = TAMANHO_CORPO,
      cor = COR.escritaCorpo,
      aoVirarFolha,
    }: {
      recuo?: number;
      tamanho?: number;
      cor?: typeof COR.escrita;
      aoVirarFolha?: (folhaAnterior: PDFPage, yFinal: number) => void;
    } = {}
  ): void {
    const largura = LARGURA_TEXTO - recuo * 2;

    for (const paragrafo of paragrafos) {
      /** Cada palavra com o peso dela, na ordem. */
      const palavras: { texto: string; forte: boolean }[] = [];
      for (const parte of partesDoParagrafo(paragrafo)) {
        for (const palavra of parte.texto.split(/\s+/)) {
          if (palavra) palavras.push({ texto: palavra, forte: parte.forte });
        }
      }

      let linha: typeof palavras = [];
      let usado = 0;

      const despejar = () => {
        if (linha.length === 0) return;

        const antes = pagina;
        const yAntes = y;
        reservar(ENTRELINHA);
        if (pagina !== antes) aoVirarFolha?.(antes, yAntes);

        let x = MARGEM + recuo;
        let trecho: string[] = [];
        let forteDoTrecho = linha[0].forte;

        const soltarTrecho = () => {
          if (trecho.length === 0) return;
          const texto = `${trecho.join(' ')} `;
          pagina.drawText(texto, {
            x,
            y,
            size: tamanho,
            font: fontes.corpo,
            color: forteDoTrecho ? COR.escrita : cor,
          });
          // A segunda passada é a negrita falsa. Ver o comentário acima.
          if (forteDoTrecho) {
            pagina.drawText(texto, {
              x: x + 0.33,
              y,
              size: tamanho,
              font: fontes.corpo,
              color: COR.escrita,
            });
          }
          x += fontes.corpo.widthOfTextAtSize(texto, tamanho);
          trecho = [];
        };

        for (const palavra of linha) {
          if (palavra.forte !== forteDoTrecho) {
            soltarTrecho();
            forteDoTrecho = palavra.forte;
          }
          trecho.push(palavra.texto);
        }
        soltarTrecho();

        y -= ENTRELINHA;
        linha = [];
        usado = 0;
      };

      for (const palavra of palavras) {
        const largo = fontes.corpo.widthOfTextAtSize(`${palavra.texto} `, tamanho);
        if (usado > 0 && usado + largo > largura) despejar();
        linha.push(palavra);
        usado += largo;
      }
      despejar();

      y -= 6;
    }
  }

  /**
   * A régua dourada da prática, na margem.
   *
   * Ela substituiu a moldura fechada: a prática de um livro de verdade tem
   * quatro passos e não cabe numa folha, e uma moldura que começa numa página
   * e termina na outra fica com um lado solto em cada uma. A régua marginal
   * atravessa a virada sem estranheza — é como se marca um trecho longo à mão.
   */
  function regua(folha: PDFPage, deY: number, ateY: number): void {
    if (deY - ateY < 4) return;
    folha.drawLine({
      start: { x: MARGEM + 8, y: deY },
      end: { x: MARGEM + 8, y: ateY },
      thickness: 1.1,
      color: COR.ouro,
      opacity: 0.5,
    });
  }

  livro.modulos.forEach((modulo, iModulo) => {
    /**
     * Módulo novo começa em folha nova, sempre.
     *
     * Em tela a divisão é visível pela cor da fita; no papel não há fita
     * nenhuma, e um título de módulo no pé da página faz a parte nova do livro
     * começar no rodapé da anterior.
     */
    if (iModulo > 0 || y < A5.altura - MARGEM - 20) {
      pagina = novaFolha();
      y = A5.altura - MARGEM - 10;
    }

    y -= 60;
    centralizar(pagina, `PARTE ${iModulo + 1}`, y, fontes.corpo, 7, COR.escritaFraca);
    y -= 30;
    for (const linha of quebrar(modulo.titulo, fontes.displayBold, 19, LARGURA_TEXTO - 30)) {
      centralizar(pagina, linha, y, fontes.displayBold, 19, COR.escrita);
      y -= 24;
    }
    y -= 8;
    filete(pagina, y);
    y -= 40;

    for (const capitulo of modulo.capitulos) {
      // Um capítulo que só caberia com duas linhas na folha começa na próxima:
      // título órfão no fim da página é o defeito clássico de livro mal
      // paginado.
      reservar(ENTRELINHA * 5);

      for (const linha of quebrar(capitulo.titulo, fontes.displayBold, 14, LARGURA_TEXTO)) {
        reservar(ENTRELINHA);
        pagina.drawText(linha, {
          x: MARGEM,
          y,
          size: 14,
          font: fontes.displayBold,
          color: COR.ouroProfundo,
        });
        y -= 20;
      }
      y -= 6;

      for (const bloco of capitulo.blocos) {
        if (bloco.tipo === 'pratica') {
          y -= 8;
          // Espaço para o rótulo e as duas primeiras linhas: a prática pode
          // atravessar folhas, mas começar com o rótulo sozinho no pé não.
          reservar(ENTRELINHA * 4);

          pagina.drawText('A PRÁTICA', {
            x: MARGEM + 22,
            y,
            size: 7,
            font: fontes.corpo,
            color: COR.ouro,
          });
          y -= 18;

          let folhaDaRegua = pagina;
          let topoDaRegua = y + 20;

          escrever(bloco.paragrafos, {
            recuo: 22,
            cor: COR.escrita,
            aoVirarFolha: (anterior, yFinal) => {
              regua(anterior, topoDaRegua, yFinal - 4);
              folhaDaRegua = pagina;
              topoDaRegua = A5.altura - MARGEM;
            },
          });

          regua(folhaDaRegua, topoDaRegua, y + 10);
          y -= 14;
          continue;
        }

        escrever(bloco.paragrafos);
      }

      y -= 12;
    }
  });

  /* ── colofão ──────────────────────────────────────────────────────── */
  const fim = novaFolha();
  filete(fim, A5.altura / 2 + 30);
  centralizar(fim, 'BRUXÁRIO', A5.altura / 2, fontes.corpo, 8, COR.escritaFraca);
  centralizar(
    fim,
    'bruxario.com.br',
    A5.altura / 2 - 22,
    fontes.display,
    11,
    COR.ouroProfundo
  );

  return pdf.save();
}
