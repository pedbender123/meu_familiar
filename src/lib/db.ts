import Database from 'better-sqlite3';
import fs from 'fs';
import { BANCO, DADOS } from './caminhos';
import { PRODUTO_PADRAO, type ProdutoId } from './produtos';
import { executarMigracoes } from './migracoes/runner';

if (!fs.existsSync(DADOS)) fs.mkdirSync(DADOS, { recursive: true });

const db = new Database(BANCO);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    cpf TEXT,
    respostas_json TEXT NOT NULL,
    familiar TEXT NOT NULL,
    lua TEXT NOT NULL,
    signo_sol TEXT,
    signo_lua TEXT,
    produto TEXT NOT NULL DEFAULT '${PRODUTO_PADRAO}',
    status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    pagamento_id TEXT,
    pix_copia_e_cola TEXT,
    perfil_json TEXT,
    desempatado_pela_pessoa INTEGER NOT NULL DEFAULT 0,
    expira_em TEXT,
    pago_em TEXT,
    lembrete_em TEXT,
    melhoria_pagamento_id TEXT,
    melhoria_paga_em TEXT,
    melhoria_bruto_centavos INTEGER,
    acesso_gratis_em TEXT,
    exemplo INTEGER NOT NULL DEFAULT 0,
    leitura_json TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Uma linha por página vista.
  --
  -- A coluna visitante é um id aleatório num cookie primeiro-parte, sem
  -- relação com identidade nenhuma: separa "20 visitas" de "20 pessoas". Não
  -- guardamos IP aqui — só a origem, o caminho e o aparelho, que é o que
  -- responde "de onde vem gente e o que ela olha".
  CREATE TABLE IF NOT EXISTS visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitante TEXT NOT NULL,
    caminho TEXT NOT NULL,
    origem TEXT,
    referencia TEXT,
    dispositivo TEXT,
    criado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_visitas_data ON visitas (criado_em);
  CREATE INDEX IF NOT EXISTS idx_visitas_origem ON visitas (origem);

  -- Marcos da jornada: um evento por passo que a pessoa deu.
  --
  -- Separado de visitas de propósito. Visita responde "quantos chegaram";
  -- marco responde "até onde foram" — que é a pergunta cara. O campo valor
  -- carrega o número da cena, para dar a curva de desistência pergunta a
  -- pergunta em vez de um único degrau "abriu o ritual".
  CREATE TABLE IF NOT EXISTS marcos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitante TEXT NOT NULL,
    marco TEXT NOT NULL,
    valor INTEGER,
    variante TEXT,
    origem TEXT,
    criado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_marcos_data ON marcos (criado_em);
  CREATE INDEX IF NOT EXISTS idx_marcos_nome ON marcos (marco);

  -- Rascunho: e-mail deixado no meio do ritual, antes de existir pedido.
  --
  -- Existe para uma coisa só: poder chamar de volta quem largou na cena 12.
  -- Sem ele, quem não termina o ritual não deixa rastro nenhum — e essa é a
  -- maioria das pessoas que um anúncio traz.
  CREATE TABLE IF NOT EXISTS rascunhos (
    visitante TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    cena INTEGER NOT NULL DEFAULT 0,
    origem TEXT,
    variante TEXT,
    virou_pedido INTEGER NOT NULL DEFAULT 0,
    lembrete_em TEXT,
    melhoria_pagamento_id TEXT,
    melhoria_paga_em TEXT,
    melhoria_bruto_centavos INTEGER,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Quem prometeu compartilhar nos stories em troca das recompensas.
  --
  -- A coluna conferido separa "disse que marcou" de "eu vi a marcação".
  -- Sem ela, a recompensa seria entregue na palavra de quem digita — e o
  -- campo é um input livre num site aberto.
  CREATE TABLE IF NOT EXISTS marcacoes (
    id TEXT PRIMARY KEY,
    pedido_id TEXT,
    email TEXT NOT NULL,
    arroba TEXT NOT NULL,
    conferido INTEGER NOT NULL DEFAULT 0,
    recompensado INTEGER NOT NULL DEFAULT 0,
    token TEXT,
    criado_em TEXT NOT NULL,
    conferido_em TEXT
  );

  -- Cupons de desconto. O código é a chave: não existem dois iguais, e o
  -- normalizador em cupons.ts garante que "amiga-10" e "AMIGA10" colidam aqui
  -- em vez de virarem dois cupons diferentes.
  CREATE TABLE IF NOT EXISTS cupons (
    codigo TEXT PRIMARY KEY,
    desconto_percentual INTEGER NOT NULL,
    usos_max INTEGER,
    usos INTEGER NOT NULL DEFAULT 0,
    expira_em TEXT,
    nota TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oraculo_espera (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    pergunta TEXT NOT NULL,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    pedido_id TEXT,
    criado_em TEXT NOT NULL
  );

  -- Comentário do comprador sobre a própria revelação.
  --
  -- A coluna aprovado começa em 0 e separa "alguém escreveu" de "está na
  -- vitrine". Mural público sem moderação é convite para a primeira pessoa
  -- mal-intencionada escrever qualquer coisa na sua página de vendas.
  CREATE TABLE IF NOT EXISTS comentarios (
    id TEXT PRIMARY KEY,
    pedido_id TEXT NOT NULL UNIQUE,
    texto TEXT NOT NULL,
    aprovado INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_comentarios_aprovados ON comentarios(aprovado, criado_em);

  -- Canal de contato. É o "encarregado" que a LGPD exige (art. 41): um lugar
  -- onde a pessoa fala com você sobre os dados dela e recebe resposta. Não
  -- precisa ser cargo formal numa operação deste tamanho — precisa existir e
  -- responder.
  CREATE TABLE IF NOT EXISTS contatos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    assunto TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    pedido_id TEXT,
    resolvido_em TEXT,
    criado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_contatos_abertos ON contatos(resolvido_em, criado_em);

  -- SPEC 0.8: "desafios como entidade no banco, mesmo vazia". Nasce sem uso e
  -- é isso mesmo — o crescimento é a Parte VI e está fora do v1. Existe agora
  -- porque criar a tabela depois é fácil, mas RECONSTRUIR o histórico que ela
  -- deveria ter acumulado é impossível.
  CREATE TABLE IF NOT EXISTS desafios (
    id TEXT PRIMARY KEY,
    pedido_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    origem TEXT NOT NULL,
    superado_em TEXT,
    criado_em TEXT NOT NULL
  );

  -- Uma campanha de tráfego, com a janela em que ela rodou.
  --
  -- Existe para responder "o que ESTE anúncio trouxe", que nenhuma métrica
  -- agregada responde: o painel filtra tudo (visitas, marcos, pedidos,
  -- receita) pelo intervalo de início/fim e compara com o que foi gasto.
  --
  -- A coluna fim é NULL enquanto a campanha está no ar — o relatório usa
  -- "agora" nesse caso, então dá para acompanhar em tempo real sem fechar.
  CREATE TABLE IF NOT EXISTS campanhas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    plataforma TEXT,
    inicio TEXT NOT NULL,
    fim TEXT,
    investido_centavos INTEGER NOT NULL DEFAULT 0,
    alcance_estimado INTEGER,
    nota TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_campanhas_inicio ON campanhas (inicio);

  -- Uma peça de campanha: o vídeo, o criativo, o story específico.
  --
  -- ── Por que isto precisa existir ──────────────────────────────────────
  --
  -- Uma campanha com três vídeos rodando junto é, na prática, três campanhas
  -- cujo resultado o painel somava num número só. Saber que "o Instagram
  -- trouxe 40 pessoas" não permite decisão nenhuma — a decisão é qual vídeo
  -- pausar, e para isso o clique precisa carregar QUAL peça o trouxe.
  --
  -- O código tem no máximo 2 caracteres porque ele viaja na URL do anúncio
  -- ("?c=ig01") e é digitado por gente em bio de rede social.
  CREATE TABLE IF NOT EXISTS pecas (
    id TEXT PRIMARY KEY,
    campanha_id TEXT NOT NULL,
    codigo TEXT NOT NULL,
    nome TEXT NOT NULL,
    nota TEXT,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL,
    UNIQUE (campanha_id, codigo)
  );

  CREATE INDEX IF NOT EXISTS idx_pecas_campanha ON pecas (campanha_id);

  -- **Cada chegada rastreável de uma pessoa ao site, em ordem.**
  --
  -- ── O problema que isto resolve ───────────────────────────────────────
  --
  -- Antes existia só o cookie "bx_de": uma string, primeira origem vence,
  -- sem histórico. Ele respondia "de onde veio" e mais nada — e respondia
  -- errado com frequência, porque quem chegava sem parâmetro virava "outro"
  -- e ficava indistinguível de quem digitou o endereço, de quem clicou num
  -- link de e-mail e de quem veio por indicação.
  --
  -- Aqui cada chegada vira uma LINHA. A jornada inteira fica legível: veio
  -- pelo vídeo 02 do Instagram, sumiu, voltou pelo e-mail de resgate, fechou
  -- pelo remarketing. Nenhuma dessas informações cabia numa string.
  --
  -- ── "conta_aquisicao" é o campo que conserta o número ─────────────────
  --
  -- Nem todo toque é uma aquisição. O link do e-mail de login é a pessoa
  -- VOLTANDO a algo que ela já comprou — creditar isso ao "canal e-mail"
  -- rouba a venda de quem realmente a trouxe e infla um canal que não traz
  -- ninguém novo. Então o toque é gravado (a jornada precisa dele) mas com
  -- "conta_aquisicao = 0".
  --
  -- Remarketing é o oposto: aquele e-mail existe para trazer de volta alguém
  -- que tinha ido embora, e quando fecha venda o crédito é dele.
  CREATE TABLE IF NOT EXISTS toques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitante TEXT NOT NULL,
    -- 'campanha' | 'social' | 'compartilhamento' | 'remarketing'
    -- | 'email' | 'direto'
    tipo TEXT NOT NULL,
    origem TEXT,
    campanha_id TEXT,
    peca_id TEXT,
    -- Quem compartilhou, quando o toque veio de um link de cliente.
    indicado_por TEXT,
    conta_aquisicao INTEGER NOT NULL DEFAULT 1,
    caminho TEXT NOT NULL,
    referencia TEXT,
    criado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_toques_visitante ON toques (visitante, criado_em);
  CREATE INDEX IF NOT EXISTS idx_toques_data ON toques (criado_em);
  CREATE INDEX IF NOT EXISTS idx_toques_campanha ON toques (campanha_id);

  -- Qualquer saída de dinheiro que não seja taxa de gateway nem IA: anúncio,
  -- domínio, VPS, arte comprada. As duas que o sistema já sabe calcular
  -- (taxa do MP e custo de IA) NÃO entram aqui, senão seriam contadas duas
  -- vezes no lucro.
  CREATE TABLE IF NOT EXISTS despesas (
    id TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL,
    valor_centavos INTEGER NOT NULL,
    campanha_id TEXT,
    ocorrido_em TEXT NOT NULL,
    nota TEXT,
    criado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas (ocorrido_em);

  -- Um e-mail de remarketing, do rascunho ao envio.
  --
  -- A linha nasce como rascunho (texto gerado, ainda não enviado) e só vira
  -- 'enviado' depois que você leu e confirmou. Guardar o texto importa por
  -- dois motivos: dá para reler o que foi prometido a cada pessoa quando ela
  -- responder, e impede mandar duas ofertas diferentes para o mesmo endereço
  -- sem perceber.
  CREATE TABLE IF NOT EXISTS remarketing (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    nome TEXT,
    visitante TEXT,
    pedido_id TEXT,
    campanha_id TEXT,
    produto TEXT NOT NULL,
    desconto_percentual INTEGER NOT NULL,
    cupom TEXT,
    assunto TEXT NOT NULL,
    corpo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'rascunho',
    erro TEXT,
    criado_em TEXT NOT NULL,
    enviado_em TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_remarketing_email ON remarketing (email);
  CREATE INDEX IF NOT EXISTS idx_remarketing_status ON remarketing (status, criado_em);

  -- Quem pediu para sair. **Consultada antes de todo envio.**
  --
  -- Existe porque link de descadastro sem efeito é pior que não ter link:
  -- a pessoa clica, continua recebendo, e marca como spam — que é o que de
  -- fato derruba a entrega de TODOS os e-mails do domínio, inclusive os de
  -- quem pagou e está esperando a revelação.
  CREATE TABLE IF NOT EXISTS descadastros (
    email TEXT PRIMARY KEY,
    origem TEXT,
    criado_em TEXT NOT NULL
  );

  /**
   * Ofertas da Cakto, indexadas pelo preço.
   *
   * Existe porque a API da Cakto NAO aceita cobrar um valor: items[0].offerId
   * é obrigatório e o preço vem da oferta cadastrada na conta deles. Amarrar
   * preço a cadastro manual devolveria a decisão de quanto custa para uma tela
   * de painel — exatamente o que produtoVigente existe para impedir.
   *
   * Então a oferta vira detalhe interno: dado um preço, o adaptador procura
   * aqui, e se não achar, cria a oferta na Cakto e grava. O preço continua
   * sendo nosso, em centavos, e qualquer cupom novo funciona sem ninguém
   * abrir o painel deles.
   *
   * Chaveado por (produto, preço): a mesma Revelação a 16,00 e a 12,80 são
   * duas ofertas, e dois produtos diferentes no mesmo preço também são.
   */
  CREATE TABLE IF NOT EXISTS ofertas_cakto (
    produto TEXT NOT NULL,
    preco_centavos INTEGER NOT NULL,
    offer_id TEXT NOT NULL,
    nome TEXT,
    criado_em TEXT NOT NULL,
    PRIMARY KEY (produto, preco_centavos)
  );
`);

/**
 * Migração idempotente. O schema acima só vale para banco novo — o que já
 * existe na VPS foi criado na época do Asaas, com `asaas_payment_id` e
 * `invoice_url` e sem coluna de produto. Roda a cada boot: barato, e evita um
 * passo manual de deploy que alguém esquece.
 *
 * Precisa tolerar **concorrência**, não só repetição: o `next build` sobe vários
 * workers, cada um importa este módulo, e todos leem o schema antes de qualquer
 * um escrever. Sem isso o segundo worker morre com "duplicate column name" e o
 * build inteiro falha — foi exatamente o que aconteceu.
 */
function adicionarColunaSeFaltar(
  coluna: string,
  tipo: string,
  tabela = 'pedidos'
): boolean {
  try {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
    return true;
  } catch (erro) {
    // Outro processo chegou primeiro (ou a coluna já existia): é sucesso, não
    // falha. Qualquer outro erro de SQL continua subindo.
    if (erro instanceof Error && /duplicate column name/i.test(erro.message)) {
      return false;
    }
    throw erro;
  }
}

function garantirColunas() {
  const colunasAntigas = new Set(
    (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    )
  );

  adicionarColunaSeFaltar('produto', `TEXT NOT NULL DEFAULT '${PRODUTO_PADRAO}'`);
  const pagamentoIdNasceuAgora = adicionarColunaSeFaltar('pagamento_id', 'TEXT');
  adicionarColunaSeFaltar('pix_copia_e_cola', 'TEXT');
  // SPEC 0.8, travado: os 12 escores salvos, não só o vencedor. É barato agora
  // e evita ter que refazer o quiz de todo mundo quando a roda dos 12 e o
  // crescimento (Parte VI) precisarem do dado.
  adicionarColunaSeFaltar('perfil_json', 'TEXT');
  adicionarColunaSeFaltar('desempatado_pela_pessoa', 'INTEGER NOT NULL DEFAULT 0');
  // Acesso temporário da Revelação. `expira_em` NULL significa "para sempre" —
  // é o estado da Completa e de quem comprou o link permanente depois.
  adicionarColunaSeFaltar('expira_em', 'TEXT');
  adicionarColunaSeFaltar('pago_em', 'TEXT');
  // Recuperação de carrinho: marca quando o lembrete saiu, para não mandar
  // duas vezes. Sem isso, rodar o job de novo vira spam.
  adicionarColunaSeFaltar('lembrete_em', 'TEXT');
  adicionarColunaSeFaltar('melhoria_pagamento_id', 'TEXT');
  adicionarColunaSeFaltar('melhoria_paga_em', 'TEXT');
  adicionarColunaSeFaltar('melhoria_bruto_centavos', 'INTEGER');
  adicionarColunaSeFaltar('acesso_gratis_em', 'TEXT');
  // Marca as revelações que somos NÓS que geramos para a vitrine. Sem esta
  // coluna não dá para separar amostra de cliente na hora de contar receita
  // nem de medir distribuição dos 12 — e as duas medidas ficariam mentindo.
  adicionarColunaSeFaltar('exemplo', 'INTEGER NOT NULL DEFAULT 0');
  // Cupom aplicado. Guardamos o percentual JUNTO com o código porque o cupom
  // pode ser editado depois — e o preço de quem já comprou não pode mudar
  // retroativamente. Ver a nota em cupons.ts.
  adicionarColunaSeFaltar('cupom', 'TEXT');
  adicionarColunaSeFaltar('desconto_percentual', 'INTEGER');
  // Marca que o uso do cupom já foi contado, para reprocessamento e webhook
  // repetido não incrementarem o contador duas vezes pelo mesmo pedido.
  adicionarColunaSeFaltar('cupom_contabilizado', 'INTEGER NOT NULL DEFAULT 0');
  // De onde a pessoa veio, capturado na primeira visita e carregado até a
  // compra. É o que permite responder "TikTok ou Instagram vende mais?" —
  // pergunta que contagem de visita sozinha não responde.
  adicionarColunaSeFaltar('origem', 'TEXT');
  adicionarColunaSeFaltar('visitante', 'TEXT');
  // Qual página de vendas a pessoa viu. Sem isto o teste A/B não tem como
  // dizer qual variante gerou a venda — só quantas visitas cada uma teve.
  adicionarColunaSeFaltar('variante', 'TEXT');
  // Consultas ao Oráculo ganhas por compartilhar. Somam às do produto.
  adicionarColunaSeFaltar('bonus_oraculo', 'INTEGER NOT NULL DEFAULT 0');
  // A mensagem que o familiar "escreve" na tela pós-teste, antes do
  // pagamento — pistas de personalidade sem nunca dizer qual bicho é. Gerada
  // uma vez (`gerarMensagemDoFamiliar`) e guardada aqui para não chamar o
  // Gemini de novo a cada vez que a pessoa revisita a tela.
  adicionarColunaSeFaltar('mensagem_familiar', 'TEXT');
  // Flags de áudio: o arquivo mora em disco (`bilhete.mp3`/`narracao.mp3`,
  // pasta do pedido), a coluna só diz se ele já existe — assim a tela sabe se
  // mostra o player ou "ainda gerando" sem precisar checar o filesystem.
  adicionarColunaSeFaltar('audio_bilhete', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColunaSeFaltar('audio_narracao', 'INTEGER NOT NULL DEFAULT 0');
  /**
   * O dinheiro como o Mercado Pago conta, lido da resposta dele e congelado
   * aqui (ver `traduzir` em pagamento.ts).
   *
   * Guardar em vez de calcular com um percentual no painel importa porque a
   * taxa real varia por método (Pix ≪ cartão), por parcelamento e por
   * eventual mudança de contrato — um percentual chutado daria um "lucro" que
   * não bate com o extrato, que é pior que não ter o número.
   */
  adicionarColunaSeFaltar('bruto_centavos', 'INTEGER');
  adicionarColunaSeFaltar('taxa_centavos', 'INTEGER');
  adicionarColunaSeFaltar('liquido_centavos', 'INTEGER');
  adicionarColunaSeFaltar('metodo_pagamento', 'TEXT');
  /** Custo de IA do pedido (texto + narração), somado conforme é gerado. */
  adicionarColunaSeFaltar('custo_ia_centavos', 'INTEGER NOT NULL DEFAULT 0');
  /**
   * O que a pessoa TENTOU pagar, gravado na tentativa — não na aprovação.
   *
   * `metodo_pagamento` só é preenchido pelo webhook, ou seja, só quando dá
   * certo. Isso deixava o caso interessante invisível: das tentativas que
   * falharam, não dava para saber se foi cartão recusado, Pix que ninguém
   * pagou ou boleto esquecido — que é exatamente o que se precisa saber para
   * consertar a conversão.
   *
   * `motivo_recusa` é o `status_detail` do Mercado Pago (`cc_rejected_
   * insufficient_amount`, `cc_rejected_bad_filled_security_code`, ...). Sem
   * ele, "3 recusados" não diz se o problema é do cliente ou do checkout.
   */
  adicionarColunaSeFaltar('metodo_tentado', 'TEXT');
  adicionarColunaSeFaltar('motivo_recusa', 'TEXT');
  adicionarColunaSeFaltar('tentativas_pagamento', 'INTEGER NOT NULL DEFAULT 0');
  /**
   * O funil novo: a pessoa responde TRÊS cenas, recebe o grupo, e paga. O
   * ritual de 26 acontece depois do pagamento.
   *
   * `grupo` é o que ela ganha de graça (um de quatro, com três familiares
   * dentro). `familiar` continua sendo o resultado final — mas até o ritual
   * longo terminar ele guarda só o candidato mais provável do grupo, e é por
   * isso que `ritual_completo` existe: sem essa flag não há como distinguir
   * "familiar decidido pelas 26" de "chute do grupo".
   */
  adicionarColunaSeFaltar('grupo', 'TEXT');
  adicionarColunaSeFaltar('ritual_completo', 'INTEGER NOT NULL DEFAULT 0');
  /** Quantas cenas ela já respondeu, para a barra e para o e-mail de resgate. */
  adicionarColunaSeFaltar('cenas_respondidas', 'INTEGER NOT NULL DEFAULT 0');
  /** Quando o lembrete de "termine seu ritual" saiu, para não repetir. */
  adicionarColunaSeFaltar('resgate_em', 'TEXT');
  /**
   * As falas que o familiar diz DURANTE o ritual pago, geradas uma vez e
   * congeladas. Persistir importa: a pessoa recarrega a página no meio, e a
   * mesma fala precisa estar lá — fala que muda a cada reload denuncia o
   * gerador e quebra o personagem.
   */
  adicionarColunaSeFaltar('mensagens_ritual', 'TEXT');

  /**
   * A quem a venda é creditada — a peça, e como o crédito foi decidido.
   *
   * `origem` continua existindo e continua sendo a origem de AQUISIÇÃO
   * (primeiro toque). Estas três dizem o que ela nunca soube dizer:
   *
   *  - `campanha_id` / `peca_id`: qual anúncio, e qual vídeo dentro dele.
   *  - `atribuicao`: 'primeiro-toque' (quem trouxe), 'remarketing' (o e-mail
   *    que reconquistou) ou 'compartilhamento' (link de um cliente).
   *  - `indicado_por`: o pedido de quem compartilhou o link.
   *
   * Sem isso, o painel somava três coisas diferentes numa palavra só e
   * mandava a maioria para `outro`.
   */
  adicionarColunaSeFaltar('campanha_id', 'TEXT');
  adicionarColunaSeFaltar('peca_id', 'TEXT');
  adicionarColunaSeFaltar('atribuicao', 'TEXT');
  adicionarColunaSeFaltar('indicado_por', 'TEXT');

  /**
   * Qual funil de venda fez esta venda.
   *
   * Existe porque agora há mais de um, e comparar dois formatos exige que o
   * pedido saiba de qual veio. Sem isto o teste A/B mediria nada: as vendas
   * dos dois cairiam no mesmo balde, exatamente como aconteceu no teste
   * anterior deste projeto, que mostrou resultado para duas páginas idênticas.
   */
  adicionarColunaSeFaltar('funil', 'TEXT');

  /**
   * Quando este pedido teve InitiateCheckout/Purchase mandados pra Meta via
   * Conversions API (server-to-server), em vez de só o pixel do navegador.
   *
   * Existe pro backfill (`scripts/backfill-pixel.ts`) ser idempotente: sem
   * isto, rodar o script duas vezes manda o mesmo Purchase duas vezes pro
   * Ads Manager, inflando o valor de conversão real.
   */
  adicionarColunaSeFaltar('pixel_capi_em', 'TEXT');

  /**
   * O código da campanha na URL (`?c=ig01` → `ig`).
   *
   * Fica na campanha e não numa tabela de códigos porque é ele que a pessoa
   * digita e que aparece no anúncio: a campanha É o código, do ponto de vista
   * de quem publica. Duas campanhas não podem repetir — o índice único abaixo
   * garante, e `criarCampanha` devolve erro legível em vez de estourar.
   */
  adicionarColunaSeFaltar('codigo', 'TEXT', 'campanhas');
  /**
   * Quais páginas de venda esta campanha usa, em JSON.
   *
   * Uma só: todo mundo que chegar por ela vê aquela. Mais de uma: teste A/B
   * entre elas, sorteado uma vez por pessoa e grudado no cookie. É o que
   * elimina a necessidade de uma URL por combinação — o link do anúncio é
   * sempre o mesmo, e quem decide o que ele mostra é a campanha.
   */
  adicionarColunaSeFaltar('funis', 'TEXT', 'campanhas');
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_campanhas_codigo
       ON campanhas (codigo) WHERE codigo IS NOT NULL`
  );

  // Herança do Asaas: se `pagamento_id` acabou de nascer num banco que ainda
  // tem a coluna antiga, copia os IDs para não perder o histórico. Quem criou
  // a coluna é quem faz o backfill, então isso roda uma vez só mesmo com
  // vários processos subindo juntos.
  if (pagamentoIdNasceuAgora && colunasAntigas.has('asaas_payment_id')) {
    db.exec(`UPDATE pedidos SET pagamento_id = asaas_payment_id`);
  }

  // A coluna antiga não é dropada de propósito: SQLite < 3.35 não suporta
  // DROP COLUMN, e uma coluna órfã custa menos que um deploy que quebra no
  // ALTER.
}
garantirColunas();

/**
 * A partir daqui, mudança de schema é migração numerada
 * (`src/lib/migracoes/`), não mais `adicionarColunaSeFaltar` solto aqui em
 * cima. `001_base` não faz nada — o schema acima continua vivendo aqui e
 * seguirá sendo criado por `CREATE TABLE IF NOT EXISTS`/`garantirColunas()`
 * (ver o comentário em `migracoes/001_base.ts`). Rodar isto no boot, como já
 * acontecia com `garantirColunas()`, evita um passo manual de deploy que
 * alguém esquece.
 */
executarMigracoes(db);

export type StatusPedido =
  | 'aguardando_pagamento'
  | 'pago'
  | 'gerando'
  | 'entregue'
  | 'estornado'
  | 'erro';

export interface Pedido {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  respostas_json: string;
  familiar: string;
  lua: string;
  signo_sol: string | null;
  signo_lua: string | null;
  produto: ProdutoId;
  /** JSON com eixos, ângulo, magnitude e os 12 escores (SPEC 0.8). */
  perfil_json: string | null;
  desempatado_pela_pessoa: number;
  /** ISO. `null` = acesso permanente. */
  expira_em: string | null;
  pago_em: string | null;
  lembrete_em: string | null;
  /** A segunda cobrança: a troca da Revelação pela Completa após a entrega. */
  melhoria_pagamento_id: string | null;
  melhoria_paga_em: string | null;
  melhoria_bruto_centavos: number | null;
  /**
   * Quando a chave da plataforma foi entregue **de graça** (o cron das horas
   * seguintes), e não pelo caminho do pagamento.
   *
   * Também fecha a janela das avulsas: quem já entrou pelo grátis não vê mais
   * as ofertas de 7,90 e 15,90 — dali em diante só os planos recorrentes.
   */
  acesso_gratis_em: string | null;
  /** 1 = amostra nossa para o mural, não é cliente. */
  exemplo: number;
  /** De onde veio: tiktok, instagram, ... Ver analitica.ts. */
  origem: string | null;
  /**
   * Herança do teste A/B das páginas de vendas, que foi removido — só existe
   * uma página agora. A coluna fica pelo histórico (pedidos antigos têm o
   * rótulo), mas nada escreve nela desde então: sempre `null` em pedido novo.
   */
  variante: string | null;
  /** Consultas extras ao Oráculo, ganhas por compartilhar. */
  bonus_oraculo: number;
  /** JSON com os parágrafos da mensagem pré-pagamento. `null` até ser gerada. */
  mensagem_familiar: string | null;
  /** 1 = `bilhete.mp3` existe na pasta do pedido. */
  audio_bilhete: number;
  /** 1 = `narracao.mp3` existe (só produtos com `narracaoAudio`). */
  audio_narracao: number;
  /** Valor cobrado, taxa do MP e o que sobrou — em centavos, como o MP conta. */
  /** JSON com os UTMs da chegada. Ver a migração 026. */
  utm_json: string | null;
  /** Quem cobrou: `cakto`, `mercadopago`, ou NULL nos pedidos antigos (= MP). */
  gateway: string | null;
  /** Exigido pela Cakto em qualquer cobrança. Coletado na tela de pagamento. */
  telefone: string | null;
  /** IP de quem comprou, capturado na criação do pedido. */
  ip_comprador: string | null;
  bruto_centavos: number | null;
  taxa_centavos: number | null;
  liquido_centavos: number | null;
  /** `pix`, `master`, `visa`, `fake`, ... Só preenchido quando APROVA. */
  metodo_pagamento: string | null;
  /** O que ela tentou, preenchido na tentativa — mesmo que falhe. */
  metodo_tentado: string | null;
  /** `status_detail` do MP quando recusa. Diz se o problema é do cartão ou nosso. */
  motivo_recusa: string | null;
  /** Quantas vezes tentou pagar este pedido. */
  tentativas_pagamento: number;
  /** Um dos quatro grupos do mini-ritual. Ver `quiz/grupos.ts`. */
  grupo: string | null;
  /** 1 = respondeu as 26 e o familiar é definitivo. */
  ritual_completo: number;
  cenas_respondidas: number;
  resgate_em: string | null;
  /** JSON { "1": {fala, audio?}, "2": {...} } — falas do ritual pago. */
  mensagens_ritual: string | null;
  /** O que a IA custou neste pedido (texto + narração), em centavos. */
  custo_ia_centavos: number;
  /** Id do cookie de visitante, para ligar o pedido à jornada de visitas. */
  visitante: string | null;
  /** Código do cupom aplicado, já normalizado. */
  cupom: string | null;
  campanha_id: string | null;
  peca_id: string | null;
  atribuicao: string | null;
  indicado_por: string | null;
  funil: string | null;
  /** Quando o InitiateCheckout/Purchase deste pedido foi mandado via CAPI. */
  pixel_capi_em: string | null;
  /** Percentual congelado no momento da compra. Ver cupons.ts. */
  desconto_percentual: number | null;
  cupom_contabilizado: number;
  status: StatusPedido;
  pagamento_id: string | null;
  pix_copia_e_cola: string | null;
  leitura_json: string | null;
  tentativas: number;
  criado_em: string;
  atualizado_em: string;
}

export function criarPedido(p: {
  id: string;
  nome: string;
  email: string;
  respostas_json: string;
  familiar: string;
  lua: string;
  signo_sol: string;
  signo_lua: string;
  produto: ProdutoId;
  /** JSON com eixos, ângulo, magnitude e os 12 escores (SPEC 0.8). */
  perfil_json?: string | null;
  desempatado_pela_pessoa?: number;
  cupom?: string | null;
  desconto_percentual?: number | null;
  origem?: string | null;
  visitante?: string | null;
  variante?: string | null;
  /** Ver `lib/rastreio.ts` — quem trouxe, qual peça, e como foi decidido. */
  campanha_id?: string | null;
  peca_id?: string | null;
  atribuicao?: string | null;
  indicado_por?: string | null;
  funil?: string | null;
  /**
   * Os UTMs da sessão, gravados no NASCIMENTO do pedido.
   *
   * Antes só chegavam na tentativa de pagamento, e só pelos checkouts de
   * Cakto e Wiven. Com o Brick do Mercado Pago cobrando, nenhum pedido tinha
   * campanha — e a tela de checkout precisa dela ANTES de qualquer cobrança,
   * para saber qual gateway mostrar.
   */
  utm_json?: string | null;
}) {
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO pedidos
      (id, nome, email, respostas_json, familiar, lua, signo_sol, signo_lua, produto,
       perfil_json, desempatado_pela_pessoa, cupom, desconto_percentual,
       origem, visitante, variante, campanha_id, peca_id, atribuicao,
       indicado_por, funil, utm_json, status, criado_em, atualizado_em)
     VALUES (@id, @nome, @email, @respostas_json, @familiar, @lua, @signo_sol, @signo_lua, @produto,
       @perfil_json, @desempatado_pela_pessoa, @cupom, @desconto_percentual,
       @origem, @visitante, @variante, @campanha_id, @peca_id, @atribuicao,
       @indicado_por, @funil, @utm_json, 'aguardando_pagamento', @agora, @agora)`
  ).run({
    perfil_json: null,
    desempatado_pela_pessoa: 0,
    cupom: null,
    desconto_percentual: null,
    origem: null,
    visitante: null,
    variante: null,
    campanha_id: null,
    peca_id: null,
    atribuicao: null,
    indicado_por: null,
    funil: null,
    utm_json: null,
    ...p,
    agora,
  });
}

export function buscarPedido(id: string): Pedido | undefined {
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as
    | Pedido
    | undefined;
}

export function buscarPedidoPorPagamentoId(pagamentoId: string): Pedido | undefined {
  return db
    .prepare('SELECT * FROM pedidos WHERE pagamento_id = ?')
    .get(pagamentoId) as Pedido | undefined;
}

export function atualizarPedido(id: string, campos: Partial<Pedido>) {
  const chaves = Object.keys(campos);
  if (chaves.length === 0) return;
  const set = chaves.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(
    `UPDATE pedidos SET ${set}, atualizado_em = @atualizado_em WHERE id = @id`
  ).run({ ...campos, id, atualizado_em: new Date().toISOString() });
}

export function pedidosTravados(): Pedido[] {
  return db
    .prepare(
      `SELECT * FROM pedidos WHERE status IN ('pago', 'gerando', 'erro') AND tentativas < 3`
    )
    .all() as Pedido[];
}

/**
 * Quem parou na tela de pagamento e ainda não recebeu lembrete.
 *
 * As duas janelas importam. A **mínima** evita mandar e-mail para quem só foi
 * pegar o cartão na outra sala — parece desespero e atrapalha a venda que ia
 * acontecer sozinha. A **máxima** evita ressuscitar carrinho de semanas atrás,
 * que a pessoa já esqueceu e lê como spam.
 */
/**
 * ── Por que a espera é de 24 horas ────────────────────────────────────────
 *
 * Eram 6. A ideia era pegar a pessoa ainda quente, mas ela atropelava o Pix:
 * o código gerado vale até o dia seguinte, e mandar "seu familiar ficou
 * esperando" para quem tem um Pix aberto no celular é apressar quem já
 * decidiu — e queimar o cupom de resgate com quem ia pagar de qualquer jeito.
 *
 * 24h é o ponto em que o Pix venceu de vez e a intenção esfriou: aí o
 * lembrete vira lembrete, e o desconto vira motivo.
 */
export function pedidosAbandonados(
  horasMinimas = 24,
  horasMaximas = 72
): Pedido[] {
  const agora = Date.now();
  const linhas = db
    .prepare(
      `SELECT * FROM pedidos
       WHERE status = 'aguardando_pagamento'
         AND lembrete_em IS NULL
         AND email IS NOT NULL AND email != ''
         AND criado_em <= ?
         AND criado_em >= ?
       ORDER BY criado_em DESC`
    )
    .all(
      new Date(agora - horasMinimas * 3_600_000).toISOString(),
      new Date(agora - horasMaximas * 3_600_000).toISOString()
    ) as Pedido[];

  /**
   * **Um por pessoa, não um por pedido.**
   *
   * A consulta devolvia uma linha por carrinho, e quem refez o ritual três
   * vezes recebia três e-mails iguais. Uma pessoa fez exatamente isso em
   * 22/08 — três pedidos em 80 minutos — e outra aparece duas vezes só porque
   * digitou o e-mail com maiúsculas diferentes nas duas.
   *
   * O próprio script já dizia a regra em comentário ("um e-mail por pessoa, e
   * só... quem não quis vai marcar como spam, e aí o domínio inteiro paga o
   * preço, inclusive os e-mails de entrega"). O que faltava era o código
   * cumprir o que o comentário prometia.
   *
   * Fica o pedido MAIS RECENTE de cada endereço: é o que a pessoa estava
   * tentando comprar por último, e o link do lembrete leva para ele.
   */
  const porPessoa = new Map<string, Pedido>();
  for (const p of linhas) {
    const chave = p.email.trim().toLowerCase();
    if (!porPessoa.has(chave)) porPessoa.set(chave, p);
  }
  return [...porPessoa.values()];
}

/**
 * Marca como lembrada TODA a fila daquele endereço, não só o pedido enviado.
 *
 * Sem isto, deduplicar não resolve nada: a rodada seguinte encontraria o
 * segundo carrinho da mesma pessoa, mandaria o segundo e-mail, e o terceiro
 * na hora seguinte. A dedupe só vale se os irmãos saírem da fila junto.
 */
export function marcarLembretePorEmail(email: string): number {
  return db
    .prepare(
      `UPDATE pedidos SET lembrete_em = ?
       WHERE lower(trim(email)) = ? AND status = 'aguardando_pagamento'
         AND lembrete_em IS NULL`
    )
    .run(new Date().toISOString(), email.trim().toLowerCase()).changes;
}

export function marcarLembreteEnviado(id: string): void {
  db.prepare('UPDATE pedidos SET lembrete_em = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  );
}

/**
 * Quem PAGOU e não terminou o ritual.
 *
 * ── É outra coisa que carrinho abandonado ─────────────────────────────────
 *
 * Aqui não há nada para vender: o dinheiro entrou, e o que falta é a pessoa
 * responder as cenas para o familiar poder ser calculado. Ela está com um
 * produto pago e não entregue, e é o site que tem a obrigação de puxá-la de
 * volta — não é marketing, é entrega.
 *
 * Por isso as regras são mais frouxas que as do carrinho: janela mínima curta
 * (duas horas — tempo de ter fechado a aba, não de estar decidindo), e nenhum
 * teto de idade. Alguém que pagou há três semanas continua tendo direito ao
 * que comprou, e o e-mail é bem-vindo, não intrusão.
 *
 * `email <> ''` porque o funil de anúncio deixa comprar sem endereço; sem ele
 * não há para onde mandar, e essa pessoa aparece no painel em vez daqui.
 */
export function pedidosParaResgate(horasMinimas = 2): Pedido[] {
  return db
    .prepare(
      `SELECT * FROM pedidos
       WHERE status IN ('pago', 'erro')
         AND ritual_completo = 0
         AND resgate_em IS NULL
         AND email <> ''
         AND exemplo = 0
         AND pago_em <= ?`
    )
    .all(new Date(Date.now() - horasMinimas * 3_600_000).toISOString()) as Pedido[];
}

export function marcarResgateEnviado(id: string): void {
  db.prepare('UPDATE pedidos SET resgate_em = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  );
}

/**
 * O código curto de um pedido — os 8 primeiros caracteres do id.
 *
 * É o que vai no link de compartilhamento (`?s=7f3ka1b2`). Não é uma coluna
 * nova de propósito: derivar do id que já existe evita uma migração e evita
 * um segundo identificador para manter em sincronia. Oito caracteres de hexa
 * são 4 bilhões de combinações — a colisão que importaria aqui é entre dois
 * pedidos do MESMO dono, e ela não acontece nesta escala.
 *
 * Não serve como segredo: quem tem o código sabe que existe um pedido, e nada
 * além disso. O link só credita a indicação; não abre a revelação de ninguém.
 */
export function codigoCurtoDoPedido(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toLowerCase();
}

export function buscarPedidoPorCodigoCurto(codigo: string): Pedido | undefined {
  const limpo = codigo.toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 8);
  if (limpo.length < 6) return undefined;
  return db
    .prepare(
      `SELECT * FROM pedidos
        WHERE lower(replace(id, '-', '')) LIKE ? || '%'
        LIMIT 1`
    )
    .get(limpo) as Pedido | undefined;
}

export function registrarEvento(tipo: string, pedidoId?: string) {
  db.prepare(
    `INSERT INTO eventos (tipo, pedido_id, criado_em) VALUES (?, ?, ?)`
  ).run(tipo, pedidoId ?? null, new Date().toISOString());
}

/* ── comentários ───────────────────────────────────────────────────────── */

export interface Comentario {
  id: string;
  pedido_id: string;
  texto: string;
  aprovado: number;
  criado_em: string;
}

/**
 * Guarda o comentário do comprador. `pedido_id` é único: um por revelação —
 * o campo é "o que você achou", não um fórum.
 */
export function salvarComentario(id: string, pedidoId: string, texto: string): void {
  db.prepare(
    `INSERT INTO comentarios (id, pedido_id, texto, aprovado, criado_em)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(pedido_id) DO UPDATE SET texto = excluded.texto,
       aprovado = 0, criado_em = excluded.criado_em`
  ).run(id, pedidoId, texto, new Date().toISOString());
}

export function comentarioDoPedido(pedidoId: string): Comentario | undefined {
  return db
    .prepare('SELECT * FROM comentarios WHERE pedido_id = ?')
    .get(pedidoId) as Comentario | undefined;
}

export function comentariosPendentes(): (Comentario & { nome: string })[] {
  return db
    .prepare(
      `SELECT c.*, p.nome FROM comentarios c
       JOIN pedidos p ON p.id = c.pedido_id
       WHERE c.aprovado = 0 ORDER BY c.criado_em ASC`
    )
    .all() as (Comentario & { nome: string })[];
}

/* ── o mural ───────────────────────────────────────────────────────────── */

export interface ItemDoMural {
  id: string;
  nome: string;
  familiar: string;
  lua: string;
  produto: ProdutoId;
  leitura_json: string | null;
  expira_em: string | null;
  exemplo: number;
  comentario: string | null;
}

/**
 * O que aparece no mural: revelações entregues cujo link ainda abre para
 * estranhos, com o comentário aprovado quando houver.
 *
 * O `expira_em` na condição é o que impede o mural de virar um cemitério de
 * links mortos — cartão bonito que leva a "este link não abre mais" é pior
 * que cartão nenhum.
 */
export function itensDoMural(limite = 60): ItemDoMural[] {
  return db
    .prepare(
      `SELECT p.id, p.nome, p.familiar, p.lua, p.produto, p.leitura_json,
              p.expira_em, p.exemplo,
              CASE WHEN c.aprovado = 1 THEN c.texto ELSE NULL END AS comentario
       FROM pedidos p
       LEFT JOIN comentarios c ON c.pedido_id = p.id
       WHERE p.status = 'entregue'
         AND p.leitura_json IS NOT NULL
         AND (p.expira_em IS NULL OR p.expira_em > ?)
       ORDER BY p.criado_em DESC
       LIMIT ?`
    )
    .all(new Date().toISOString(), limite) as ItemDoMural[];
}

/* ── contatos ──────────────────────────────────────────────────────────── */

export type AssuntoDeContato =
  | 'duvida'
  | 'problema'
  | 'reembolso'
  | 'dados'
  | 'outro';

export interface Contato {
  id: string;
  nome: string;
  email: string;
  assunto: AssuntoDeContato;
  mensagem: string;
  pedido_id: string | null;
  resolvido_em: string | null;
  criado_em: string;
}

export function salvarContato(c: {
  id: string;
  nome: string;
  email: string;
  assunto: AssuntoDeContato;
  mensagem: string;
  pedidoId?: string | null;
}): void {
  db.prepare(
    `INSERT INTO contatos (id, nome, email, assunto, mensagem, pedido_id, resolvido_em, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    c.id,
    c.nome,
    c.email,
    c.assunto,
    c.mensagem,
    c.pedidoId ?? null,
    new Date().toISOString()
  );
}

export function contatosAbertos(): Contato[] {
  return db
    .prepare(
      'SELECT * FROM contatos WHERE resolvido_em IS NULL ORDER BY criado_em ASC'
    )
    .all() as Contato[];
}

export function contatosRecentes(limite = 20): Contato[] {
  return db
    .prepare('SELECT * FROM contatos ORDER BY criado_em DESC LIMIT ?')
    .all(limite) as Contato[];
}

export function salvarOraculoEspera(id: string, email: string, pergunta: string) {
  db.prepare(
    `INSERT INTO oraculo_espera (id, email, pergunta, criado_em) VALUES (?, ?, ?, ?)`
  ).run(id, email, pergunta, new Date().toISOString());
}

export default db;

/* ── rascunhos ─────────────────────────────────────────────────────────── */

export interface Rascunho {
  visitante: string;
  email: string;
  cena: number;
  origem: string | null;
  variante: string | null;
  virou_pedido: number;
  lembrete_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Guarda (ou atualiza) o e-mail deixado no meio do ritual.
 *
 * `ON CONFLICT` em vez de checar antes: a pessoa pode voltar e recomeçar, e
 * duas abas abertas produziriam duas inserções concorrentes. O e-mail mais
 * recente vence, e `criado_em` fica com a primeira vez.
 */
export function salvarRascunho(r: {
  visitante: string;
  email: string;
  cena: number;
  origem: string | null;
}): void {
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO rascunhos (visitante, email, cena, origem, criado_em, atualizado_em)
     VALUES (@visitante, @email, @cena, @origem, @agora, @agora)
     ON CONFLICT(visitante) DO UPDATE SET
       email = excluded.email,
       cena = max(cena, excluded.cena),
       atualizado_em = excluded.atualizado_em`
  ).run({ ...r, agora });
}

/** Marca que o rascunho virou pedido, para o lembrete não sair. */
export function rascunhoVirouPedido(visitante: string): void {
  db.prepare('UPDATE rascunhos SET virou_pedido = 1 WHERE visitante = ?').run(
    visitante
  );
}

/**
 * Quem deixou e-mail, não terminou, e ainda não recebeu lembrete.
 *
 * O intervalo mínimo existe para não escrever para alguém que largou a aba há
 * dois minutos e ainda pode voltar sozinha.
 */
export function rascunhosAbandonados(horasMin = 2, horasMax = 72): Rascunho[] {
  const agora = Date.now();
  return db
    .prepare(
      `SELECT * FROM rascunhos
        WHERE virou_pedido = 0 AND lembrete_em IS NULL
          AND atualizado_em <= ? AND atualizado_em >= ?
        ORDER BY atualizado_em DESC`
    )
    .all(
      new Date(agora - horasMin * 3600_000).toISOString(),
      new Date(agora - horasMax * 3600_000).toISOString()
    ) as Rascunho[];
}

export function marcarLembreteDeRascunho(visitante: string): void {
  db.prepare('UPDATE rascunhos SET lembrete_em = ? WHERE visitante = ?').run(
    new Date().toISOString(),
    visitante
  );
}
