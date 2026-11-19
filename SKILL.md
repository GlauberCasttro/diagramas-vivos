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

**Pré-requisito.** As dependências dos scripts (elkjs, fontkit, libavoid-js) são instaladas com `npm install`
no `<diretório desta skill>` (uma vez, após clonar ou atualizar). O CLI sempre responde com **um JSON** no
stdout; se a saída não for JSON (ex.: `Cannot find package 'elkjs'`, erro de sintaxe do Node), o **ambiente
está quebrado**, não o modelo: rode `npm install` no diretório da skill (Node recente) e repita. Não mexa
no `diagram.json` por causa disso.

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
3. **Gerar.** Da raiz do projeto, para um diagrama **novo**:
   ```
   node <diretório desta skill>/scripts/gerar.mjs <diagram.json> --saida docs/diagramas --direcao <DOWN|RIGHT>
   ```
   **Não calcule o `NN` à mão:** sem `--nome`, o CLI numera sozinho (próximo número livre em
   `docs/diagramas/`, 2 dígitos) e deriva o slug do título; os caminhos escritos vêm em `arquivos` no JSON.
   Para **regerar** um diagrama que já existe, passe o mesmo nome dele: `--nome NN-slug` (sobrescreve).
   Direção: veja a gramática (`DOWN` para fluxos altos/longos ou com retornos, `RIGHT` só para curtos; na
   dúvida, `DOWN`, que é o padrão). Roteador padrão: **ELK** (decisão em `docs/f0-resultado.md`: GO com ELK,
   0 violações); `--roteador libavoid` só se o ELK falhar. A saída é um JSON no stdout:
   `{arquivos, bytes, violacoes, avisos, roteador, direcao}` (ou `{erro, erros}` no exit 1).
4. **Tratar o código de saída.**
   - `0`: gerado, sem violações. Ainda assim leia `avisos`.
   - `1`: modelo inválido, nada foi escrito. Leia `erros` (citam o id do flow/ref), **corrija o
     `diagram.json`** e repita. Nunca invente nó ou caminho para passar na validação. (Saída que não é JSON
     não é este caso: veja o pré-requisito.)
   - `2`: violação de geometria ou estouro de orçamento (arquivos foram escritos). **Leia `violacoes` e
     `avisos` do JSON antes de ajustar**: cada violação diz o `tipo` (`atravessa-no`, `sobreposicao`, `rotulo-colide`,
     `diagonal`, `orcamento`) e a `aresta`/`alvo`/`arquivo` envolvidos. Ajuste o que ela aponta (menos nós por zona,
     descrições mais curtas, trocar `--direcao`, ou `--roteador libavoid`) e repita com o mesmo `--nome`.
5. **Verificar com imagens.**
   ```
   python3 <diretório desta skill>/scripts/render_check.py docs/diagramas/NN-slug.html
   ```
   Gera PNGs (SVG, HTML em repouso e cada passo, nos temas escuro e claro) em
   `docs/diagramas/NN-slug-capturas/`; capturas antigas da pasta são apagadas antes. **Olhe as imagens**
   (Read): texto vazando de card, seta sobre rótulo, nota de passo cobrindo o foco. Problema visível volta
   ao passo 3. A captura `svg-*.png` é só a janela superior esquerda; use as de passo para o detalhe.
   **Se o `render_check.py` sair com código 1** (ex.: `Chrome/Chromium nao encontrado`, captura não gerada),
   a verificação visual **não aconteceu**: nunca trate como aprovado. Na entrega, diga que a verificação
   visual foi pulada e por quê (a mensagem do stderr). Chrome fora do lugar padrão: aponte o executável em
   `DIAGRAMAS_VIVOS_CHROME=/caminho/do/chrome` e rode de novo.
6. **Entregar.** Diga os caminhos: abrir o **`.html`** para o passo a passo (setas `←`/`→` ou `#passo=N`);
   o **`.svg`** é o diagrama animado para embutir em PR/README. Avisos de cobertura de fonte (ex.: `→`)
   são esperados, não são falha. As pastas `*-capturas/` não precisam ir para o git.
