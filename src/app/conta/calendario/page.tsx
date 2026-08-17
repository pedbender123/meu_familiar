import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';
import { SEM_DIREITOS } from '@/nucleo/direitos';
import { perfilAstralDaConta } from '@/nucleo/perfil-astral';
import { calcularMes, mapaDaConta, mesesNavegaveis, diasDeOuro } from '@/modulos/calendario/calendario';
import { NOME_DO_DOMINIO } from '@/modulos/calendario/pontuacao';
import { GradeDoCalendario } from '@/plataforma/GradeDoCalendario';

const ALCANCE_EM_PALAVRAS: Record<string, string> = {
  semana: 'os próximos 7 dias',
  mes: 'este mês',
  ano: 'os próximos 12 meses',
  rolante: 'os próximos 12 meses, sempre',
};

/**
 * O Calendário Astrológico (Fase 7).
 *
 * ── O cálculo só acontece onde o plano alcança ────────────────────────────
 *
 * `calcularMes` monta o mês inteiro, mas só pontua os dias dentro da janela
 * do plano — o resto entra como cadeado, que custa zero. Isso é o que faz o
 * plano grátis navegar por doze meses sem gastar CPU: ele vê a grade e o
 * tamanho do que está fechado, e paga só pelos sete dias dele.
 *
 * O mês vem da URL (`?mes=2026-09`) porque quem calcula é o servidor: ele é
 * quem tem o mapa natal e o alcance. De quebra, o mês fica no endereço.
 */
export default async function Calendario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesPedido } = await searchParams;
  const sessao = await sessaoAtual();
  const conta = buscarConta(sessao!.email);

  const direitos = conta ? direitosEfetivos(conta.id, sessao!.email) : SEM_DIREITOS;
  const perfil = conta ? perfilAstralDaConta(conta.id) : null;

  /* ── Sem direito ───────────────────────────────────────────────────── */
  if (direitos.alcanceCalendario === 'nenhum') {
    return (
      <section className="w-full max-w-lg flex flex-col items-center gap-6 pt-8 text-center">
        <p className="font-display italic text-xl sm:text-2xl leading-relaxed text-pergaminho/85 max-w-[30ch]">
          &ldquo;O céu se move devagar, e eu venho anotando cada passo dele.
          Ainda não abri esta página para você.&rdquo;
        </p>
        <p className="font-corpo font-light text-sm text-pergaminho/50 max-w-[34ch] leading-relaxed">
          Aqui ficam seus dias marcados — amor, carreira, viagens e fortuna —
          lidos do seu próprio mapa.
        </p>
      </section>
    );
  }

  const natal = perfil ? mapaDaConta(perfil.dados) : null;

  /* ── Tem direito, faltam os dados ──────────────────────────────────── */
  if (!natal) {
    return (
      <section className="w-full max-w-lg flex flex-col items-center gap-6 pt-8 text-center">
        <p className="font-display italic text-xl leading-relaxed text-pergaminho/85 max-w-[30ch]">
          Falta o seu nascimento para eu desenhar o céu.
        </p>
        <p className="font-corpo font-light text-sm text-pergaminho/50 max-w-[34ch] leading-relaxed">
          {perfil?.faltando.length
            ? `Preciso ainda de ${perfil.faltando.join(', ')}.`
            : 'Preciso dos seus dados de nascimento.'}
        </p>
        <Link
          href="/conta"
          className="font-corpo text-sm px-6 py-2.5 rounded-full border border-vela/45 text-vela hover:bg-vela/10 transition-colors"
        >
          Completar meu mapa
        </Link>
      </section>
    );
  }

  const hoje = new Date();
  const navegaveis = mesesNavegaveis(hoje);

  /**
   * O mês pedido, se for um dos navegáveis. Qualquer outra coisa cai no
   * corrente — inclusive lixo na query, que assim não vira erro nem uma
   * janela para pedir cálculo de um ano arbitrário.
   */
  const indice = mesPedido
    ? navegaveis.findIndex(
        (m) => `${m.ano}-${String(m.mes + 1).padStart(2, '0')}` === mesPedido
      )
    : 0;
  const escolhido = navegaveis[indice >= 0 ? indice : 0];
  const posicao = indice >= 0 ? indice : 0;

  const mes = calcularMes(
    natal,
    direitos.alcanceCalendario,
    escolhido.ano,
    escolhido.mes,
    hoje
  );
  const ouro = diasDeOuro(mes, 4);

  return (
    <section className="w-full max-w-2xl flex flex-col gap-8 pt-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
          Calendário · {ALCANCE_EM_PALAVRAS[direitos.alcanceCalendario]}
        </p>
        <h1 className="font-display italic text-2xl sm:text-3xl text-pergaminho leading-tight">
          Os seus dias
        </h1>
      </div>

      {ouro.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-corpo text-[0.6rem] tracking-[0.22em] uppercase text-pergaminho/35">
            Dias de ouro deste mês
          </p>
          <div className="flex flex-wrap gap-2">
            {ouro.map((dia) => (
              <span
                key={dia.data}
                className="font-corpo text-xs px-3.5 py-2 rounded-full bg-vela/15 border border-vela/30 text-vela"
              >
                {new Date(`${dia.data}T12:00:00`).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                <span className="text-vela/60">
                  · {NOME_DO_DOMINIO[dia.destaque!.dominio]}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <GradeDoCalendario
        mes={mes}
        podeVoltar={posicao > 0}
        podeAvancar={posicao < navegaveis.length - 1}
        horaAproximada={perfil!.dados.horaAproximada}
        alcance={direitos.alcanceCalendario}
      />
    </section>
  );
}
