# O que esta entrega NÃO contém

> Escrito para não haver mal-entendido depois: o que está na pasta é o
> **produto do acordo** — o funil da revelação do familiar. O que ficou de
> fora não é omissão, é escopo.

## O que veio

O caminho completo do dinheiro, e só ele:

| | |
|---|---|
| O teste de 26 cenas e a pontuação | os quatro eixos, os doze familiares |
| O bilhete e a tela de oferta | a prévia que converte |
| A leitura completa por IA | o texto que se vende |
| As artes e o PDF | a entrega |
| O e-mail com o PDF anexo | a entrega |
| Checkout DirectPag | Pix e boleto |
| Pixel da Meta | `PageView`, `Lead` e `Purchase` |
| Painel de pedidos | ver o que vendeu e o que falhou |
| Páginas legais | termos e privacidade |

## O que ficou de fora, e por quê

Cada um destes é **um produto ou um sistema separado**, e nenhum estava no
acordo:

| fora | o que é |
|---|---|
| **Plataforma de assinatura** | planos, cobranças recorrentes, cotas, direitos por plano |
| **Oráculo** | consultas com IA, espetáculos de tarô, memória, histórico |
| **Calendário astrológico** | mapa natal, trânsitos, dias de ouro, guia semanal |
| **Área logada do cliente** | conta, perfil, retrato, login por link mágico |
| **Sistema de atribuição** | campanhas, peças, funis A/B, visitas, marcos, toques, relatórios por criativo |
| **Painel analítico** | receita por campanha, LTV, jornada, gráficos, financeiro |
| **Sentinela** | detecção de anomalias por invariantes, alarmes por e-mail |
| **Remarketing** | listas, disparos, recuperação de carrinho |
| **Cupons** | criação, validação, limite de uso, cupom de lançamento |
| **Mural e prova social** | revelações públicas, comentários, moderação |
| **Marcações no Instagram** | bônus por compartilhar, conferência manual |
| **Horóscopo** | segundo produto, com checkout e pixel próprios |
| **Leitura de palma** | serviço de visão computacional à parte |
| **Reconciliação e backfill** | conferência contra o gateway, reenvio de eventos |

## Sobre o que sobrou dentro

Duas coisas ficaram porque **o funil não vende sem elas**, não porque sejam
parte de um sistema maior:

- **`astro.ts`, `signos.ts`, `zodiaco.ts`, `coordenadas.ts`** — o signo solar
  e a fase da lua entram na leitura e na arte. É cálculo local, sem API.
- **O pixel da Meta** — sem medir o anúncio não há como anunciar.

## Licença

Ver `bruxario/LICENCA.md`. O resumo honesto: quem tem o código remove qualquer
trava. O que protege de verdade é o domínio, a conta do gateway e o contrato.
