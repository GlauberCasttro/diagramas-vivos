---
name: diagramas-vivos
description: Gera diagramas de engenharia "vivos" (SVG animado com setas que correm + HTML com passo a passo). Use SOMENTE quando o usuário digitar /diagramas-vivos ou pedir explicitamente um diagrama "vivo", "animado", "com flow" ou "com passo a passo". Pedidos genéricos de diagrama, fluxograma ou arquitetura, sem esses termos, NÃO usam esta skill.
---

# diagramas-vivos (F0: gramática fluxo)

Gera um diagrama com **flow vivo**: setas do caminho feliz correndo, mais um HTML com passo a passo guiado.
Saída em `docs/diagramas/` do projeto atual: `NN-slug.svg` (animado, vai inline em PR/README),
`NN-slug.html` (passo a passo) e `NN-slug.diagram.json` (modelo, fonte da verdade).

**Caminho dos scripts.** Os scripts ficam em `<diretório desta skill>/scripts/`. Resolva
`<diretório desta skill>` a partir do local deste SKILL.md (normalmente `~/.claude/skills/diagramas-vivos`,
um symlink para o repositório) e use caminho absoluto: a skill pode ser chamada de qualquer projeto. Não
copie scripts para o projeto.

## Escopo desta fase

Só existe a gramática **fluxo** (`gramatica: "fluxo"`). Se o pedido for de outro tipo (sequência, ERD, C4,
estados, etc.), diga que esse tipo chega nas fases F1+ e **ofereça um fluxo** equivalente do assunto. Não
improvise outra gramática.

## Procedimento

1. **Entender o pedido.** Leia a descrição, conversa ou código indicado. Decida: as **zonas** (agrupamentos
   numerados, ex.: "1 · Build"), os **nós** e o **papel** de cada um (`feliz`, `gate`, `memoria`, `neutro`,
   `externo`), as **arestas** e o **flow** (a história em passos, com uma nota por passo). Dúvida de
   objetivo: pergunte antes de gerar.
2. **Escrever `diagram.json`** conforme `<diretório desta skill>/references/modelo.md` e as regras de
   composição em `<diretório desta skill>/references/gramaticas/fluxo.md`. Grave num diretório de trabalho
   do projeto (ex.: `docs/diagramas/fonte/diagram.json`). Todo diagrama tem pelo menos 1 flow com 2+ passos.
3. **Gerar.** Da raiz do projeto:
   ```
   node <diretório desta skill>/scripts/gerar.mjs <diagram.json> --saida docs/diagramas --nome NN-slug --direcao DOWN
   ```
   `NN` = próximo número da sequência em `docs/diagramas/` (2 dígitos). Roteador padrão: **ELK** (decisão em
   `docs/f0-resultado.md`: GO com ELK, 0 violações); `--roteador libavoid` só se o ELK falhar. Direção: veja
   a gramática (`DOWN` para fluxos altos/longos, `RIGHT` para curtos). A saída é um JSON no stdout.
4. **Tratar o código de saída.**
   - `0`: gerado, sem violações.
   - `1`: modelo inválido, nada foi escrito. Leia os erros (citam o id do flow/ref), **corrija o
     `diagram.json`** e repita. Nunca invente nó ou caminho para passar na validação.
   - `2`: violação de geometria ou estouro de orçamento (arquivos foram escritos). Ajuste o modelo (menos
     nós por zona, descrições mais curtas, trocar `--direcao`, ou `--roteador libavoid`) e repita.
5. **Verificar com imagens.**
   ```
   python3 <diretório desta skill>/scripts/render_check.py docs/diagramas/NN-slug.html
   ```
   Gera PNGs (tema escuro/claro, passos) em `docs/diagramas/NN-slug-capturas/`. **Olhe as imagens**
   (Read): texto vazando de card, seta sobre rótulo, nota de passo cobrindo o foco. Problema visível volta
   ao passo 3. A captura `svg-*.png` é só a janela superior esquerda; use as de passo para o detalhe.
6. **Entregar.** Diga os caminhos: abrir o **`.html`** para o passo a passo (setas `←`/`→` ou `#passo=N`);
   o **`.svg`** é o diagrama animado para embutir em PR/README. Avisos de cobertura de fonte (ex.: `→`)
   são esperados, não são falha. As pastas `*-capturas/` não precisam ir para o git.
