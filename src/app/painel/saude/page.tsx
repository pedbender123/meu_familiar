import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { sinaisDoSistema } from '@/nucleo/saude/sinais';
import { quantosRuins, type Estado, type Sinal } from '@/nucleo/saude/tipos';
import { Bloco } from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Saúde', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Está tudo de pé, e o dinheiro está chegando onde deveria?
 *
 * Uma pergunta, em três segundos, sem interpretar nada.
 *
 * ── Por que não é o painel de métricas ────────────────────────────────────
 *
 * Vendas, receita e funil já têm lugar. Misturar as duas coisas faz o
 * vermelho de "a Wiven caiu" competir por atenção com "as vendas caíram
 * hoje", e são urgências de natureza diferente: uma se resolve mexendo no
 * .env, a outra se resolve mudando o anúncio.
 *
 * ── Por que cada linha ruim traz uma frase ────────────────────────────────
 *
 * O log já dizia `token não confere` oito vezes e ninguém viu. Uma tela que
 * exige leitura de log falhou antes de começar; uma que diz "está quebrado"
 * sem dizer o que fazer só transfere o susto. Ver
 * `docs/PLANO-PAINEL-DE-SAUDE.md` §4.2.
 */

const CORES: Record<Estado, { ponto: string; texto: string; rotulo: string }> = {
  ok: { ponto: '#4ADE80', texto: 'rgba(234,224,204,0.55)', rotulo: 'de pé' },
  atencao: { ponto: '#FACC15', texto: '#FACC15', rotulo: 'atenção' },
  quebrado: { ponto: '#F87171', texto: '#F87171', rotulo: 'quebrado' },
  /*
    Cinza, nunca vermelho. Falta de dado não é falha, e pintar as duas da
    mesma cor é como se ensina alguém a ignorar vermelho.
  */
  desconhecido: { ponto: 'rgba(234,224,204,0.28)', texto: 'rgba(234,224,204,0.4)', rotulo: 'sem dado' },
};

function Linha({ sinal }: { sinal: Sinal }) {
  const cor = CORES[sinal.estado];
  return (
    <div className="flex flex-col gap-1 py-2.5 border-b last:border-b-0"
      style={{ borderColor: 'var(--admin-borda)' }}>
      <div className="flex items-baseline gap-2.5">
        <span className="w-2 h-2 rounded-full shrink-0 translate-y-[-1px]"
          style={{ background: cor.ponto }} aria-hidden="true" />
        <span className="font-corpo text-[13px] text-pergaminho/85">{sinal.nome}</span>
        <span className="font-corpo text-[11px] ml-auto tabular-nums text-right"
          style={{ color: cor.texto }}>
          {sinal.valor ?? cor.rotulo}
        </span>
      </div>
      {sinal.oQueFazer && sinal.estado !== 'ok' && (
        <p className="font-corpo font-light text-[11px] leading-snug text-pergaminho/45 pl-[18px] max-w-[80ch]">
          {sinal.oQueFazer}
        </p>
      )}
    </div>
  );
}

export default async function TelaDeSaude() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const grupos = await sinaisDoSistema();
  const ruins = quantosRuins(grupos);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-titulo text-2xl text-pergaminho/90">Saúde do fluxo</h1>
        <p className="font-corpo font-light text-[12px] text-pergaminho/45 max-w-[70ch]">
          {ruins === 0
            ? 'Nada pedindo atenção agora. As linhas cinzas são coisas que ainda não deu para medir — não são falhas.'
            : `${ruins} ${ruins === 1 ? 'sinal pede' : 'sinais pedem'} atenção. Cada um diz o que fazer logo abaixo.`}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <Bloco key={g.titulo} titulo={g.titulo} nota={g.nota}>
            <div className="flex flex-col">
              {g.sinais.map((s) => (
                <Linha key={s.nome} sinal={s} />
              ))}
            </div>
          </Bloco>
        ))}
      </div>

      <p className="font-corpo font-light text-[11px] text-pergaminho/30 leading-snug max-w-[80ch]">
        Medido agora, ao abrir a tela. A sonda da Wiven tem cache de um minuto e o IP de
        saída, de uma hora — recarregar sem parar não mede mais rápido, e excesso de
        chamada já derrubou a conta da Wiven uma vez.
      </p>
    </div>
  );
}
