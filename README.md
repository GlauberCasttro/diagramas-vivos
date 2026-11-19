# diagramas-vivos

Skill do Claude Code que gera diagramas de engenharia com **flow vivo**: setas com
tracejado que corre e passo a passo guiado, no visual do
[floorplan](https://github.com/haydenschmitty/floorplan).

Cobre um catálogo de 245 tipos de diagrama (fluxo, arquitetura, processos, UML, dados,
infra, integração, segurança, estados, testes, requisitos, agentes de IA e planejamento),
organizados em 12 gramáticas de layout. Cada diagrama sai como **SVG animado** (aparece
inline em PRs e READMEs) e **HTML com passo a passo**.

Estado: **F0** (gramática fluxo funcionando). Veja [o documento de design](docs/superpowers/specs/2026-11-18-diagramas-vivos-design.md).

## Como usar (F0)

Instalação: `npm install` no repositório e `ln -s <este repositório> ~/.claude/skills/diagramas-vivos`.
Num projeto qualquer, peça `/diagramas-vivos fluxo de deploy com aprovação manual` (ou "diagrama vivo",
"animado", "com flow", "com passo a passo"). A skill escreve `docs/diagramas/NN-slug.{svg,html,diagram.json}`.

Na F0 só existe a gramática **fluxo**; os demais tipos chegam nas fases seguintes. Resultado da fase:
[docs/f0-resultado.md](docs/f0-resultado.md). Exemplos em `exemplos/`.
