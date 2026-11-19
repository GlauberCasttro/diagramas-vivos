# diagramas-vivos

Skill do Claude Code que gera diagramas de engenharia com **flow vivo**: setas com
tracejado que corre e passo a passo guiado, no visual do
[floorplan](https://github.com/haydenschmitty/floorplan).

Cobre um catálogo de 245 tipos de diagrama (fluxo, arquitetura, processos, UML, dados,
infra, integração, segurança, estados, testes, requisitos, agentes de IA e planejamento),
organizados em 12 gramáticas de layout. Cada diagrama sai como **SVG animado** (aparece
inline em PRs e READMEs) e **HTML com passo a passo**.

Estado: **F0.1** (gramática fluxo com requisição viva). Veja [o documento de design](docs/superpowers/specs/2026-11-18-diagramas-vivos-design.md).

## Como usar

Instalação: `npm install` no repositório e `ln -s <este repositório> ~/.claude/skills/diagramas-vivos`.
Num projeto qualquer, peça `/diagramas-vivos fluxo de uma requisição de pedido` (ou "diagrama vivo",
"animado", "com flow", "com passo a passo"). A skill escreve `docs/diagramas/NN-slug.{svg,html,diagram.json}`.

O que sai:
- **`.svg` vivo**, o entregável principal: cards com ícone e selo, ligações coloridas por tipo (chamada, rpc,
  dados, evento, fila) e respostas tracejadas de volta. Uma bolinha percorre cada cenário em loop, sem
  JavaScript, e um rodapé lista os cenários ("1. Criar pedido: Usuário → Gateway → ..."). Abre tocando em PR,
  README e no preview do VS Code.
- **`.html`**: o mesmo diagrama com passo a passo (setas `←`/`→` ou `#passo=N`), tema claro/escuro.
- **`.diagram.json`**: o modelo, fonte da verdade (formato em `references/modelo.md`).

Por padrão o layout é horizontal (`RIGHT`); `--direcao DOWN` para cadeias longas. Capturas PNG de verificação
(`scripts/render_check.py`) vão para uma pasta temporária, não para o projeto.

### Gerar os exemplos localmente

As saídas dos exemplos não são versionadas (só `exemplos/*/diagram.json`). Para gerar e abrir:

```
node scripts/gerar.mjs exemplos/requisicao/diagram.json --saida /tmp/dv-exemplos
node scripts/gerar.mjs exemplos/agente/diagram.json --saida /tmp/dv-exemplos
open /tmp/dv-exemplos/01-requisicao-de-pedido.svg   # ou o .html
python3 scripts/render_check.py /tmp/dv-exemplos/01-requisicao-de-pedido.html   # capturas em <tmp>/diagramas-vivos-capturas/
```

Exemplos: `agente`, `requisicao` (F0.1, com ida e volta) e `deploy`, `fluxo-card`, `skill` (F0, cadeias longas;
use `--direcao DOWN`). Só existe a gramática **fluxo**; os demais tipos chegam nas fases seguintes.
Resultados: [docs/f0-resultado.md](docs/f0-resultado.md).
