# A licença deste sistema

## Primeiro, a verdade

**Quem tem o código-fonte pode remover qualquer trava que esteja no código.**
Não existe forma de impedir isso, e este documento não finge o contrário.

Este mecanismo **não é uma fechadura**. É um freio: permite ao licenciante
desligar a aplicação de onde estiver, sem acesso ao servidor, e faz de
contorná-lo um ato deliberado — com data e autoria no `git` de quem contornou.

## Como funciona

O sistema consulta, de tempos em tempos, um endereço definido em
`LICENCA_URL`. A resposta é um JSON **assinado** (Ed25519); a chave pública
vem no `.env`, a privada fica com o licenciante.

| estado | efeito |
|---|---|
| `ativa` | nada muda |
| `avisando` | faixa no topo de toda página, visível para os clientes |
| `suspensa` | o site vira uma tela de indisponibilidade; **o painel continua abrindo** |

O painel seguir acessível na suspensão é deliberado: quem opera precisa
continuar vendo os pedidos e falando com quem comprou.

## Falha de rede não desliga o site

Se o endereço da licença estiver fora do ar, a aplicação **continua
funcionando** com a última resposta válida. Um site de vendas que morre porque
um servidor de licença piscou prejudica mais quem licencia do que quem opera —
a venda perdida é dele.

Passadas 72 horas sem contato, o estado passa a `avisando`. Não suspende.

## Sem licença configurada, roda normalmente

Sem `LICENCA_URL` e `LICENCA_CHAVE_PUBLICA` no ambiente, `estadoDaLicenca()`
devolve `ativa`. Desenvolvimento, teste e primeira subida não dependem de
nada disso.

## Onde está

`src/lib/licenca.ts`, comentado e sem disfarce. Esconder não adiantaria —
ofuscar código que viaja junto com o fonte é teatro — e um mecanismo que se
descobre depois é pior para a relação do que um que se lê no primeiro dia.
