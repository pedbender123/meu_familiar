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
  ficam versionadas em `assets/familiares/`

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

- Sem painel admin — consultas via `sqlite3 data/bruxario.db` direto no SSH
  (decisão do `SPEC.md`: menos superfície de ataque na v1)
- Oráculo Horário (fase 2, `SPEC.md` seção 12) — só captura e-mail/pergunta
  em `oraculo_espera` por enquanto, sem produto ativo
- Sem cancelamento automático de cobranças `aguardando_pagamento` antigas
  (o `SPEC.md` sugere um job diário; ainda não implementado)
