# Bruxário

Ritual digital: um quiz de 12 passos revela qual dos 12 "familiares" (animais
arquetípicos) escolheu a pessoa, cruzando as respostas com o signo solar e
lunar calculados a partir da data/hora de nascimento. A revelação vem com uma
leitura personalizada (Gemini), artes prontas pra Story/Feed do Instagram e um
PDF de 4 páginas — tudo num link permanente, gerado logo após o pagamento.

> **Este projeto foi majoritariamente "vibecodado"** com o [Claude Code](https://claude.com/claude-code)
> (Anthropic), a partir de um `SPEC.md` escrito pelo dono do produto como fonte
> de verdade. Este README documenta o que foi decidido/feito nas sessões de
> desenvolvimento e deploy — leia também o `SPEC.md`, que é mais detalhado
> sobre a visão de produto, tom de voz e regras de negócio.

## ⚠️ Leia primeiro: o código está uma versão atrás do SPEC

O `SPEC.md` foi reescrito (v1, jul/2026). **O que este README descreve abaixo é
a v0 antiga, que é o que roda hoje na VPS.**

**O coração do SPEC é a evolução do teste.** O quiz sai de 8 perguntas para o
máximo de itens que a conclusão do funil aguentar, e passa a se apoiar em
instrumentos de personalidade reais e embasados (circumplexo interpessoal de
Leary/Wiggins, itens do IPIP que é de domínio público) — o objetivo é montar um
perfil que realmente diga algo sobre a pessoa, não um resultado bonito. Todo o
resto do SPEC (oráculo, dossiê, assinatura, crescimento) é destino documentado;
o que muda o produto agora é o teste.

A tabela é a distância entre os dois, com o quiz no topo porque é o que
importa. Sete das linhas estão marcadas como **travado** no Apêndice A do SPEC,
ou seja, não são sugestão:

| SPEC v1 | Código hoje |
|---|---|
| Quiz de 26 itens, circumplexo de 2 eixos (2.2) | 8 perguntas, `+2 pontos por bicho` (`src/lib/familiares.ts`) |
| Signo com peso **ZERO** na escolha (2.4) | elemento do signo solar **é o critério de desempate** |
| Gemini 3.5 na voz, 3.1 só na vigilância (8.1) | 3.1-flash-lite na voz; vigilância inexistente |
| 12 escores de afinidade salvos (0.8) | não são calculados; sem coluna no schema |
| Micro-avisos em 9 pontos do fluxo (7.4) | um link no rodapé (`src/components/RodapeLegal.tsx`) |
| Conta, verificação de e-mail, endereço permanente (0.5) | pedido anônimo identificado por uuid |
| Oráculo com 3 perguntas grátis (0.4) | `/api/oraculo` só grava e-mail + pergunta numa lista de espera |
| Carta compartilhável **para quem não pagou** (0.3) | toda geração de arte roda depois do pagamento |
| Tiragem diária, perfil público, roda dos 12 (0.3) | não existem |
| Leitura mora em endereço permanente, não em arquivo (0.5) | PDF de 4 páginas ainda é o centro da entrega (`src/lib/pdf.ts`) |

**Entrega por e-mail: removida.** O link permanente já é gerado, então mandar
e-mail era um segundo caminho pra mesma coisa — com chave de API, domínio
verificado e mais um jeito de falhar. `src/lib/email.ts` e a dependência
`resend` saíram; `/obrigado/[id]` redireciona pro link sozinho quando a geração
termina. Próximo passo natural nessa direção: **QR code do perfil**, que torna
o link compartilhável no mundo físico (print, adesivo, story) sem depender de
caixa de entrada nenhuma.

O diagnóstico da seção 2.1 do SPEC — *"não parece que as perguntas definem o
familiar, e sim o signo"* — está literalmente no código: com 8 itens para 12
saídas os empates são a regra, e `calcularFamiliar()` resolve empate pelo
elemento do signo solar. O sintoma relatado é o comportamento projetado.

**Risco aberto:** existe campo de texto livre (`src/components/FormularioOraculo.tsx`)
gravando pergunta do usuário sem lista de gatilhos, sem classificador e sem
protocolo de crise — o que o SPEC 0.4 chama de "inegociável enquanto o campo
existir". Atenuante: o DNS do domínio nunca foi apontado (ver Pendências), então
a página provavelmente não é alcançável.

**Sem vendas concluídas:** o banco tem pedidos, todos em
`aguardando_pagamento`. Nenhum cliente para migrar — o remodelamento tem mão
livre.

### Histórico do gateway (pra ninguém achar que o Asaas foi acidente)

Três etapas, e só a última é decisão de arquitetura:

1. **Stripe** — era o que o SPEC v0 dizia, sem nenhuma investigação por trás.
2. **Asaas** — foi o que entrou de fato, porque era a conta que já existia.
   Escolha pragmática pra conseguir vender, não preferência técnica. É por isso
   que ele não aparece em nenhuma versão do SPEC.
3. **Mercado Pago** — **decisão definitiva** (SPEC 10.1, travado). Pix nativo,
   bandeiras e parcelamento nacionais, checkout que o público brasileiro
   reconhece, suporte em português.

**Estado: migrado.** O Asaas saiu do código inteiro. Falta só preencher as
credenciais no `.env` e cadastrar o webhook no painel — ver "Pendências pra
ativar de verdade".

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4
- **SQLite** (`better-sqlite3`) — um único arquivo, sem servidor de banco separado
- **sharp** — composição das artes (lua + animal + textos em SVG)
- **pdf-lib** (+ `@pdf-lib/fontkit`) — PDF de 4 páginas
- **astronomy-engine** — signo solar/lunar calculado 100% offline
- **Gemini** (`@google/genai`, modelo `gemini-3.1-flash-lite`) — texto da leitura
- **Mercado Pago** (`mercadopago` SDK v3) — **Payment Brick** renderizado no
  próprio site: cartão de crédito e débito, Pix e boleto num só módulo. Sem
  `MP_ACCESS_TOKEN` configurado, cai automaticamente num "pagamento fake" pra
  dev local (ver `src/lib/pagamento.ts`)
- **rembg** (Python, `isnet-general-use`) — usado *uma única vez*, offline, pra
  remover o fundo dos 12 PNGs dos animais. Não roda em produção; as saídas já
  ficam versionadas em `src/assets/familiares/`. O `.venv/` de 955 MB que sobrou
  desse processamento foi apagado — se precisar reprocessar um animal novo:
  `python3 -m venv .venv && .venv/bin/pip install rembg onnxruntime`

## Organização das pastas

A raiz tinha oito pastas soltas misturando código, assets, estado de runtime e
matéria-prima de divulgação. Agora são **três raízes com regras diferentes**, e
a regra é o que importa:

```
src/           CÓDIGO — tudo que é versionado e executado
  app/         rotas (App Router) + API routes
  components/  componentes de UI React
  lib/         lógica: banco, pagamento, IA, arte, PDF, astro, caminhos
  assets/      fontes (.ttf/.woff2) e PNGs dos 12 familiares + 4 luas
               → fonte de verdade única: src/app/layout.tsx importa os
                 .woff2 daqui, src/lib/pdf.ts embute os .ttf daqui, e é
                 daqui que se copia pro SO (ver seção de fontes abaixo)

var/           ESTADO DE RUNTIME — escrito pelo app, jamais versionado,
               jamais sobrescrito por deploy
  data/        banco SQLite
  storage/     artes e PDFs gerados, uma pasta por pedido

conteudo/      MATÉRIA-PRIMA de divulgação (265 MB), fora do runtime do app

public/        obrigatoriamente na raiz pelo Next: exemplos/ + favicon
scripts/       utilitários avulsos (tsx), fora do runtime
```

**Nenhum `path.join(process.cwd(), ...)` espalhado.** Todo caminho de
filesystem mora em [`src/lib/caminhos.ts`](src/lib/caminhos.ts). Antes ele
estava repetido em seis arquivos, e foi exatamente o que tornou esta
reorganização mais trabalhosa do que precisava — se as pastas mudarem de novo,
mexe-se em um arquivo.

Não há testes no projeto. Vale notar que o SPEC 0.7 abre justamente pedindo o
motor de pontuação como "lógica pura, testável no terminal" — é o primeiro
lugar onde teste passa a fazer diferença.

## Pasta `conteudo/` (produção de conteúdo)

Não versionada (`.gitignore`) e separada do código — é só matéria-prima pra
criar posts/artes de divulgação, não é usada pelo app em runtime:

- `conteudo/brutas/familiares/` e `conteudo/brutas/luas/` — cópias das imagens
  originais (mesmo conteúdo de `src/assets/familiares` e `src/assets/luas`, mas
  com o fundo ainda presente nos animais).
- `conteudo/fundidas/<lua>/<familiar>.png` — as 12×4 = 48 combinações de
  animal + fundo de lua já mescladas (1080×1920), com só o nome do animal
  escrito. Gerado por `npm run gerar-fusoes` (script em
  `scripts/gerar-fusoes.ts`, usa `sharp` com os mesmos assets de
  `src/lib/arte.ts`).

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencher as chaves (ver abaixo)
npm run dev
```

As fontes (`Cormorant Garamond`, `Sora`, `Pinyon Script`) precisam estar
instaladas no sistema operacional — `sharp` e `pdf-lib` renderizam texto via
`fontconfig`, não via CSS. Em qualquer ambiente novo (dev machine ou VPS):

```bash
mkdir -p ~/.fonts   # ou /usr/local/share/fonts/bruxario no servidor
cp src/assets/fonts/*.ttf ~/.fonts/
fc-cache -f ~/.fonts
```

Sem isso as artes/PDF caem pra uma fonte serifa genérica do sistema — não
quebra, mas perde a identidade visual.

### Variáveis de ambiente (`.env`)

```
MP_ACCESS_TOKEN=              # token privado, painel Suas Integrações
NEXT_PUBLIC_MP_PUBLIC_KEY=    # chave pública do Brick (vai pro navegador)
MP_WEBHOOK_SECRET=            # "assinatura secreta" da aplicação
GEMINI_API_KEY=
BASE_URL=http://localhost:3000
```

Os preços **não** são variável de ambiente: moram em
[`src/lib/produtos.ts`](src/lib/produtos.ts) junto com o que cada produto
entrega, porque a tela de preço é gerada dali. Assim não existe o caso de a
tela prometer algo que o backend não libera.

- **`MP_ACCESS_TOKEN` vazio** → o app usa um provedor de pagamento "fake": a
  compra confirma na hora, sem ir pro Mercado Pago. Ótimo pra testar o fluxo
  completo (quiz → leitura → artes → link) sem gateway nenhum.
- **Credenciais de teste e produção são pares distintos** no painel do MP, e o
  Brick precisa da chave pública do **mesmo** par do access token. Misturar os
  pares dá erro de token inválido que não diz que o problema é esse.
- **`MP_WEBHOOK_SECRET` é gerado pelo Mercado Pago**, diferente do Asaas onde
  você inventava o token. Fica em Suas Integrações → sua aplicação → Webhooks →
  "assinatura secreta". A validação usa `WebhookSignatureValidator` do SDK
  oficial (HMAC-SHA256 sobre `data.id` + `x-request-id` + timestamp), com
  tolerância de 5 min contra replay.
- **O preço nunca vem do navegador.** O Brick manda um `transaction_amount` no
  formData, mas `src/lib/pagamento.ts` relê o valor do produto no servidor —
  senão o preço seria editável pelo DevTools.
- **`issuer_id` vem como string do Brick e a API espera número.** Convertido em
  `montarCorpo()`; sem isso o MP recusa com um erro que não explica a causa.

## Arquitetura do fluxo de compra

```
/ritual (12 passos: 8 perguntas + nome + data + hora + e-mail)
  → POST /api/quiz            cria o pedido (status: aguardando_pagamento,
                              com o produto escolhido)
/pagamento/[id]                server component: lê o preço do produto e
                               monta o Payment Brick NA PRÓPRIA PÁGINA
                               (sem redirect — SPEC 10.3)
  → POST /api/pedido/[id]/pagamento   recebe o formData do Brick
       fake     → marca "pago" na hora, dispara geração, vai pra /obrigado/[id]
       cartão   → POST /v1/payments; approved manda pra /obrigado/[id]
       Pix      → POST /v1/payments; devolve QR + copia-e-cola na tela
       recusado → mensagem traduzida pra voz do produto, tenta de novo
Mercado Pago confirma pagamento
  → POST /api/webhook   assinatura HMAC validada; o status é RELIDO da API
                        (o corpo da notificação traz só data.id)
       marca "pago" → dispara src/lib/processar.ts em background
/obrigado/[id]                 tela de carregamento (poll em /api/pedido/[id])
  → quando status = "entregue", redireciona pra:
/revelacao/[id]                 arte + leitura + constelação + compartilhar
```

`src/lib/processar.ts` é o pipeline completo pós-pagamento: calcula signos
(`src/lib/astro.ts`) → gera a leitura (`src/lib/leitura.ts`, Gemini) → compõe
as artes (`src/lib/arte.ts`, sharp) → monta o PDF (`src/lib/pdf.ts`) → marca
`entregue`. **Não envia e-mail** — a entrega é o próprio link permanente, e
`/obrigado/[id]` redireciona pra lá sozinho quando o status vira `entregue`.
Roda em background (fire-and-forget) — se o processo cair no
meio, `pedidosTravados()` em `src/lib/db.ts` + `scripts/reprocessar.ts`
(`npm run reprocessar`) reencaminham pedidos presos em `pago`/`gerando`/`erro`.

### Por que Payment Brick e não checkout redirecionado

O Asaas usava Checkout hospedado: criava a cobrança e mandava a pessoa pra
página deles. Funcionava, e a troca **não** foi por problema técnico — foi o
SPEC 10.3, que trata a ambientação como parte do produto: "mandar alguém do
meio de um ritual de vela e lua para uma tela laranja e voltar" quebra o que o
resto do site constrói.

Consequências de projeto que vêm com essa escolha:

1. **Não existe mais URL de checkout.** O Brick coleta no navegador, gera um
   `token` e chama nosso backend, que cria o pagamento em `POST /v1/payments`.
   Dado de cartão nunca toca nosso servidor — é o que mantém a conformidade PCI.
2. **A tela de pagamento virou server component**, porque o preço precisa ser
   lido do produto no servidor. A versão anterior tinha `const PRECO = 980/100`
   hardcoded no cliente.
3. **A resposta síncrona não libera acesso.** Cartão volta `approved` na hora,
   Pix volta `pending` com QR. Em nenhum dos dois casos é ela que decide: quem
   libera é o webhook (SPEC 10.6).
4. **Recusa de cartão precisa de texto próprio.** É o momento mais frágil da
   compra — mensagem genérica faz desistir, `cc_rejected_bad_filled_date`
   assusta. A tradução está em `CheckoutMercadoPago.tsx`.

## Deploy (estado atual em produção)

Feito na sessão de deploy: servidor **compartilhado** (já tinha outras coisas
rodando — AetherOS, blogs estáticos, etc.), então o Bruxário foi encaixado nos
padrões que já existiam ali, sem introduzir ferramentas novas:

- **VPS:** `72.61.133.109` (Hostinger, Ubuntu 24.04)
- **Processo:** PM2 (`pm2 start npm --name bruxario -- start`), `pm2 save` +
  `pm2 startup systemd` já configurados — sobrevive a reboot
- **Proxy/HTTPS:** **nginx** (não Caddy — o servidor já usava nginx +
  certbot pra outros domínios, então seguimos o padrão em vez de trocar) +
  Let's Encrypt via `certbot --nginx`
- **Código:** `/root/apps/bruxario` (mesmo padrão de `/root/apps/copa_login`
  que já existia no servidor)
- **Fontes:** copiadas pra `/usr/local/share/fonts/bruxario/` + `fc-cache -f`
- **Backup:** `scripts/backup.sh` via cron diário (4h), `.tar.gz` de `var/` em
  `/root/backups/bruxario/`, retenção de 14 dias.
  ⚠️ o script no servidor ainda aponta pros caminhos antigos `data/` e
  `storage/` — atualizar pra `var/` no próximo deploy
- **Firewall (`ufw`):** já vinha configurado no servidor (22/80/443 públicos);
  nada novo foi aberto — o Next.js roda só em `127.0.0.1:3000`, nunca exposto
  direto

### ⚠️ Pendências pra ativar de verdade

1. **DNS do `bruxario.com.br` ainda não aponta pro servidor.** No momento do
   deploy, o domínio estava nos nameservers de "parking" da Hostinger
   (`dns-parking.com`), sem registro A nenhum. Enquanto isso não for
   corrigido, o site só responde direto pelo IP (`http://72.61.133.109` com
   `Host: bruxario.com.br`), sem HTTPS.
   **Ação necessária:** painel Hostinger → domínio → desativar "parking" →
   nameservers da própria Hostinger (ou apontar A record direto) → registro
   **A** `@` e `www` → `72.61.133.109`.
   Depois disso, rodar (uma vez, no servidor):
   ```bash
   certbot --nginx -d bruxario.com.br -d www.bruxario.com.br --redirect
   ```

2. **Credenciais do Mercado Pago ainda não existem.** Enquanto
   `MP_ACCESS_TOKEN` estiver vazio o app roda no provedor fake e aprova tudo
   sem cobrar — ou seja, **não deixe subir pra produção assim**.
   **Ação necessária:** painel do MP → Suas Integrações → criar aplicação →
   copiar o access token e a chave pública (par de **produção**) pro `.env` do
   servidor.

3. **Webhook não está cadastrado no painel do Mercado Pago.** Sem isso,
   pagamento confirmado não avisa o site (o pedido fica preso em "aguardando
   pagamento" mesmo depois de pago — a revelação só é gerada se alguém rodar
   `npm run reprocessar` manualmente).
   **Ação necessária:** Suas Integrações → sua aplicação → Webhooks →
   cadastrar `https://bruxario.com.br/api/webhook`, marcar o tópico
   **Pagamentos**, e copiar a "assinatura secreta" pro `MP_WEBHOOK_SECRET`.

4. **Nada foi testado contra a API real** — não há credencial. O código foi
   escrito contra a documentação oficial e usa o SDK `mercadopago` v3 (inclusive
   `WebhookSignatureValidator`, em vez de reimplementar o HMAC na mão). Antes da
   primeira venda vale rodar os caminhos feios no sandbox: recusa, Pix expirado,
   webhook repetido, estorno.

### Redeploy manual (até existir CI/CD)

```bash
# da sua máquina, na raiz do projeto:
rsync -az --exclude node_modules --exclude .next --exclude data \
  --exclude storage --exclude .env --exclude '*.png' \
  ./ root@72.61.133.109:/root/apps/bruxario/

ssh root@72.61.133.109 "cd /root/apps/bruxario && npm install && npm run build && pm2 restart bruxario"
```

`var/` (banco SQLite + artes/PDFs gerados) **nunca** deve ser sobrescrito por
um deploy — fica só no servidor, fora do rsync.

## Scripts

- `npm run dev` — desenvolvimento local
- `npm run build` / `npm run start` — build e servidor de produção
- `npm run reprocessar` — reencaminha pedidos travados (`pago`/`gerando`/`erro`
  com menos de 3 tentativas) pelo pipeline de geração

## Limitações conhecidas / próximos passos

O roteiro real está no `SPEC.md` seção 0.7 ("Ordem de construção"), que começa
por quatro tarefas offline: motor de pontuação do circumplexo com testes, os 26
itens com vetores de carga, o caso-exemplo nas 12 vozes, e a lista
determinística de gatilhos da vigilância. Fora isso:

- Sem painel admin — consultas via `sqlite3 data/bruxario.db` direto no SSH
  (decisão do `SPEC.md`: menos superfície de ataque na v1)
- Sem cancelamento automático de cobranças `aguardando_pagamento` antigas
  (o `SPEC.md` sugere um job diário; ainda não implementado)
- `src/app/termos/page.tsx` junta termos e privacidade numa página curta. O SPEC 7.5
  pede três páginas separadas, e falta o essencial: controlador/CNPJ, canal do
  encarregado (DPO), base legal por finalidade, transferência internacional,
  decisão automatizada (art. 20) e direito de arrependimento de 7 dias
- A decisão **18+ ou construir para menor** (SPEC 7.3) está pendente e trava a
  redação das páginas legais e o corpus inteiro
