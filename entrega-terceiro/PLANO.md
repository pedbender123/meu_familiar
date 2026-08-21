# Versão reduzida — o funil que vende, e mais nada

> Documento de decisão. A pasta `entrega-terceiro/` é a versão limpa que vai
> para fora: sem chave nenhuma sua, sem conta de cliente, sem plataforma,
> pronta para rodar com DirectPag.

## O que esta versão é

Um produto único, vendido uma vez, entregue por e-mail:

```
anúncio → 26 cenas → revelação parcial + oferta → pagamento → PDF no e-mail
```

É exatamente o funil que já vendeu. Nada além dele.

## O que sai, e por quê

| sai | por quê |
|---|---|
| **Toda a área logada** (`/conta/*`) | O produto vira "recebe o PDF", não "entra na plataforma" |
| **Oráculo, calendário, guia semanal** | São a plataforma. Custam IA por uso e não existem num produto avulso |
| **Assinaturas, planos, cobranças, cotas** | Não há recorrência aqui |
| **Link mágico para clientes** | Só o painel tem login. Cliente não entra em lugar nenhum |
| **Horóscopo** | Segundo produto, nunca vendeu, pixel e checkout próprios |
| **Aether** | Integração sua, não do produto |
| **Palma** (`servidor/palma_api.py`) | Serviço externo seu |
| **Marcações / bônus por Instagram** | Depende de você conferir a marcação à mão |
| **Mercado Pago** | Substituído por DirectPag |

## O que fica

| fica | por quê |
|---|---|
| As 26 cenas e a pontuação | É o produto |
| Geração da leitura por IA | É o produto |
| Artes (story, feed, carta, og) e PDF | É a entrega |
| E-mail de entrega com o PDF anexo | É a entrega |
| Link da revelação, público por N dias | É o que a pessoa compartilha, e é aquisição |
| Checkout **DirectPag** (Pix, cartão, boleto) | É o dinheiro |
| Pixel da Meta com `event_id` | É o que faz o anúncio otimizar |
| Rastreio próprio (visitas, marcos, campanhas, peças) | É o que diz qual criativo vendeu |
| Cupons | Já é usado nas campanhas |
| Painel administrativo | Reduzido ao que faz sentido aqui |
| Termos, privacidade, contato, descadastro | Exigência legal |

---

## ⚠️ A lista que precisa da sua decisão

Estas eu **não** decidi sozinha. Cada uma tem um argumento dos dois lados —
marque as que ficam e eu ajusto tudo de uma vez.

### 1 · Mural de revelações públicas (`/mural`) e comentários
**A favor:** prova social real, e é aquisição gratuita — quem compartilha traz
gente. Já está pronto.
**Contra:** exige moderação (aprovar comentário) e dá ao terceiro uma tela
administrativa a mais para manter.

### 2 · Recuperação de carrinho (`scripts/lembrar-carrinho.ts`)
**A favor:** é a receita mais barata do sistema — a pessoa já respondeu tudo e
já deu o e-mail, falta lembrança, não convencimento.
**Contra:** exige cron instalado no servidor dele. Se ele não instalar, o
código fica lá sem rodar.

### 3 · Remarketing pelo painel (`/painel/remarketing`)
**A favor:** lista quem comprou, quem abandonou, e permite disparar e-mail.
**Contra:** é a área mais complexa do painel e depende de rotina manual.

### 4 · Sentinela e alarmes (invariantes, anomalias)
**A favor:** é o que avisa quando uma venda foi cobrada com valor errado ou
uma entrega falhou em silêncio. Num sistema que mexe com dinheiro, é o que
transforma "não atrapalhou" em medida em vez de fé.
**Contra:** só faz sentido se alguém olhar o painel ou receber os e-mails.

### 5 · Funis alternativos (`/atravessar` de 7 perguntas, `/familiar` longo)
**A favor:** já existem, e o teste A/B entre eles é a máquina de descobrir o
que converte melhor.
**Contra:** **nenhum dos dois vendeu.** Todas as vendas saíram das 26 cenas.
São ~1.200 linhas para manter por uma hipótese não confirmada.
*Minha inclinação: cortar. Se ele quiser testar, testa com o que vender.*

### 6 · Reconciliação com o gateway (`scripts/reconciliar.ts`)
**A favor:** acha pagamento aprovado no gateway que não virou entrega aqui —
ou seja, gente que pagou e não recebeu. Isso já aconteceu.
**Contra:** precisa ser reescrito para a API do DirectPag.
*Minha inclinação: manter, mas ele terá que implementar a parte do DirectPag.*

### 7 · Backfill do pixel (`scripts/backfill-pixel.ts`)
**A favor:** reenvia vendas que não chegaram à Meta.
**Contra:** exige token de Conversions API, que **você não tem acesso**. Sem
ele o script é inútil.
*Minha inclinação: cortar, e deixar anotado como voltar.*

### 8 · Narração em áudio da leitura
**A favor:** diferencial de produto real, custo irrisório.
**Contra:** era exclusiva da "Completa". Num produto único, ou entra para
todos (e some como diferencial) ou não entra.

### 9 · Produto "Completa" e "Link permanente"
**A favor:** é upsell pronto — a Completa converte parte de quem ia levar a
Revelação.
**Contra:** dobra a superfície de teste e de suporte.
*Se ficar só um produto, qual: a Revelação (mais barata, mais volume) ou a
Completa (mais margem)?*

### 10 · Ambiente de ensaio e backup (`scripts/ensaio.ts`, `backup.ts`)
**A favor:** o backup é obrigatório antes de qualquer migração. O ensaio roda
migração numa cópia do banco antes de tocar o real.
**Contra:** nenhum, na minha opinião. Só listo porque é infraestrutura, não
produto — e você pode preferir entregar mais enxuto.
