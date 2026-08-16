# Reestruturação: de sistema de pedidos a plataforma espiritual

> Documento vivo. Toda fase concluída atualiza a seção dela aqui.

## 1. Contexto

O Bruxário vende hoje **um artefato**: a pessoa paga, recebe PDF e imagens, o link
expira, acabou. É um sistema de pedidos, e ele funciona — está vendendo.

O que se quer é **acesso contínuo**: menu lateral, o Oráculo no centro, o perfil
(familiar + teste) de um lado, o Calendário Astrológico dando motivo pra voltar
todo dia, testes novos entrando com o tempo — tudo sob **uma assinatura**, com
planos de 14 dias, 30 dias, anual e vitalício.

E o segundo produto já foi feito por cópia: `src/lib/horoscopo/db.ts` abre um
SQLite próprio, `horoscopo/pagamento.ts` duplica o Mercado Pago, o `.env.example`
tem um bloco `MP_HOROSCOPO_*` inteiro espelhando o de cima. Somar Oráculo,
Calendário e testes novos nesse formato é somar cópias.

Mas nada disso vale se custar uma venda.

---

## 2. A regra que manda em tudo

> **A venda não para. Em nenhuma fase, em nenhum deploy, em nenhum momento.**
>
> Ninguém pode deixar de comprar. Nenhum dado pode deixar de chegar ao pixel.
> Nenhuma venda pode deixar de ser rastreada. Nenhuma entrega pode falhar.

Isso não é um desejo, é uma **restrição de projeto** — e ela decide a ordem das
fases, o formato de cada migração e o jeito de cada deploy. Quando "mais rápido" e
"sem risco pra venda" brigarem, ganha o segundo. Sempre.

### E é ela que decide qual fase vem primeiro

*Não dá pra garantir que a venda não quebrou se você não consegue ver a venda
quebrando.*

Hoje, se um webhook parar de chegar, se o pixel deixar de disparar num navegador,
se um pedido travar em `aguardando_pagamento`, se uma entrega falhar em silêncio —
a descoberta vem por reclamação ou por extrato. A camada de inteligência e
administração não é uma feature bonita pro fim: **é o instrumento que torna todas
as outras fases seguras.**

Ordem: rede de segurança → olhos → só então mexer em qualquer coisa.

---

## 3. As nove disciplinas

Valem em toda fase, sem exceção.

**1 · Nada de virada de chave.** O novo nasce ao lado do velho e convive com ele.
O velho só morre quando o novo já provou que funciona com tráfego real. Nunca
existe um deploy em que "agora é o sistema novo".

**2 · Migração é sempre aditiva.** Nunca `DROP` ou `RENAME` no mesmo deploy da
mudança de código. A sequência é: adiciona coluna/tabela → preenche → sobe código
que escreve nos dois → sobe código que lê do novo → espera → remove o velho numa
entrega futura e separada. Cada passo é revertível sozinho.

**3 · Interruptor em tudo.** Todo caminho novo nasce **desligado**. Liga primeiro
só pra sua conta, depois pra uma fatia do tráfego, depois pra todos. Se algo der
errado, desligar é uma linha no banco — não um rollback de deploy às duas da
manhã.

**4 · Modo sombra antes de confiar.** Antes do código novo *decidir* alguma coisa,
ele roda em paralelo com o velho, só **registrando** o que teria decidido. Quando
não divergirem por vários dias com tráfego real, aí o novo assume. Vale
especialmente pro `podeAcessar()`: ele decide quem vê o que a pessoa pagou, e um
erro ali é cliente trancado do lado de fora.

**5 · O caminho da venda é território sagrado.** Existe uma lista explícita
(seção 4) dos arquivos entre o clique e o dinheiro. Mexeu neles: teste ponta a
ponta obrigatório antes de subir, sem exceção e sem pressa.

**6 · O pixel nunca depende do navegador.** Bloqueador de anúncio, aba fechada
antes do script carregar, iOS — tudo isso já come dado hoje. O CAPI server-side
(`src/lib/capi.ts`) passa a ser a **fonte**, com `event_id` batendo com o do
navegador pra deduplicar. O navegador vira o backup, não o contrário. Fila com
retentativa: evento que falhou é reenviado, não perdido.

**7 · Deploy fora do pico.** O painel da Fase 1 vai dizer a que horas as pessoas
compram. Deploy acontece no vale, nunca durante campanha recém-lançada.

**8 · Rollback ensaiado, não improvisado.** Toda fase tem escrito, **antes de
começar**, como se desfaz. Se não dá pra escrever o rollback, a fase está mal
desenhada e precisa ser quebrada em pedaços menores.

**9 · Fase sem invariante não está pronta.** Todo código novo chega junto com as
regras que dizem o que "certo" significa nele (seção 5). Código sem invariante é
código que só avisa quando alguém reclama.

---

## 4. O caminho crítico

Os arquivos entre o clique e o dinheiro. Qualquer mudança aqui exige teste ponta a
ponta antes do deploy.

**Entrada e funil**
`src/app/page.tsx` · `LandingPrincipal.tsx` · `atravessar/FunilDeVendas.tsx` ·
`familiar/RitualLongo.tsx` · `ritual/RitualCliente.tsx` · `src/lib/funis.ts`

**Captura e pedido**
`api/quiz/route.ts` · `api/pedido/[id]/route.ts` ·
`api/pedido/[id]/escolher/route.ts` · `src/lib/validacao.ts`

**Pagamento**
`api/pedido/[id]/pagamento/route.ts` · `src/lib/pagamento.ts` ·
`components/CheckoutMercadoPago.tsx` · `src/lib/cupons.ts`

**Confirmação e entrega**
`api/webhook/route.ts` · `src/lib/processar.ts` · `src/lib/pdf.ts` ·
`src/lib/arte.ts` · `src/lib/email.ts` · `api/storage/[id]/[arquivo]/route.ts`

**Medição**
`src/lib/rastreio.ts` · `src/lib/capi.ts` · `components/MetaPixel.tsx` ·
`components/MarcaCompra.tsx` · `api/visita/route.ts` · `api/marco/route.ts`

---

## 5. A Sentinela — detecção de anomalias

### A ideia

Alarme solto envelhece mal: alguém escreve um `if` no lugar onde lembrou, e um ano
depois ninguém sabe o que é vigiado e o que não é.

A Sentinela é o contrário disso. Cada regra é uma **invariante**: uma afirmação que
tem que ser verdadeira sempre, escrita como função pura, num lugar só. Anomalia é
invariante violada. Nada de "erro estranho apareceu" — é sempre *qual* afirmação
deixou de valer, o que se esperava, o que se encontrou.

O exemplo que originou isto: **compra sem valor registrado e sem cupom** não é um
caso de erro, é a invariante `valor_cobrado == preço_do_plano − desconto_do_cupom`
falhando. Como afirmação ela cobre muito mais que o exemplo: cobre desconto maior
que o cupom permite, cupom expirado aceito, preço adulterado no caminho, plano
trocado depois do preço calculado.

### O princípio que não pode ser quebrado

> **A Sentinela observa e grita. Ela não bloqueia a venda.**

Detecção que derruba o caminho crítico é um jeito novo de perder dinheiro — e
contradiz a seção 2. Então:

- Toda checagem em linha roda dentro de `try/catch` e **falha aberto**: se a
  própria Sentinela quebrar, a venda segue e a falha dela vira anomalia.
- Nenhuma checagem entra antes da criação do pagamento.
- Quando uma anomalia é grave o bastante pra exigir ação, ela **segura a entrega
  pra revisão**, não a compra. Falso positivo custa um atraso de minutos; barrar a
  compra custa o cliente.

### Severidade

| Nível | O que é | O que acontece |
|---|---|---|
| `critico` | Dinheiro, acesso indevido, sinal de ataque | E-mail na hora + segura entrega se for fraude |
| `alto` | Fluxo quebrado, cliente prejudicado | E-mail no resumo da hora |
| `medio` | Falha técnica recuperável | Resumo diário |
| `baixo` | Desvio estatístico, ruído com padrão | Só no painel |

### O registro

```
anomalias(
  id, ocorrido_em, invariante, severidade,
  entidade_tipo, entidade_id,        -- pedido / conta / campanha / rota
  esperado, encontrado,              -- legível por humano
  contexto_json,
  resolvido_em, resolucao, falso_positivo
)
```

`esperado` e `encontrado` em texto legível são o que fazem a tela servir às 3 da
manhã. `falso_positivo` alimenta o ajuste das regras — invariante que grita à toa é
invariante que vai ser ignorada, e invariante ignorada é pior que invariante
inexistente.

### As invariantes

#### Integridade financeira — `critico`

- Pedido pago com `valor_centavos = 0` sem cupom de 100% válido registrado.
- `valor_cobrado ≠ preço_do_plano_na_data − desconto_do_cupom`.
- Desconto aplicado maior que o do cupom, ou cupom expirado, inexistente, ou além
  do limite de uso (`src/lib/cupons.ts` já tem as regras — a invariante confere
  o **resultado**, não repete a lógica).
- Mesmo `pagamento_externo_id` em dois pedidos.
- Pedido virou `pago` sem webhook correspondente registrado.
- Estorno no Mercado Pago sem registro no painel, ou o contrário.
- **Acesso sem origem** — conta com direito ativo que nenhuma assinatura dela
  concede. É a forma geral do exemplo que você deu, e a mais valiosa da lista:
  qualquer caminho que libere acesso sem pagamento cai aqui, inclusive um que
  ninguém previu.

#### Integridade do fluxo — `critico` / `alto`

- Entrega gerada para pedido não pago.
- Pedido pago há mais de N minutos sem entrega.
- Webhook para pedido que não existe.
- Marcos em ordem impossível (compra antes de checkout).
- Pedido criado sem sessão/visita associada — indica API chamada direto, fora do
  funil.
- Mesmo visitante criando muitos pedidos em poucos minutos.
- Assinatura ativa sem pagamento vinculado; ou `fim` anterior ao `inicio`; ou duas
  assinaturas do mesmo plano sobrepostas na mesma conta.

#### Abuso e sondagem — `critico` / `alto`

- Webhook com assinatura inválida. Já é rejeitado hoje — o que muda é **registrar
  a tentativa**: uma é ruído, cinquenta é ataque.
- Enumeração de identificadores: muitos 404 em `/api/pedido/[id]` ou
  `/api/storage/[id]/[arquivo]` da mesma origem.
- Tentativa de entrar em `/painel` com e-mail diferente do `ADMIN_EMAIL`.
- Link de acesso usado duas vezes, ou depois de expirado.
- Payload fora do schema em rota de API (`src/lib/validacao.ts` já valida — a
  invariante conta as rejeições e vê padrão).
- Teto de `src/lib/rate-limit.ts` estourado repetidamente pela mesma origem.

#### Saúde técnica — `medio`

- Exceção não tratada em rota de API.
- Chamada de IA falhando ou devolvendo fora do formato esperado.
- Geração de PDF, arte ou OG falhando.
- E-mail recusado pelo Resend.
- Job que não rodou na janela dele.
- Latência de rota fora da faixa histórica.

#### Desvio estatístico — `baixo`

- Conversão do dia fora da faixa histórica.
- Campanha com muitas visitas e nenhuma venda.
- Custo de IA por assinante fora da faixa.
- Concentração anormal de pedidos numa origem, país ou dispositivo.

### Onde roda

**Em linha**, no caminho do código, logo depois do fato — pega na hora, mas só vê
um registro por vez.

**Em varredura**, num job periódico — mais lento, porém enxerga o que só aparece
cruzando registros: duplicata, pedido travado, acesso sem origem, reconciliação
com o Mercado Pago.

As duas existem porque pegam coisas diferentes. A varredura também é a rede de
quando a checagem em linha falhou abrindo.

### O que ela não consegue ver

Honestidade sobre os limites, porque invariante em que se confia demais é pior que
nenhuma:

- **Cartão fraudado que passa legítimo** é problema do adquirente, não daqui.
- **Só vale o que é conferível no servidor.** Qualquer regra que dependa de valor
  vindo do navegador não é invariante — é sugestão. Preço, direito e desconto se
  recalculam do lado de cá, sempre, e a invariante compara o recalculado com o
  cobrado.
- **Não dá pra saber o que aconteceu no navegador** — só o que chegou. Daí a
  disciplina 6: o CAPI é a fonte.
- **Fraude bem-feita e paciente** (uma conta, um pedido, tudo dentro da faixa) não
  aparece. A Sentinela pega erro de código, exploração automatizada e desvio de
  padrão — que é a maioria esmagadora do que de fato acontece.

### Arquivos

```
src/nucleo/sentinela/
  invariantes/       uma pasta por família; cada regra é função pura e testável
  severidade.ts
  registrar.ts       grava, agrupa repetição, decide notificação
  emLinha.ts         o embrulho que falha aberto
  varredura.ts       o job
```

Painel: **Anomalias**, com filtro por severidade e estado, e botão de marcar falso
positivo.

---

## 6. As fases

### Fase 0 · Rede de segurança — ✅ concluída
*Nada muda pra quem compra. Nada muda na tela.*

- ✅ **Migrations numeradas** (`src/lib/migracoes/`, runner tolerante a
  concorrência, `001_base` marca o schema anterior sem mudar nada). `npm run migrar`.
- ✅ **Backup automático** com restauração testada (`npm run backup`,
  `src/lib/backup.ts`) — usa a API de backup nativa do SQLite, não cópia de
  arquivo, pra não perder o que só está no `-wal`.
- ✅ **Interruptores** (`src/lib/interruptores.ts`, tabela `interruptores`,
  rollout gradual por balde determinístico).
- ✅ **Ambiente de ensaio** (`npm run ensaio`, `BRUXARIO_DIR_DADOS`).
- ✅ **Teste automatizado do caminho crítico** completo:
  `src/lib/webhook-pagamento.test.ts` cobre pedido → pagamento → webhook →
  entrega → evento com código real, sem mocks.
- ✅ *Achado no caminho:* `npm test` rodava contra o banco de **produção**
  real — corrigido (banco isolado por execução).

*Rollback:* nada foi alterado; basta não usar.

---

### Fase 1 · Inteligência, administração e Sentinela — ✅ concluída
*(a parte visual não foi verificada num navegador de verdade — ver nota abaixo)*

- ✅ **Linha de vida da venda** — `/painel/pedidos/[id]`
  (`src/nucleo/linha-do-tempo.ts` + `LinhaDoTempo.tsx`). Junta marketing
  (toques), funil (marcos), sistema (eventos), pixel (fila CAPI) e Sentinela
  (anomalias) numa timeline só, ordenada por data.
- ✅ **Reconciliação com o Mercado Pago** (`src/nucleo/reconciliacao.ts`,
  `npm run reconciliar`). Usa `Payment.search` do SDK e reprocessa webhook
  perdido pelo MESMO caminho do webhook real (`processarNotificacaoDePagamento`)
  — não existe uma segunda lógica de "marcar pago". Rodou de verdade contra a
  API do MP em modo teste.
- ✅ **Fila de eventos com retentativa e dedup** (`src/lib/fila-capi.ts`,
  `npm run capi`, backoff exponencial até 8 tentativas). *Achado no caminho:*
  `MarcaCompra.tsx`/`MarcoDoCheckout.tsx` disparavam pro pixel do navegador
  **sem `event_id`** — ligar a fila teria contado toda venda como duas
  no Ads Manager sempre que o navegador também disparasse. Corrigido antes de
  ligar (`src/lib/pixel.ts` ganhou o parâmetro `eventId`).
- ✅ **Sentinela** (`src/nucleo/sentinela/`) com as invariantes do sistema como
  ele é hoje: valor cobrado bate com produto+cupom, entrega tem pagamento.
  Rodou contra produção: achou 1 pedido legado real (investigado, não é
  fraude) e um bug de deduplicação que faria spam de alarme em cron — corrigido.
- ✅ **Alarmes por e-mail** (`src/nucleo/alarmes.ts`, `npm run alarmes`) —
  junta anomalias críticas/altas, pedidos travados e falhas definitivas do
  CAPI num resumo pro `ADMIN_EMAIL`.
- 🟡 **Painel reorganizado como centro de comando**: não fechado à parte — o
  que existia (`central`, `Graficos.tsx`, `FiltroDePeriodo.tsx`) não foi
  redesenhado; só ganhou a tela nova de detalhe do pedido.

**Nota sobre verificação visual:** as telas desta fase foram construídas
seguindo os padrões visuais já existentes (`Shell.tsx`, `GraficosPeriodo.tsx`,
`Jornada.tsx` — mesmas classes, tokens de cor e estrutura), com build limpo e
a rota testada por HTTP (sobe, redireciona certo, não quebra) — mas **sem
abrir num navegador de verdade**, por não haver ferramenta de browser
disponível na sessão em que foi construída. Conferir visualmente antes de
considerar a Fase 1 inteiramente fechada.

*Rollback:* tudo é adição — telas, jobs, observação. Nada no caminho da venda muda.

---

### Fase 2 · Núcleo modular, por baixo — ✅ concluída
*Nada muda na tela. Escrita dupla e modo sombra.*

- ✅ **`src/nucleo/`**: `direitos.ts` (`unirDireitos` — booleano é OU, número é
  o maior), `planos.ts` (`revelacao`/`completa` semeados por migração,
  espelhando `produtos.ts` preço a preço, direito a direito),
  `assinaturas.ts` (`criarAssinatura` idempotente por `pedido_id`), `acesso.ts`
  (`direitosDaConta` / `podeAcessar` / `cotaDe` — o portão único que um dia
  substitui a checagem espalhada em `produtos.ts`).
- ✅ **Escrita dupla** — `processar.ts`, atrás de `assinaturas_escrita_dupla`
  (desligado por padrão): todo pedido pago também cria a assinatura
  equivalente, sem afetar a entrega mesmo se falhar (só loga).
- ✅ **Modo sombra** — `src/nucleo/sombra.ts`, chamado em
  `revelacao/[id]/page.tsx` quando a dona vê a própria leitura: compara o que
  `produtos.ts` decidiria contra o que `acesso.ts` decidiria e registra
  divergência como anomalia `medio` na Sentinela. Silencioso quando ainda não
  existe assinatura pro pedido — "não dá pra comparar" não é "bateu".
- ✅ *Achado no caminho:* índice único parcial (`assinaturas(pedido_id) WHERE
  pedido_id IS NOT NULL`) exige a mesma cláusula `WHERE` no `ON CONFLICT`,
  senão o SQLite recusa o insert. Corrigido em `assinaturas.ts`.
- ✅ **Verificado contra dados reais**: rodado em `npm run ensaio` (cópia
  isolada do banco de produção) contra os 2 pedidos com status `entregue` —
  as assinaturas criadas bateram 100% com `produtos.ts` nos dois, e a
  idempotência se confirmou (rodar duas vezes não duplica). Nenhuma escrita
  tocou o banco real; a cópia de ensaio foi apagada depois.
- 247/247 testes, build limpo.

*Rollback:* desliga o interruptor; a lógica antiga nunca parou de rodar.

---

### Fase 3 · Checkout como adaptador
`src/lib/pagamento.ts` vira `src/nucleo/checkouts/mercadopago.ts` atrás de uma
interface, com **comportamento idêntico** — os testes que já existem
(`pagamento.test.ts`, `webhook-assinatura.test.ts`, `modo-pagamento.test.ts`) são a
prova de que nada mudou.

```ts
interface Checkout {
  criarPagamento(pedido, plano): Promise<{ id, url?, parcelas }>;
  criarAssinatura?(conta, plano): Promise<{ id, url }>;
  verificarWebhook(req): Promise<{ valido, evento, referencia }>;
  consultarStatus(id): Promise<Status>;
}
```

Credenciais saem do `.env` pra tabela `contas_checkout`, cifradas com
`APP_SECRET` — é isso que mata o bloco `MP_HOROSCOPO_*`: duas contas do mesmo
provedor viram duas linhas, não duas famílias de variável de ambiente.

O checkout do marketing entra **depois**, por interruptor, com fatia pequena de
tráfego e o painel comparando conversão lado a lado.

*Rollback:* interruptor volta pro caminho antigo, que continua no código.

---

### Fase 4 · Módulos existentes migram
Familiar + teste viram `src/modulos/perfil/`. O horóscopo atual entra como módulo e
o silo `src/lib/horoscopo/` some, com `horoscopo.db` fundido no banco principal.

Prova o formato modular com código que já existe e já vende, antes de construir
coisa nova em cima dele.

---

### Fase 5 · A casca da plataforma
Menu lateral, Oráculo no centro, mobile impecável. **Risco zero de venda:** é tela
de quem já comprou; o funil não é tocado.

Menu montado do registro de módulos filtrado por `podeAcessar` — item sem direito
aparece apagado com o gancho de upgrade, não some. Some é oportunidade perdida.

**Mobile primeiro, e sério:** menu vira gaveta, barra inferior de 4 ícones.
`100dvh` e nunca `100vh`, composer com `env(safe-area-inset-bottom)`, histórico
ancorado no fim, nada de `position: fixed` brigando com a barra do Safari. Testar
no aparelho, não no devtools.

**O chat não digita ainda** — histórico, estado vazio e composer desabilitado com
um "em breve" bonito. A estética fica de pé e o cérebro entra na Fase 9 sem
retrabalho de layout. `TextoEscrito.tsx` já dá o tom das respostas.

Reaproveita `conta/layout.tsx`, `MenuDaConta.tsx`, `RelatorioCompleto.tsx`,
`CartaFamiliar.tsx`, `CirculoMagico.tsx`, `Constelacao.tsx`, `PoeiraNaLuz.tsx`.

---

### Fase 6 · Preços novos e acesso por tempo
**A fase de maior risco de receita, e por isso vem só aqui** — com o painel
medindo, a Sentinela vigiando e o núcleo provado.

Não entra por virada de chave: entra como **teste A/B contra o preço atual**, com a
máquina que já existe (`funis.ts`, `sortearEntre`, cookie de funil, código de
campanha). Converteu pior, volta.

*Rollback:* peso do braço novo vai a zero.

---

### Fase 7 · Calendário Astrológico
O motivo de voltar todo dia. Módulo novo **sem infra nova** — se precisar de
gambiarra aqui, o núcleo está errado, e é melhor descobrir agora que na Fase 10.

Mapa natal → dia a dia marcando **amor**, **carreira**, **viagens** e **fortuna**.
Cálculo offline e determinístico no espírito de `src/lib/astro.ts`:
`astronomy-engine` já é dependência e dá posição planetária pra qualquer data sem
API e sem custo. Para cada dia, aspectos dos trânsitos (Vênus, Júpiter, Marte,
Mercúrio, Sol, Lua) contra o mapa natal, com peso por domínio; os picos são os
"dias de ouro". **Zero LLM no caminho crítico** — é ele que segura a margem
enquanto o Oráculo gasta.

```
src/modulos/calendario/
  transitos.ts    efemérides e aspectos
  pontuacao.ts    score por domínio — puro, testável com data fixa
  calendario.ts   o mês / os 365 dias
  entrega.ts      PDF via pdf-lib
```

Reaproveita `astro.ts`, `signos.ts`, `zodiaco.ts`, `pdf.ts`, `cidades.json`,
`funil/RodaDeNascimento.tsx`, `funil/RodaDeHora.tsx`, `funil/EscolhaDeCidade.tsx`.

O direito controla o alcance: `"mes"` mostra o mês e borra o resto, `"ano"` abre os
12, `"rolante"` mantém 12 à frente pra sempre. **A borra é o anúncio.**

---

### Fase 8 · Oráculo — dúvida rápida
O chat liga, com cota de duas travas valendo. Barato de propósito: mede uso real e
calibra a cota do conselho antes do caro existir.

---

### Fase 9 · Oráculo — conselho, memória e guia semanal
A fase que justifica o preço. Detalhada na seção 8.

---

### Fase 10 · Recorrência, anual e vitalício
Renovação automática, parcelamento, upgrade de dentro da plataforma, cobrança falha
e retentativa. Depende do Calendário e do Oráculo existirem: não dá pra vender 12
meses antes de existir a razão de ficar 12 meses.

---

### Fase 11 · Máquina de análise
A Fase 1 responde *"a venda está viva?"*. Esta responde *"o negócio está
crescendo?"* — perguntas diferentes, as duas necessárias.

`analitica.ts` e `financeiro.ts` reescritos sobre um stream dimensionado:

```
eventos(visitante, sessao, ocorrido_em, tipo, nome,
        modulo, plano_id, fluxo, variante, campanha_id, peca_id,
        valor_centavos, custo_ia_centavos, meta_json)
```

As três tabelas de rastro (`visitas`, `marcos`, `toques`) colapsam nele — por
migração aditiva com escrita dupla, como manda a disciplina 2.

Painel ganha **MRR**, **churn por coorte**, **LTV por campanha**, caminho de
upgrade (14d → 30d → anual → vitalício), **retenção por módulo** e **margem por
plano**, com o custo de IA descontado da receita.

---

## 7. Os planos

| Plano | Preço | Duração | Dúvida rápida | Conselho | Calendário | Guia semanal |
|---|---|---|---|---|---|---|
| Revelação | R$ 14,90 | 14 dias | 3 no total | 1 no total | — | — |
| Completa | R$ 28,90 | 30 dias | 30/mês · 5/dia | 4/mês | mês corrente | sim |
| Anual | R$ 150 · 12× | 365 dias | 60/mês · 8/dia | 8/mês | 12 meses | sim |
| Vitalício | R$ 500 · 12× | para sempre | 60/mês · 8/dia | 8/mês | 12 rolantes | sim |

Anual e vitalício com `publico = false`: não aparecem na landing, só pra quem já
está dentro. O Calendário é a vitrine natural do upgrade.

**Cota de duas travas.** *"Até 5 por dia, mas 30 no mês"* são dois limites, não um:
o mensal é o que se vendeu, o diário impede alguém queimar o mês numa madrugada de
ansiedade e sumir. Protege margem *e* protege a pessoa.

```
consumo(conta_id, recurso, janela, chave, usado)
-- janela 'dia' → chave '2026-08-15'
-- janela 'mes' → chave '2026-08'
```

`consumir()` roda **numa transação** — sem isso, duas abas no celular gastam a
mesma pergunta duas vezes.

**Por que a Revelação leva 3 dúvidas e 1 conselho.** É isca de 14 dias; sem provar
o Oráculo, o upgrade não tem gatilho. Contagens *totais*, não mensais.

**Por que o conselho é escasso.** Custa muito mais de gerar — e um oráculo que dá
30 conselhos profundos por mês não é oráculo. A escassez é parte do produto.

**Sobre o anual.** 12 × 28,90 = R$ 346,80; a R$ 150 o desconto é de 57%. Canibaliza
o mensal de propósito: o objetivo é **caixa antecipado pra escalar tráfego**, e
R$ 150 hoje valem mais que R$ 346 espalhados por um ano que pode ter churn no
meio. Reconferir contra o CAC quando a Fase 11 medir.

---

## 8. O Oráculo

Não é chatbot. São **dois modos**, e o segundo é onde mora o preço.

**Dúvida rápida** — chat direto, curto, barato, cotidiano. É o hábito.

**Conselho** — a tela **muda**. Não é chat com mais texto, é outro lugar:

1. **Preparo** — som de chuva, luz baixa, o pedido pra acender uma vela. Já existe
   quase tudo: `AudioAmbiente.tsx`, `TocaAudio.tsx`, `src/lib/som.ts`,
   `public/audio/`, e `Chama.tsx` é literalmente uma chama.
2. **A pergunta, com prazo.** *"Daqui 21 dias tenho uma entrevista."* O campo mais
   valioso da tela inteira.
3. **Aprofundamento.** A IA lê a pergunta e gera **3 perguntas de contexto
   específicas** daquilo — entrevista de emprego rende perguntas que término de
   namoro não renderia. Formulário montado na hora, não questionário fixo.
4. **As cartas.** Sorteio com semente registrada, pra tiragem ser reproduzível.
5. **A leitura.** Cruza perfil · trânsitos dos próximos 7/14 dias **e do dia-alvo
   do prazo** · as 3 respostas · a tiragem · a memória do que ela já contou.

O que faz o conselho convencer não é o modelo — é ter contexto que nenhum chatbot
tem. E é honesto: os dados são dela, o cálculo astrológico é real e determinístico,
a tiragem fica registrada.

### Memória

```
memoria(id, conta_id, tipo, chave, valor, confianca, extraido_em, origem)
-- tipo: pessoa | trabalho | relacao | medo | objetivo | evento_datado
```

Depois de cada consulta, um passo barato extrai fatos e grava.

### O laço que fecha tudo

```
pergunta com prazo  →  evento_datado na memória
                    →  marcado no Calendário
                    →  guia semanal conta os dias e lê o trânsito daquele dia
                    →  no dia, um e-mail
                    →  ela volta e conta como foi
                    →  memória mais rica  →  próximo conselho melhor
```

Oráculo, Calendário e Perfil param de ser três telas e viram um organismo. É isso
que justifica assinatura em vez de compra avulsa, e é isso que ninguém clona
copiando o funil.

### Guia semanal

Domingo à noite, pra toda assinatura ativa com o direito: texto cruzando calendário
da semana + perfil + memória + prazos chegando. Vai por e-mail e fica na
plataforma. O padrão de job já existe em `scripts/` (`lembrar-carrinho.ts`,
`lembrar-rascunho.ts`) com Resend.

### Arquivos

```
src/modulos/oraculo/
  modos.ts · ritual/ · aprofundamento.ts · cartas.ts
  contexto.ts · memoria.ts · guia.ts
```

**Custo.** Conselho e guia semanal são as chamadas caras (`@google/genai`). Toda
chamada grava tokens e custo em `eventos` desde a primeira — margem por plano é
métrica de produto aqui, não curiosidade de fim de mês.

---

## 9. A forma dos arquivos

```
src/nucleo/          o que não pertence a nenhum produto
  planos.ts · direitos.ts · assinaturas.ts
  acesso.ts          podeAcessar() e consumir()  ← o portão único
  checkouts/         adaptadores de provedor
  sentinela/         as invariantes
  registro.ts        onde os módulos se anunciam

src/modulos/
  perfil/ · oraculo/ · calendario/ · <teste-novo>/

src/plataforma/      a casca: menu, chat, mobile
```

```ts
export interface Modulo {
  id: string;
  nome: string;
  rota: string;
  direito: string;                       // o que a assinatura precisa liberar
  menu(ctx): ItemDeMenu | null;
  contexto?(contaId): Promise<object>;   // o que ele empresta ao Oráculo
  invariantes?: Invariante[];            // disciplina 9
  entregar?(pedido): Promise<Entrega>;
}
```

**Teste de personalidade novo = criar `src/modulos/<x>/` + uma linha em `planos`.**
Menu, acesso, rastreio, cobrança e vigilância pegam sozinhos.

O `contexto()` é o detalhe que faz a plataforma parecer uma coisa só: é por ele que
o Oráculo sabe do seu familiar e dos seus trânsitos sem conhecer nenhum módulo por
nome.

---

## 10. Decisões em aberto

1. **Cota exata do conselho.** A tabela chuta 4/mês na Completa e 8 no anual. O
   número certo sai da Fase 8, medindo uso e custo real.
2. **Revelação e Completa renovam sozinhas?** Renovação automática em R$ 14,90 gera
   contestação; oferta manual no dia 12 talvez converta melhor sem queimar
   reputação.
3. **Quem já comprou.** O comentário em `produtos.ts:24-32` promete forte —
   *"ninguém perde o que pagou"*. Quem comprou a Completa comprou acesso sem prazo.
   Todo pedido pago existente vira **assinatura vitalícia do conjunto antigo de
   direitos**. Custa pouco e não quebra o que está escrito.

Nenhuma trava as Fases 0–2.

---

## 11. Riscos assumidos

- **Migração de `pedidos` com dados reais** é a parte perigosa. Roda no ambiente de
  ensaio contra cópia do banco, com script comparando contagens e amostra
  antes/depois, e vai por escrita dupla.
- **Segredo de checkout no banco** (cifrado por `APP_SECRET`) troca segurança de
  `.env` por poder plugar checkout pelo painel. É a troca certa pro objetivo, mas é
  troca — merece comentário explícito no código.
- **Custo de IA é variável e a assinatura é fixa.** Daí cota de duas travas,
  conselho escasso, Calendário determinístico e custo gravado por evento.
- **SQLite continua.** O volume não justifica Postgres, e trocar de banco no meio de
  reforma de schema soma dois riscos.
- **Sentinela barulhenta é Sentinela ignorada.** Falso positivo é tratado como
  defeito da regra, não como custo aceitável.

---

## 12. Verificação

- **Teste do caminho crítico** (Fase 0) roda antes de todo deploy que toque a
  seção 4.
- `npm test` a cada fase. Os testes existentes (`pagamento.test.ts`,
  `webhook-assinatura.test.ts`, `cupons.test.ts`, `rastreio.test.ts`,
  `analitica.test.ts`, `pontuacao.test.ts`) não podem quebrar; o que quebrar por
  mudança de contrato é reescrito, não deletado.
- Testes novos de função pura: `acesso.ts` (expiração, sobreposição de planos, teto
  diário batendo antes do mensal, cota virando no primeiro do mês),
  `calendario/pontuacao.ts` (score determinístico com data fixa) e **cada
  invariante da Sentinela**, alimentada com o caso violado e com o caso legítimo
  que mais se parece com ele.
- `npm run build` — o App Router estoura em erro de tipo em rota, então build limpo
  é sinal real.
- **E2E manual por fase** com `MP_MODO=teste`: entrar por `?c=xx`, atravessar o
  funil, pagar com cartão de teste, receber webhook por túnel, conferir que a
  assinatura nasceu com o fim certo, gastar até bater o teto do dia, virar o dia,
  gastar até bater o do mês, e ver o acesso fechar no fim.
- **Chat no celular de verdade**, não no devtools: iOS Safari e Android Chrome,
  teclado aberto e fechado, rotação.
- **Depois de todo deploy de fase:** conferir a linha de vida da venda e o painel de
  anomalias por 24h antes de considerar a fase fechada.
