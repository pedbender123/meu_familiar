# Bruxário

Ritual digital: um quiz de 12 passos revela qual dos 12 "familiares" (animais
arquetípicos) escolheu a pessoa, cruzando as respostas com o signo solar e
lunar calculados a partir da data/hora de nascimento. A revelação vem com uma
leitura personalizada (Gemini), artes prontas pra Story/Feed do Instagram e um
PDF de 4 páginas — tudo entregue por e-mail após o pagamento.

> **Este projeto foi majoritariamente "vibecodado"** com o [Claude Code](https://claude.com/claude-code)
> (Anthropic), a partir de um `SPEC.md` escrito pelo dono do produto como fonte
> de verdade. Este README documenta o que foi decidido/feito nas sessões de
> desenvolvimento e deploy — leia também o `SPEC.md`, que é mais detalhado
> sobre a visão de produto, tom de voz e regras de negócio.

## ⚠️ Leia primeiro: o código está uma versão atrás do SPEC

O `SPEC.md` foi reescrito (v1, jul/2026) e passou de produto único para
plataforma. **O que este README descreve abaixo é a v0 antiga, que é o que
roda hoje na VPS.** A tabela é a distância entre os dois — e sete das linhas
estão marcadas como **travado** no Apêndice A do SPEC, ou seja, não são
sugestão:

| SPEC v1 | Código hoje |
|---|---|
| Mercado Pago (Payment Brick), seção 10.1 | **Asaas** Checkout hospedado — gateway que não aparece em nenhuma versão do SPEC |
| Quiz de 26 itens, circumplexo de 2 eixos (2.2) | 8 perguntas, `+2 pontos por bicho` (`lib/familiares.ts`) |
| Signo com peso **ZERO** na escolha (2.4) | elemento do signo solar **é o critério de desempate** |
| Gemini 3.5 na voz, 3.1 só na vigilância (8.1) | 3.1-flash-lite na voz; vigilância inexistente |
| 12 escores de afinidade salvos (0.8) | não são calculados; sem coluna no schema |
| Dois produtos, R$ 9,80 e R$ 18,90 (0.3) | um preço, `980` hardcoded em dois arquivos |
| Micro-avisos em 9 pontos do fluxo (7.4) | um link no rodapé (`components/RodapeLegal.tsx`) |
| Conta, verificação de e-mail, endereço permanente (0.5) | pedido anônimo identificado por uuid |
| Oráculo com 3 perguntas grátis (0.4) | `/api/oraculo` só grava e-mail + pergunta numa lista de espera |
| Carta compartilhável **para quem não pagou** (0.3) | toda geração de arte roda depois do pagamento |
| Tiragem diária, perfil público, roda dos 12 (0.3) | não existem |
| Leitura mora em endereço permanente, não em arquivo (0.5) | PDF de 4 páginas é o centro da entrega (`lib/pdf.ts`) |

O diagnóstico da seção 2.1 do SPEC — *"não parece que as perguntas definem o
familiar, e sim o signo"* — está literalmente no código: com 8 itens para 12
saídas os empates são a regra, e `calcularFamiliar()` resolve empate pelo
elemento do signo solar. O sintoma relatado é o comportamento projetado.

**Risco aberto:** existe campo de texto livre (`components/FormularioOraculo.tsx`)
gravando pergunta do usuário sem lista de gatilhos, sem classificador e sem
protocolo de crise — o que o SPEC 0.4 chama de "inegociável enquanto o campo
existir". Atenuante: o DNS do domínio nunca foi apontado (ver Pendências), então
a página provavelmente não é alcançável.

**Sem vendas concluídas:** o banco tem pedidos, todos em
`aguardando_pagamento`. Nenhum cliente para migrar — o remodelamento tem mão
livre.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4
- **SQLite** (`better-sqlite3`) — um único arquivo, sem servidor de banco separado
- **sharp** — composição das artes (lua + animal + textos em SVG)
- **pdf-lib** (+ `@pdf-lib/fontkit`) — PDF de 4 páginas
- **astronomy-engine** — signo solar/lunar calculado 100% offline
- **Gemini** (`@google/genai`, modelo `gemini-3.1-flash-lite`) — texto da leitura
- **Resend** — e-mail transacional (opcional; sem chave, só loga no console)
- **Asaas** — pagamento via **Checkout hospedado** (`/v3/checkouts`) — Pix e
  Cartão de Crédito. Sem chave configurada, cai automaticamente num "pagamento
  fake" pra dev local (ver `lib/pagamento.ts`)
- **rembg** (Python, `isnet-general-use`) — usado *uma única vez*, offline, pra
  remover o fundo dos 12 PNGs dos animais. Não roda em produção; as saídas já
  ficam versionadas em `assets/familiares/`. O `.venv/` de 955 MB que sobrou
  desse processamento foi apagado — se precisar reprocessar um animal novo:
  `python3 -m venv .venv && .venv/bin/pip install rembg onnxruntime`

## Organização das pastas

```
app/         rotas (App Router) + API routes
components/  componentes de UI React
lib/         toda a lógica: banco, pagamento, IA, arte, PDF, astro
assets/      fontes (.ttf/.woff2) e PNGs dos 12 familiares + 4 luas
             → fonte de verdade: app/layout.tsx importa os .woff2 daqui,
               lib/pdf.ts embute os .ttf daqui, e é daqui que se copia
               pro sistema operacional (ver seção de fontes abaixo)
public/       só exemplos/ (3 PNGs da landing) e o favicon
scripts/      utilitários avulsos (tsx), fora do runtime
data/         banco SQLite — nunca versionado, nunca sobrescrito por deploy
storage/      artes/PDFs gerados por pedido — idem
imagens/      matéria-prima de divulgação, 265 MB, não versionada (ver abaixo)
```

Não há testes no projeto. Vale notar que o SPEC 0.7 abre justamente pedindo o
motor de pontuação como "lógica pura, testável no terminal" — é o primeiro
lugar onde teste passa a fazer diferença.

## Pasta `imagens/` (produção de conteúdo)

Não versionada (`.gitignore`) e separada do código — é só matéria-prima pra
criar posts/artes de divulgação, não é usada pelo app em runtime:

- `imagens/brutas/familiares/` e `imagens/brutas/luas/` — cópias das imagens
  originais (mesmo conteúdo de `assets/familiares` e `assets/luas`, mas com o
  fundo ainda presente nos animais).
- `imagens/fundidas/<lua>/<familiar>.png` — as 12×4 = 48 combinações de
  animal + fundo de lua já mescladas (1080×1920), com só o nome do animal
  escrito. Gerado por `npm run gerar-fusoes` (script em
  `scripts/gerar-fusoes.ts`, usa `sharp` com os mesmos assets de
  `lib/arte.ts`).

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
cp assets/fonts/*.ttf ~/.fonts/
fc-cache -f ~/.fonts
```

Sem isso as artes/PDF caem pra uma fonte serifa genérica do sistema — não
quebra, mas perde a identidade visual.

### Variáveis de ambiente (`.env`)

```
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_ENV=sandbox   # sandbox | production
GEMINI_API_KEY=
RESEND_API_KEY=
BASE_URL=http://localhost:3000
PRICE_CENTAVOS=980
```

- **`ASAAS_API_KEY` vazia** → o app usa um provedor de pagamento "fake": o
  checkout confirma na hora, sem ir pra Asaas de verdade. Ótimo pra testar o
  fluxo completo (quiz → leitura → artes → PDF → e-mail) sem gateway nenhum.
- **⚠️ Cuidado com `$` no valor da chave.** As chaves da Asaas começam com
  `$aact_...`. O Next.js expande `$NOME_DE_VARIAVEL` dentro do `.env`
  automaticamente — se não escapar, o `$aact_...` vira string vazia
  silenciosamente. Sempre escrever como `\$aact_...` (contrabarra antes do `$`).
- **`ASAAS_WEBHOOK_TOKEN`** não é algo que a Asaas te dá — você inventa
  qualquer string aleatória e cadastra o mesmo valor no painel da Asaas
  (Configurações → Webhooks) na hora de registrar a URL do webhook. É assim
  que o `/api/webhook` confirma que quem está chamando é realmente a Asaas.
- **Sandbox × Produção são contas completamente separadas na Asaas**,
  inclusive a chave Pix precisa ser cadastrada nas duas de forma independente
  (`sandbox.asaas.com` × `www.asaas.com`).
- **`DEBIT_CARD` não existe no endpoint de Checkout** (`/v3/checkouts`) da
  Asaas — só nas cobranças avulsas (`/v3/payments`). Testado e confirmado
  direto contra a API de produção. Por isso `billingTypes` em
  `lib/pagamento.ts` é só `['PIX', 'CREDIT_CARD']`.

## Arquitetura do fluxo de compra

```
/ritual (12 passos: 8 perguntas + nome + data + hora + email)
  → POST /api/quiz            cria o pedido (status: aguardando_pagamento)
/pagamento/[id]                auto-chama a API de pagamento e redireciona
  → POST /api/pedido/[id]/pagamento
       fake  → marca "pago" na hora, dispara geração, volta pra /obrigado/[id]
       real  → cria checkout na Asaas, redireciona pro link hospedado deles
                (Pix/Cartão — nenhum dado de pagamento passa pelo nosso servidor)
Asaas confirma pagamento
  → POST /api/webhook (header asaas-access-token validado)
       marca "pago" → dispara lib/processar.ts em background
/obrigado/[id]                 tela de carregamento (poll em /api/pedido/[id])
  → quando status = "entregue", redireciona pra:
/revelacao/[id]                 arte + leitura + constelação + compartilhar
```

`lib/processar.ts` é o pipeline completo pós-pagamento: calcula signos
(`lib/astro.ts`) → gera a leitura (`lib/leitura.ts`, Gemini) → compõe as artes
(`lib/arte.ts`, sharp) → monta o PDF (`lib/pdf.ts`) → envia e-mail
(`lib/email.ts`). Roda em background (fire-and-forget) — se o processo cair no
meio, `pedidosTravados()` em `lib/db.ts` + `scripts/reprocessar.ts`
(`npm run reprocessar`) reencaminham pedidos presos em `pago`/`gerando`/`erro`.

### Por que Checkout hospedado, não `/v3/payments`

A primeira versão pedia CPF no próprio site antes de criar a cobrança
(`customer` + `payment` na Asaas). Trocamos pro **Checkout hospedado**
(`/v3/checkouts`) porque:

1. Evita pedir CPF duas vezes (uma no nosso site, outra na página da Asaas)
2. A própria página da Asaas já coleta nome/CPF/e-mail/forma de pagamento —
   uma UX padrão que qualquer brasileiro já conhece
3. Menos requisições (era `/customers` + `/payments`, agora só `/checkouts`)

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
- **Backup:** `scripts/backup.sh` via cron diário (4h), `.tar.gz` de `data/` +
  `storage/` em `/root/backups/bruxario/`, retenção de 14 dias
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

2. **Webhook não está cadastrado no painel da Asaas.** Sem isso, pagamentos
   confirmados não avisam o site (o pedido fica preso em "aguardando
   pagamento" mesmo depois de pago — o cliente só recebe o e-mail se alguém
   rodar `npm run reprocessar` manualmente).
   **Ação necessária:** painel da Asaas (produção) → Configurações →
   Webhooks → cadastrar `https://bruxario.com.br/api/webhook`, marcar os
   eventos `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`, e usar como "token de
   acesso" o mesmo valor de `ASAAS_WEBHOOK_TOKEN` do `.env` do servidor.

3. **Ambiente é `production` com a chave oficial da Asaas.** Qualquer
   checkout concluído a partir de agora é uma cobrança real. Testado até a
   geração do link de checkout (sem finalizar nenhum pagamento automatizado).

### Redeploy manual (até existir CI/CD)

```bash
# da sua máquina, na raiz do projeto:
rsync -az --exclude node_modules --exclude .next --exclude data \
  --exclude storage --exclude .env --exclude '*.png' \
  ./ root@72.61.133.109:/root/apps/bruxario/

ssh root@72.61.133.109 "cd /root/apps/bruxario && npm install && npm run build && pm2 restart bruxario"
```

`data/` (banco SQLite) e `storage/` (artes/PDFs gerados) **nunca** devem ser
sobrescritos por um deploy — ficam só no servidor, fora do rsync.

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
- `app/termos/page.tsx` junta termos e privacidade numa página curta. O SPEC 7.5
  pede três páginas separadas, e falta o essencial: controlador/CNPJ, canal do
  encarregado (DPO), base legal por finalidade, transferência internacional,
  decisão automatizada (art. 20) e direito de arrependimento de 7 dias
- A decisão **18+ ou construir para menor** (SPEC 7.3) está pendente e trava a
  redação das páginas legais e o corpus inteiro
