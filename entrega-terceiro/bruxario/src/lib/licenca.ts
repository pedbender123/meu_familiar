import crypto from 'crypto';

/**
 * A licença: o sistema pergunta, de tempos em tempos, se ainda pode rodar.
 *
 * ── O que isto é, e o que não é ───────────────────────────────────────────
 *
 * **Não é uma fechadura.** Quem tem o código-fonte pode apagar este arquivo em
 * dois minutos, e não existe forma de impedir isso — ofuscar código que viaja
 * junto com o fonte é teatro.
 *
 * É um freio: desliga a aplicação de onde o licenciante estiver, sem acesso ao
 * servidor, e faz de contorná-lo um ato deliberado — com data e autoria no
 * `git` de quem contornou. As proteções de verdade são outras e estão
 * escritas em `LICENCA.md`: o domínio, a conta do gateway, o contrato.
 *
 * ── Como a resposta é confiável ───────────────────────────────────────────
 *
 * O arquivo de licença é **assinado** (Ed25519). A chave pública viaja com o
 * código; a privada nunca sai da mão do licenciante. Sem ela não dá para
 * forjar um "pode rodar" nem alterar a resposta no caminho — e como a
 * assinatura cobre o campo `emitida_em`, também não dá para guardar uma
 * resposta antiga e reapresentá-la para sempre.
 *
 * ── Falha de rede NÃO desliga ─────────────────────────────────────────────
 *
 * Se o endereço da licença estiver fora do ar, o sistema segue com a última
 * resposta válida. Um site de vendas que morre porque um servidor de licença
 * piscou prejudica mais o licenciante do que o licenciado — a venda perdida é
 * dele.
 *
 * Mas o cache tem prazo. Passadas `TOLERANCIA_HORAS` sem contato, entra em
 * `avisando`, que é visível para os clientes. É o que impede a saída óbvia:
 * bloquear o domínio da licença no firewall e seguir como se nada fosse.
 */

export type EstadoDaLicenca = 'ativa' | 'avisando' | 'suspensa';

export interface Licenca {
  estado: EstadoDaLicenca;
  mensagem?: string;
  /** ISO. A assinatura cobre este campo — impede reapresentar resposta velha. */
  emitida_em: string;
}

interface LicencaAssinada extends Licenca {
  assinatura: string;
}

/** Quanto tempo uma resposta vale antes de o sistema perguntar de novo. */
const CACHE_MINUTOS = 60;

/** Quanto tempo sem contato antes de começar a avisar na tela. */
const TOLERANCIA_HORAS = 72;

/** Uma resposta assinada há mais de isto é velha demais para ser aceita. */
const VALIDADE_DA_ASSINATURA_HORAS = 24 * 14;

let cache: { licenca: Licenca; em: number } | null = null;
let ultimoContatoOk: number | null = null;

function chavePublica(): string | null {
  return process.env.LICENCA_CHAVE_PUBLICA?.trim() || null;
}

function endereco(): string | null {
  return process.env.LICENCA_URL?.trim() || null;
}

/** `true` se a assinatura confere com a chave pública embutida. */
export function assinaturaConfere(payload: LicencaAssinada, chave: string): boolean {
  try {
    const { assinatura, ...conteudo } = payload;
    const publica = crypto.createPublicKey({
      key: Buffer.from(chave, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      null,
      Buffer.from(JSON.stringify(conteudo)),
      publica,
      Buffer.from(assinatura, 'base64')
    );
  } catch {
    return false;
  }
}

async function buscar(): Promise<Licenca | null> {
  const url = endereco();
  const chave = chavePublica();
  if (!url || !chave) return null;

  try {
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;

    const payload = (await r.json()) as LicencaAssinada;
    if (!assinaturaConfere(payload, chave)) {
      console.warn('[licenca] assinatura inválida — resposta ignorada');
      return null;
    }

    const idade = Date.now() - new Date(payload.emitida_em).getTime();
    if (!Number.isFinite(idade) || idade > VALIDADE_DA_ASSINATURA_HORAS * 3_600_000) {
      console.warn('[licenca] resposta velha demais — ignorada');
      return null;
    }

    ultimoContatoOk = Date.now();
    return payload;
  } catch {
    return null;
  }
}

/**
 * O estado agora.
 *
 * **Sem `LICENCA_URL` configurada, devolve `ativa`.** A ausência de licença
 * não pode travar quem está desenvolvendo, rodando teste ou subindo pela
 * primeira vez — e o licenciante que não configurou não quis a trava.
 */
export async function estadoDaLicenca(): Promise<Licenca> {
  if (!endereco() || !chavePublica()) {
    return { estado: 'ativa', emitida_em: new Date().toISOString() };
  }

  const agora = Date.now();
  if (cache && agora - cache.em < CACHE_MINUTOS * 60_000) {
    return cache.licenca;
  }

  const fresca = await buscar();
  if (fresca) {
    cache = { licenca: fresca, em: agora };
    return fresca;
  }

  // Não conseguiu falar. Segue com o que tem, até a paciência acabar.
  const semContatoHa = ultimoContatoOk ? agora - ultimoContatoOk : Infinity;
  if (semContatoHa > TOLERANCIA_HORAS * 3_600_000) {
    return {
      estado: 'avisando',
      mensagem: 'Não foi possível validar a licença deste sistema.',
      emitida_em: new Date().toISOString(),
    };
  }

  return cache?.licenca ?? { estado: 'ativa', emitida_em: new Date().toISOString() };
}
