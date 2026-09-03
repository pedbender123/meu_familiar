# Os ebooks

Largue os arquivos aqui. **O nome tem que bater exatamente** — é ele que liga
o arquivo ao catálogo em `src/nucleo/biblioteca/catalogo.ts`.

## Onde vai o quê

```
biblioteca/pdfs/magia-elemental.pdf     Aprenda Magia Elemental em 7 Dias — R$ 9,90
biblioteca/pdfs/ler-o-futuro.pdf        Aprenda Como Ler seu Futuro com Cartas — R$ 14,90
biblioteca/pdfs/terceiro-olho.pdf       Aprenda a Despertar seu Terceiro Olho — R$ 17,90

biblioteca/capas/magia-elemental.jpg
biblioteca/capas/ler-o-futuro.jpg
biblioteca/capas/terceiro-olho.jpg
```

## O que acontece quando o arquivo chega

**O livro aparece sozinho.** Não precisa mexer em código, nem reiniciar nada:
o catálogo confere o disco a cada visita. Sem PDF, o livro não é oferecido no
checkout nem vendido — de propósito.

Essa é a trava mais importante daqui. Um livro anunciado cujo PDF não existe
faria a pessoa pagar a mais, o pagamento confirmar, e a entrega devolver 404.
Enquanto o arquivo não estiver aqui, ninguém consegue pagar por ele.

A capa é enfeite: sem ela o livro ainda vende, só aparece sem imagem. O PDF é
que manda.

## Nome errado

Não quebra nada e não avisa nada — o livro simplesmente não aparece. Se você
largou o arquivo e ele não apareceu no checkout, o nome está diferente do que
está na tabela acima.

## Por que os arquivos vão para o repositório

Porque o deploy é um `rsync` da raiz: o livro viaja junto do código e chega em
produção sozinho. A alternativa (`var/`) exigiria um upload manual por livro —
e esquecer esse upload significa vender um PDF que não existe do outro lado.

O custo é o repositório engordar alguns MB por livro. Vale a troca.
