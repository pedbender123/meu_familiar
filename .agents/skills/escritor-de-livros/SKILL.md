---
name: escritor-de-livros
description: Gera e expande livros completos da biblioteca do Bruxário com o novo padrão de 10 páginas de pergaminho por capítulo (2.500 a 3.200 palavras), usando os 6 movimentos obrigatórios.
---

# Skill: Escritor de Livros do Bruxário

Esta skill automatiza a geração e expansão de livros completos para a biblioteca do Bruxário, garantindo que cada capítulo atinja o padrão de **10 páginas de pergaminho** no leitor do aplicativo (~2.500 a 3.200 palavras por capítulo, 70 a 95 páginas por livro).

## Como Usar

### 1. Via Script Automatizado (Recomendado)
Para gerar ou expandir um livro completo de uma só vez via API do Gemini:

```bash
# Gera um livro específico:
npm run gerar-livro magia-elemental
npm run gerar-livro ler-o-futuro
npm run gerar-livro terceiro-olho

# Ou gera todos os 3 livros sequencialmente:
npm run gerar-livro todos
```

### 2. Verificação das Páginas do Leitor
Para conferir a paginação de pergaminho e tempo de leitura:

```bash
npx tsx scripts/gerar-livro.ts <id-do-livro>
```

Ou execute a conferência direta:
```bash
npx tsx -e "
import { lerLivro, paginarCapitulo } from './src/nucleo/biblioteca/formato';
import fs from 'fs';
const l = lerLivro(fs.readFileSync('biblioteca/texto/<id>.md', 'utf8'));
console.log(l.meta.titulo, l.palavras + ' palavras,', l.minutos + ' min');
for (const m of l.modulos) {
  console.log('#', m.titulo);
  for (const c of m.capitulos) {
    const pags = paginarCapitulo(c).length;
    console.log('   ##', c.titulo, '->', pags, 'páginas de pergaminho');
  }
}
"
```

## Padrão Obrigatório dos 6 Movimentos
Cada capítulo deve conter, como texto corrido (sem títulos intermediários):
1. **A Desmistificação e a Anatomia do Engano** (~400 a 500 palavras)
2. **A Mecânica Subjacente e os Fundamentos Ocultos** (~750 a 900 palavras)
3. **A Crônica de Ofício: Caso Narrativo em Profundidade** (~850 a 1.000 palavras)
4. **As Armadilhas, Riscos e Contraindicações** (~400 a 500 palavras)
5. **A Liturgia Doméstica: Transição e Preparação** (~300 a 400 palavras)
6. **O Bloco `:::pratica`** (~350 a 500 palavras)
