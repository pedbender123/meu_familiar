import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { direitosEfetivos } from '../src/nucleo/acesso';
import { perfilAstralDaConta } from '../src/nucleo/perfil-astral';
import { mapaDaConta } from '../src/modulos/calendario/calendario';
import { pontuarDia, ehDiaDeOuro, classificar, NOME_DO_DOMINIO } from '../src/modulos/calendario/pontuacao';
import {
  gerarGuiaSemanal,
  guardarGuia,
  guiaDaSemana,
  marcarGuiaEnviado,
  segundaDaSemana,
  type DiaCalculado,
} from '../src/modulos/oraculo/guia';
import { resumoParaContexto } from '../src/modulos/oraculo/arquivo';
import { descreverPerfil } from '../src/lib/processar';
import { enviarGuiaSemanal } from '../src/lib/email';
import { criarTokenMagico } from '../src/lib/autenticacao';
import { FAMILIARES, type FamiliarId } from '../src/lib/familiares';

/**
 * O guia da semana, domingo à noite.
 *
 * ── Por que ele é o item mais atrasado da lista ───────────────────────────
 *
 * A `/planos` já diz, na tela, que o plano do meio entrega "o guia chega no
 * seu e-mail" — e os testes garantem que o DIREITO existe no banco, não que a
 * coisa exista no mundo. Vender uma entrega recorrente que não roda é a única
 * forma de churn que a gente causa sozinho.
 *
 * ── O que ele não faz ─────────────────────────────────────────────────────
 *
 * Não inventa astrologia. As notas por domínio e a classe de cada dia chegam
 * calculadas de `astronomy-engine` contra o mapa natal dela; o modelo escreve
 * a prosa em cima de números que não escolheu. É o que separa isto de um
 * gerador de texto bonito — e é o que faz a pessoa reconhecer a quinta-feira
 * quando ela chegar.
 *
 * ── Custo ─────────────────────────────────────────────────────────────────
 *
 * Uma chamada de IA por pessoa por semana, gravada em `guias_semanais` com o
 * custo junto. É a única entrega cujo gasto cresce com a base — por isso a
 * unicidade `(conta_id, semana)` é do banco, não de um `if`: cron rodado duas
 * vezes por engano não gera dois guias, porque não consegue.
 *
 * Uso:  npm run guia-semanal [--simular] [--forcar]
 * Cron: 0 20 * * 0 cd /root/apps/bruxario && npm run guia-semanal
 */

const DIAS_DA_SEMANA = [
  'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
];

function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

interface Assinante {
  id: string;
  email: string;
  nome: string;
  familiar: string | null;
  perfil_json: string | null;
}

/** Contas com assinatura ativa — o direito é conferido por linha. */
function assinantes(): Assinante[] {
  return db
    .prepare(
      `SELECT DISTINCT c.id, c.email,
              COALESCE(p.nome, '') AS nome,
              p.familiar AS familiar,
              p.perfil_json AS perfil_json
         FROM contas c
         JOIN assinaturas a ON a.conta_id = c.id AND a.status = 'ativa'
         LEFT JOIN pedidos p ON p.id = (
              SELECT p2.id FROM pedidos p2
               WHERE lower(p2.email) = lower(c.email) AND p2.status = 'entregue'
               ORDER BY p2.criado_em DESC LIMIT 1
         )
        WHERE c.nascimento_data IS NOT NULL AND c.nascimento_lat IS NOT NULL`
    )
    .all() as Assinante[];
}

async function main() {
  const secos = process.argv.includes('--simular');
  const forcar = process.argv.includes('--forcar');
  const agora = new Date();
  const base = process.env.BASE_URL || 'http://localhost:3000';

  /**
   * A semana que COMEÇA. Rodando domingo à noite, `segundaDaSemana(amanhã)`
   * é a segunda seguinte — o guia fala do que vem, não do que passou.
   */
  const amanha = new Date(agora.getTime() + 86_400_000);
  const semana = segundaDaSemana(amanha);
  const inicio = new Date(`${semana}T12:00:00`);

  const lista = assinantes();
  console.log(`Semana de ${semana} · ${lista.length} assinante(s) com mapa natal`);

  let gerados = 0;
  let enviados = 0;
  let custoTotal = 0;

  for (const pessoa of lista) {
    const direitos = direitosEfetivos(pessoa.id, pessoa.email, agora);
    if (!direitos.guiaPorEmail) continue;

    // O banco recusaria a duplicata, mas conferir antes evita gastar a
    // chamada de IA para depois jogar fora.
    const existente = guiaDaSemana(pessoa.id, semana);
    if (existente && !forcar) {
      console.log(`  ${pessoa.email} — já tem guia desta semana`);
      continue;
    }

    const { dados } = perfilAstralDaConta(pessoa.id);
    const natal = mapaDaConta(dados);
    if (!natal) continue;

    const dias: DiaCalculado[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio.getTime() + i * 86_400_000);
      const pontuacao = pontuarDia(natal, d);
      const geral =
        Object.values(pontuacao).reduce((s: number, n) => s + (n as number), 0) /
        Object.keys(pontuacao).length;
      const melhor = Object.entries(pontuacao).sort(
        (a, b) => (b[1] as number) - (a[1] as number)
      )[0];

      dias.push({
        data: chaveDoDia(d),
        nome: DIAS_DA_SEMANA[d.getDay()],
        classe: classificar(geral),
        ouro: ehDiaDeOuro(pontuacao),
        pontuacao,
        destaque: melhor
          ? {
              dominio:
                NOME_DO_DOMINIO[melhor[0] as keyof typeof NOME_DO_DOMINIO] ?? melhor[0],
              nota: melhor[1] as number,
            }
          : undefined,
      });
    }

    const familiar = pessoa.familiar
      ? FAMILIARES[pessoa.familiar as FamiliarId]?.nome
      : null;

    console.log(
      `  ${pessoa.email} — ${dias.filter((d) => d.ouro).length} dia(s) de ouro na semana`
    );
    if (secos) continue;

    try {
      const resposta = await gerarGuiaSemanal({
        nomeDaPessoa: pessoa.nome,
        nomeDoFamiliar: familiar ?? 'Seu familiar',
        perfil: descreverPerfil(pessoa.perfil_json) ?? 'Perfil ainda não calculado.',
        dias,
        historico: resumoParaContexto(pessoa.id).join('\n') || undefined,
      });

      const id = guardarGuia({
        contaId: pessoa.id,
        semana,
        corpo: resposta.dados,
        modelo: resposta.modelo,
        custoCentavos: resposta.custoCentavos,
        tokensEntrada: resposta.tokensEntrada,
        tokensSaida: resposta.tokensSaida,
      });
      gerados++;
      custoTotal += resposta.custoCentavos;

      const token = criarTokenMagico(pessoa.email, 'conta');
      await enviarGuiaSemanal({
        email: pessoa.email,
        nome: pessoa.nome,
        nomeDoFamiliar: familiar ?? 'Seu familiar',
        url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg&r=${encodeURIComponent('/conta/calendario')}`,
        guia: resposta.dados,
      });
      marcarGuiaEnviado(id);
      enviados++;
    } catch (erro) {
      // Guia guardado e e-mail falhado é melhor que nada: a pessoa acha na
      // plataforma, e `enviado_em` nulo denuncia o que não saiu.
      console.error(`  falhou para ${pessoa.email}:`, erro);
    }
  }

  console.log(
    secos
      ? 'SIMULAÇÃO — nada gerado.'
      : `${gerados} guia(s) gerado(s), ${enviados} enviado(s) · custo ${(custoTotal / 100).toFixed(2)}`
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
