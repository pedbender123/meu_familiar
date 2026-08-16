# Pixel do Meta — plano de integração

## O que vai ser feito

Pixel client-side no `layout.tsx` + evento de compra disparado **do servidor** no webhook do Mercado Pago (Conversions API). Nenhum setup complexo, nenhuma aprovação de API.

---

## Pré-requisitos (antes de mexer no código)

### 1. Criar o Pixel
1. Acessar `business.facebook.com/events_manager`
2. Clicar em **Conectar fontes de dados → Web**
3. Escolher **Meta Pixel → Conectar**
4. Dar um nome (ex: "Bruxário") e criar
5. **Copiar o Pixel ID** (formato: `1234567890123456`)

### 2. Gerar o token da CAPI
Na mesma tela do Pixel criado:
1. Ir na aba **Configurações**
2. Rolar até **API de Conversões**
3. Clicar em **Gerar token de acesso**
4. **Copiar o token** (string longa)

### 3. Adicionar ao `.env`
```
META_PIXEL_ID=1234567890123456
META_CAPI_TOKEN=EAAxxxxxxxxxxxxx...
```

---

## O que implementar no código

### A — Snippet base no `layout.tsx`
O script padrão do Meta que dispara `PageView` automaticamente em toda navegação.
Precisa ler `META_PIXEL_ID` do env e injetar via `<Script>` do Next.js.

### B — Evento `Purchase` no webhook (`/api/webhook/route.ts`)
Quando o Mercado Pago confirmar o pagamento (status `approved`), depois de atualizar o pedido no banco, fazer um `fetch` para:

```
POST https://graph.facebook.com/v19.0/{PIXEL_ID}/events
```

Com o payload:
```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1234567890,
    "action_source": "website",
    "user_data": {
      "em": ["<hash SHA-256 do e-mail>"]
    },
    "custom_data": {
      "currency": "BRL",
      "value": 29.90
    }
  }],
  "access_token": "..."
}
```

> O e-mail precisa ir em SHA-256 em minúsculas — exigência do Meta. O valor vem do pedido no banco (já existe `precoDoPedido()`).

### C — (Opcional) `Lead` no `/api/mini`
Quando a pessoa envia o formulário e o pedido é criado — antes de pagar. Útil para otimização de campanha de leads.

---

## O que NÃO precisa fazer

- Nada de conta empresarial especial
- Nada de aprovação de API
- Nenhum SDK do Meta — é só um `fetch`
- Não precisa mexer na página `/obrigado` (o servidor cuida)
