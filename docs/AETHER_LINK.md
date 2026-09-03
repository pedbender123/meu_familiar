# Aether Link — protocolo pros seus projetos se conectarem ao Petrus

Isso é o que você precisa implementar em CADA sistema seu (bruxario, etc.) pra ele:
1. Aparecer na página **Projetos** do AetherOS.
2. Deixar o Petrus executar ações nele através do chat.

Sem isso implementado do lado do seu projeto, a tool `executar_acao_projeto` não tem com quem falar — o Petrus só vê o que estiver conectado.

## 1. Consiga um token

Na página **Projetos** do AetherOS → **+ Nova conexão** → dá um nome e descrição pro seu projeto → o token aparece **uma única vez**. Copie e guarde numa variável de ambiente do seu projeto (ex: `AETHER_LINK_TOKEN` no `.env`) — **nunca commite esse token no git**.

Se preferir criar via script em vez da tela, é um `POST /api/projects` autenticado com seu Bearer normal do AetherOS:
```bash
curl -X POST http://127.0.0.1:8000/api/projects \
  -H "Authorization: Bearer <seu_token_de_login>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bruxário", "description": "RPG de mesa por IA"}'
```
A resposta traz `"token": "..."` — é isso que vai na variável de ambiente do projeto.

## 2. Conecte no WebSocket

- **Mesma VPS que o AetherOS** (é o seu caso hoje): `ws://127.0.0.1:8000/ws/projects`
- **Máquina diferente na mesma tailnet**: `ws://<IP-tailscale-do-Petrus>:8000/ws/projects`

## 3. Mande o `hello` (primeira mensagem, obrigatória)

Você tem 10 segundos depois de conectar pra mandar isso, senão a conexão fecha sozinha:

```json
{
  "type": "hello",
  "token": "<o token que você guardou>",
  "name": "Bruxário",
  "description": "RPG de mesa por IA para grupos de amigos",
  "actions": [
    { "name": "reiniciar", "description": "Reinicia o processo via pm2", "params": {} },
    { "name": "usuarios_ativos", "description": "Quantos jogadores estão numa sessão agora", "params": {} },
    { "name": "definir_limite", "description": "Ajusta o limite de sessões simultâneas", "params": { "limite": "integer" } }
  ]
}
```

- `token` errado, ou a primeira mensagem não ser `hello` → o AetherOS fecha a conexão com código `4001`.
- `actions` é a lista de coisas que o Petrus pode pedir pro seu projeto fazer. `name` e `description` são o que o modelo lê pra decidir quando chamar; `params` é só documentação informal dos argumentos (não tem validação de schema — descreva em texto mesmo, tipo `"limite": "integer"`).
- Se as ações do seu projeto mudarem depois (novo deploy, nova versão), pode mandar outro `hello` na mesma conexão a qualquer momento — atualiza o que está registrado sem precisar reconectar.

Depois do `hello` aceito, sua conexão aparece como **conectado** na página Projetos e o Petrus já vê suas ações no contexto dele.

## 4. Escute por `invoke` e responda com `invoke_result`

Quando alguém pedir pro Petrus fazer algo no seu projeto, você recebe:
```json
{ "type": "invoke", "request_id": "abc-123", "action": "usuarios_ativos", "params": {} }
```

Execute a ação e responda **na mesma conexão**, com o mesmo `request_id`:
```json
{ "type": "invoke_result", "request_id": "abc-123", "result": "3 jogadores ativos agora." }
```
- `result` é sempre string (se sua ação devolver número/objeto, faça `String(...)`/`str(...)` antes de mandar).
- O Petrus espera até **30 segundos** pela resposta. Se estourar, ele recebe um erro de timeout e você não precisa mandar nada depois disso (a espera já foi cancelada do lado dele).

## 5. Reconecte se cair

Não tem heartbeat obrigatório — a conexão em si já é o sinal de vida (cair = aparece como offline na hora). Mas você deve reconectar automaticamente se a conexão cair (rede, restart do seu processo, restart do AetherOS), senão fica invisível pro Petrus até você notar. Ver o exemplo abaixo — ele já reconecta sozinho.

## Exemplo completo — Node.js (pacote `ws`)

```js
const WebSocket = require('ws')

const AETHER_URL = 'ws://127.0.0.1:8000/ws/projects'
const TOKEN = process.env.AETHER_LINK_TOKEN

const ACTIONS = [
  { name: 'reiniciar', description: 'Reinicia o processo via pm2', params: {} },
  { name: 'usuarios_ativos', description: 'Quantos jogadores estão numa sessão agora', params: {} },
]

async function executarAcao(action, params) {
  switch (action) {
    case 'reiniciar':
      // ex: require('child_process').exec('pm2 restart bruxario')
      return 'Reiniciado com sucesso.'
    case 'usuarios_ativos':
      return String(contarUsuariosAtivos())
    default:
      return `[ERRO] ação desconhecida: ${action}`
  }
}

function connectAetherLink() {
  const ws = new WebSocket(AETHER_URL)

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'hello',
      token: TOKEN,
      name: 'Bruxário',
      description: 'RPG de mesa por IA para grupos de amigos',
      actions: ACTIONS,
    }))
    console.log('[aether-link] conectado')
  })

  ws.on('message', async (raw) => {
    const data = JSON.parse(raw.toString())
    if (data.type === 'invoke') {
      const result = await executarAcao(data.action, data.params || {})
      ws.send(JSON.stringify({ type: 'invoke_result', request_id: data.request_id, result }))
    }
  })

  ws.on('close', (code, reason) => {
    console.log(`[aether-link] desconectado (${code}: ${reason}) — reconectando em 5s`)
    setTimeout(connectAetherLink, 5000)
  })

  ws.on('error', (err) => console.error('[aether-link] erro:', err.message))
}

connectAetherLink()
```

Suba isso junto com o processo principal do projeto (ex: no `server.js`, ou num arquivo separado iniciado pelo mesmo `pm2`).

## Exemplo completo — Python (pacote `websockets`)

```python
import asyncio, json, os
import websockets

AETHER_URL = "ws://127.0.0.1:8000/ws/projects"
TOKEN = os.environ["AETHER_LINK_TOKEN"]

ACTIONS = [
    {"name": "status", "description": "Status atual do sistema", "params": {}},
]

async def executar_acao(action: str, params: dict) -> str:
    if action == "status":
        return "Rodando normalmente."
    return f"[ERRO] ação desconhecida: {action}"

async def connect():
    while True:
        try:
            async with websockets.connect(AETHER_URL) as ws:
                await ws.send(json.dumps({
                    "type": "hello", "token": TOKEN,
                    "name": "MeuProjeto", "description": "...",
                    "actions": ACTIONS,
                }))
                print("[aether-link] conectado")
                async for raw in ws:
                    data = json.loads(raw)
                    if data.get("type") == "invoke":
                        result = await executar_acao(data["action"], data.get("params", {}))
                        await ws.send(json.dumps({
                            "type": "invoke_result",
                            "request_id": data["request_id"],
                            "result": result,
                        }))
        except Exception as e:
            print(f"[aether-link] caiu ({e}), reconectando em 5s")
            await asyncio.sleep(5)

asyncio.run(connect())
```

## Segurança
- O token é a única coisa que autentica seu projeto — trate como senha (variável de ambiente, nunca no git).
- `/ws/projects` roda na mesma porta 8000 do AetherOS, que já é Tailscale-only (bloqueado publicamente pelo `ufw`) — não precisa abrir porta nova nem mudar firewall.
- Se perder/vazar um token, apague o projeto na página Projetos e crie de novo (gera um token novo, o antigo para de funcionar).
