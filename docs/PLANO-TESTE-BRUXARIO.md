# `teste.bruxario.com.br` — um lugar onde errar de graça

Ideia do dono, 24/08/2026, no meio da integração da Wiven. Não é urgente.
Este documento existe para que ela não se perca e para que quem for fazer não
precise redescobrir por que ela apareceu.

---

## 1. O problema que ela resolve

Hoje só existe um lugar onde a verdade acontece: **produção, com campanha no
ar**. Isso já custou coisas concretas nesta sessão:

- A Wiven não tem sandbox. Nem a Cakto tinha. Testar cobrança significa
  **cobrar de verdade** — a fumaça da Wiven custa os R$ 2,29 de taxa de um
  Pix de R$ 5,00, e é a única forma de saber que funciona.
- O webhook só pode ser confirmado num endereço público. `BASE_URL` local é
  `localhost:3000`, que gateway nenhum alcança — foi preciso uma trava no
  código para que um `callbackUrl` de localhost não virasse cobrança que
  nunca confirma.
- Trocar de gateway exige `pm2 restart` no processo que está atendendo quem
  está comprando naquele minuto.
- `npm run build` **aplica migrações no banco real**. Toda subida mexe no
  banco de quem já pagou.

Um ambiente público, com banco próprio, resolve os quatro.

## 2. O que ele precisa ser

- **Subdomínio real, com HTTPS.** Gateway não entrega webhook em HTTP nem em
  IP cru. É o requisito que elimina as alternativas caseiras.
- **Banco separado.** Nunca o `var/data/bruxario.db` de produção. Migração
  que der errado ali não pode encostar em pedido de gente de verdade.
- **`.env` independente**, e é aqui que mora o valor: `GATEWAY=wiven` no teste
  enquanto produção segue em `mercadopago`.
- **Fora do índice dos buscadores.** `robots.txt` proibindo tudo e
  `X-Robots-Tag: noindex` no nginx. Um funil de teste rankeando e recebendo
  gente de verdade é pior que não ter teste.
- **Fechado por senha** (basic auth no nginx). Vaza link, e link de teste que
  cobra R$ 5 é link que alguém vai clicar.

## 3. Como fazer, na VPS que já existe

Mesma máquina, segundo processo pm2. Não precisa de servidor novo.

```
/root/apps/bruxario         → produção,  pm2 "bruxario",       porta 3000
/root/apps/bruxario-teste   → teste,     pm2 "bruxario-teste", porta 3001
```

1. **DNS**: `teste.bruxario.com.br` → mesmo IP público
2. **nginx**: `server` novo, `proxy_pass` para `127.0.0.1:3001`, mais
   `auth_basic` e `add_header X-Robots-Tag "noindex, nofollow"`
3. **certbot** para o subdomínio
4. `.env` próprio, com `BASE_URL=https://teste.bruxario.com.br` e
   `DB_PATH` (ou o que o projeto usar) apontando para outro arquivo
5. `pm2 start npm --name bruxario-teste -- start` com `PORT=3001`
6. Webhook do gateway apontando para
   `https://teste.bruxario.com.br/api/webhook/<gateway>`

### O ponto que decide o trabalho

**O caminho do banco precisa sair de variável de ambiente.** Se hoje estiver
fixo no código (`var/data/bruxario.db`), os dois processos escrevem no mesmo
arquivo e o ambiente de teste vira o pior dos mundos: parece separado e não é.
**Conferir isso antes de qualquer outra coisa.**

## 4. O que ele destrava depois

- Trocar `GATEWAY` e ver o funil inteiro sem tocar em quem está comprando
- Migração rodando num banco descartável antes de tocar no de verdade
- E-mail, cupom e resgate de carrinho testáveis de ponta a ponta
- Uma cópia do banco de produção, anonimizada, para reproduzir bug de cliente

## 5. Por que NÃO é urgente

O que ele resolveria hoje já tem contorno: a Wiven nasce desligada, o roteador
recusa configuração pela metade, e a trava do `callbackUrl` cobre o erro de
localhost. Ele vale quando a frequência de mudanças no que cobra aumentar —
ou na primeira vez que uma migração assustar.

Custo estimado: uma tarde. A parte imprevisível é o item da §3 sobre o caminho
do banco.
