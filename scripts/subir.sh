#!/usr/bin/env bash
#
# Sobe o código local para a VPS. Único caminho de deploy do projeto.
#
#   scripts/subir.sh teste       → teste.bruxario.com.br  (porta 3003)
#   scripts/subir.sh producao    → bruxario.com.br        (porta 3000)
#
# Por que existe: o deploy era uma sequência decorada de scp + build + restart,
# e o git da VPS mente sobre o que está no ar (o deploy sempre foi por cópia de
# arquivo, nunca por pull). Aqui a fonte da verdade é a árvore local.
#
# O que ele NUNCA envia: .env, var/ (banco e artes), node_modules, .next.
# O .env de cada máquina é dela. É isso que deixa o teste em GATEWAY=wiven
# enquanto produção segue no que ela estiver.
set -euo pipefail

ALVO="${1:-}"
VPS=root@100.126.229.42   # só pela tailnet

case "$ALVO" in
  teste)
    DIR=/root/apps/bruxario-teste; PROC=bruxario-teste; SITE=https://teste.bruxario.com.br ;;
  producao)
    DIR=/root/apps/bruxario;       PROC=bruxario;       SITE=https://bruxario.com.br ;;
  *)
    echo "uso: $0 {teste|producao}" >&2; exit 2 ;;
esac

if [ "$ALVO" = producao ]; then
  echo "PRODUÇÃO. Isto mexe no site que está vendendo, e o build aplica"
  echo "migrações no banco de quem já pagou (há backup antes)."
  read -r -p 'Escreva "sim" para seguir: ' ok
  [ "$ok" = sim ] || { echo abortado; exit 1; }
fi

# O .env nunca pode viajar nem entrar em commit. Confere antes de tudo.
git check-ignore -q .env || { echo "PERIGO: .env não está no .gitignore"; exit 1; }

echo "→ enviando arquivos para $DIR"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude var --exclude .git \
  --exclude .env --exclude tsconfig.tsbuildinfo --exclude '*.html' \
  ./ "$VPS:$DIR/"

echo "→ build e restart"
ssh "$VPS" "set -e
  cd $DIR
  mkdir -p /root/backups-deploy
  node scripts/backup-banco.js /root/backups-deploy/$(basename $DIR)-\$(date +%Y%m%d-%H%M%S).db
  npm ci --no-audit --no-fund --prefer-offline >/dev/null
  npm run build
  pm2 restart $PROC --update-env
"

echo "→ conferindo"
sleep 3
codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE/")
# 401 no teste é o basic auth respondendo: o site está de pé.
case "$codigo" in
  200|401) echo "no ar: $SITE ($codigo)" ;;
  *)       echo "ATENÇÃO: $SITE respondeu $codigo"; exit 1 ;;
esac
