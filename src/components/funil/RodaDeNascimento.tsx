'use client';

import { RodaDeSelecao, ALTURA_ITEM } from './RodaDeSelecao';
import { Constelacao } from './Constelacao';
import { signoDe, vizinhosDe } from '@/lib/signos';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * A data de nascimento em disco, com a constelação aparecendo enquanto rola.
 *
 * ── Por que roda e não campo de data ──────────────────────────────────────
 *
 * O `<input type="date">` é mais rápido de preencher, e é exatamente por isso
 * que é pior aqui. A rolagem demora, e a demora é o ponto: a constelação muda
 * sob o dedo enquanto a pessoa procura a própria data. Ela vê o sistema
 * reagindo a ela ANTES de ter entregado qualquer coisa, e chega ao fim do
 * gesto já tendo recebido algo.
 *
 * Isso só funciona se a troca for imediata. Ver `RodaDeSelecao`: o valor muda
 * durante o gesto, não quando a rolagem para.
 *
 * ── A constelação é grande de propósito ───────────────────────────────────
 *
 * O funil é de celular, e no celular o que se lê de relance é o que é grande.
 * A do meio ocupa quase o dobro das vizinhas e é a única com brilho e
 * cintilação — quem bate o olho sabe qual é a sua sem ler o nome.
 */
export function RodaDeNascimento({
  ano,
  mes,
  dia,
  onChange,
}: {
  ano: number;
  mes: number;
  dia: number;
  onChange: (v: { ano: number; mes: number; dia: number }) => void;
}) {
  const anoAtual = new Date().getFullYear();
  // De 16 a 95 anos: abaixo disso é menor de idade, e o produto não é para
  // menor — limitar na roda evita a conversa depois da venda.
  const anos = Array.from({ length: 80 }, (_, i) => anoAtual - 16 - i);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  const signo = signoDe(mes + 1, Math.min(dia, diasNoMes));
  const { antes, depois } = vizinhosDe(signo);

  function set(patch: Partial<{ ano: number; mes: number; dia: number }>) {
    const novo = { ano, mes, dia, ...patch };
    // Trocar o mês pode invalidar o dia: 31 de fevereiro não existe.
    novo.dia = Math.min(novo.dia, new Date(novo.ano, novo.mes + 1, 0).getDate());
    onChange(novo);
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-center gap-3 sm:gap-5 min-h-[132px]">
        <Vizinha signo={antes} />

        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <Constelacao signo={signo.nome} tamanho={104} intensidade={1} animada />
          <span className="font-display italic text-xl sm:text-2xl text-escrita leading-none mt-1">
            {signo.nome}
          </span>
        </div>

        <Vizinha signo={depois} />
      </div>

      <div className="relative flex">
        {/*
          A faixa que marca a escolha. Fica ATRÁS das colunas (z-0 contra z-10)
          e sem captar clique: ela é indicação de onde ler, e um alvo de toque
          invisível no meio da roda roubaria o gesto de rolagem.
        */}
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-2xl pointer-events-none z-0"
          style={{
            height: ALTURA_ITEM,
            background:
              'linear-gradient(to right, transparent, color-mix(in srgb, var(--ouro-velho) 14%, transparent) 18%, color-mix(in srgb, var(--ouro-velho) 14%, transparent) 82%, transparent)',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ouro-velho) 26%, transparent)',
          }}
        />
        <div className="relative z-10 flex w-full">
          <RodaDeSelecao
            aria="Mês"
            opcoes={MESES.map((m, i) => ({ valor: i, rotulo: m }))}
            valor={mes}
            onChange={(v) => set({ mes: v })}
          />
          <RodaDeSelecao
            aria="Dia"
            opcoes={Array.from({ length: diasNoMes }, (_, i) => ({
              valor: i + 1,
              rotulo: String(i + 1),
            }))}
            valor={Math.min(dia, diasNoMes)}
            onChange={(v) => set({ dia: v })}
          />
          <RodaDeSelecao
            aria="Ano"
            opcoes={anos.map((a) => ({ valor: a, rotulo: String(a) }))}
            valor={ano}
            onChange={(v) => set({ ano: v })}
          />
        </div>
      </div>
    </div>
  );
}

function Vizinha({ signo }: { signo: { nome: string } }) {
  return (
    <div className="flex flex-col items-center gap-1 opacity-30 shrink-0">
      <Constelacao signo={signo.nome} tamanho={52} intensidade={0.5} />
      <span className="font-corpo text-[0.68rem] text-escrita-fraca leading-none">
        {signo.nome}
      </span>
    </div>
  );
}
