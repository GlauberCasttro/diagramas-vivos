# diagramas-vivos — F0.1 (requisição viva, câmera fixa, layout compacto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fazer o diagrama se comportar como uma requisição rodando (ida A → B e resposta B ⇠ A), com câmera fixa no diagrama inteiro, passos por ligação, bolinha correndo e layout horizontal compacto — no padrão de fluidez dos flows do floorplan.

**Architecture:** Mudanças sobre a F0 (mesmo pipeline): modelo ganha `resposta` (aresta) e `sentido` (passo); `destaques` passa a devolver o sentido; layout volta ao RIGHT compacto; SVG desenha a volta paralela; stepper deixa de mover a câmera por passo.

**Tech Stack:** igual à F0 (Node ≥ 18 ESM, elkjs 0.9.3, fontkit 2.0.4, node:test, Chrome headless).

**Spec:** `docs/superpowers/specs/2026-11-18-diagramas-vivos-adendo-requisicao.md` (prevalece sobre o design e o plano F0 onde conflitar) + `docs/superpowers/specs/2026-11-18-diagramas-vivos-design.md`.

## Global Constraints
- Tudo das Global Constraints do plano F0 continua valendo (offline, sem foreignObject, SVG < 150 KB, HTML < 300 KB, AA, reduced-motion, papéis, NOTICE/cabeçalhos).
- Aresta: campo opcional `resposta` (string não vazia, ≤ 40 caracteres).
- Passo: campo opcional `sentido` ∈ `ida | volta` (padrão `ida`); só vale quando `ref` é aresta; `volta` exige que a aresta tenha `resposta`.
- Câmera do HTML: enquadra o diagrama inteiro ao abrir e **não se move** entre passos (zoom/pan só manuais).
- "Tocar": **1500 ms** por passo.
- Barra do passo: título do flow, "passo i de n", "A → B" (ida) ou "B ⇠ A · <resposta>" (volta), e a nota.
- Direção padrão do CLI: **RIGHT**. Espaçamento ELK entre camadas **60**, entre nós **24**; card **240** px de largura.
- A volta é desenhada como seta tracejada paralela à ida, a **6 px** dela, mesma cor do papel da aresta, mais fina, com o rótulo da resposta.

## Review Focus
1. Volta em aresta sem `resposta` → erro de validação citando o flow e o passo.
2. Diagrama com ~11 nós em 3–4 zonas → cabe com proporção entre 1:1 e 3:1 e sem violações de geometria.
3. Passo de volta → bolinha percorre do `para` ao `de` e a barra mostra "B ⇠ A · resposta".
4. Navegar ←/→ ou `#passo=N` não altera o transform da câmera.
5. Reduced motion → sem bolinha, sem animação; destaque continua.

---

### Task 11: Modelo e destaques com ida/volta
**Files:** Modify `scripts/lib/modelo.mjs`, `assets/destaques.mjs`, `references/modelo.md`; Test `tests/modelo.test.mjs`, `tests/destaques.test.mjs`
**Interfaces:** Produces `validar` aceitando `arestas[].resposta` e `passos[].sentido`; `destaques(passos, i, arestas) -> {nos:Set, arestas:Set, sentido:"ida"|"volta"|null}` (para ref de aresta: nós `de` e `para` + a aresta; `sentido` do passo; para ref de nó: regra atual, `sentido: null`).
- [ ] Testes que falham: `resposta` vazia ou > 40 → erro `arestas[x].resposta`; `sentido:"volta"` em aresta sem resposta → erro `flows[f].passos[n].sentido`; `sentido` em ref de nó → erro; `sentido:"x"` → erro; `destaques` devolve `sentido` correto para ida, volta e nó.
- [ ] Implementar; `npm test` verde; commit `feat: ida e volta (resposta) no modelo e nos destaques`.

### Task 12: Layout horizontal compacto
**Files:** Modify `scripts/lib/layout-fluxo.mjs`, `scripts/gerar.mjs` (default `RIGHT`), `references/gramaticas/fluxo.md`; Create `tests/fixtures/requisicao.json` (11 nós, 4 zonas, cadeia de chamadas com 4 arestas com `resposta`, 1 aresta `retorno`); Test `tests/layout.test.mjs`, `tests/gerar.test.mjs`
- [ ] Testes que falham: CLI sem `--direcao` usa RIGHT; `CARD.largura === 240`; `requisicao.json` em RIGHT → `verificarGeometria == []` e `1 <= largura/altura <= 3`.
- [ ] Implementar (espaçamentos 60/24, card 240; reservar folga para a volta paralela: `edgeEdgeBetweenLayers` ≥ 14); commit `feat: layout horizontal compacto`.

### Task 13: SVG com a volta paralela
**Files:** Modify `scripts/lib/svg.mjs`, `assets/diagrama.css`; Test `tests/svg.test.mjs`
**Interfaces:** cada aresta com `resposta` ganha `<path class="resposta" …>` (mesmos pontos deslocados 6 px para o lado direito do sentido de ida, tracejado, `marker-end` apontando para o `de`) e um `<text class="rotulo-resposta">`; a legenda ganha "resposta" quando usada.
- [ ] Testes que falham: nº de `class="resposta"` = nº de arestas com resposta; rótulo presente e escapado; legenda cita "resposta" só quando usada; orçamento mantido.
- [ ] Implementar; commit `feat: volta da resposta desenhada no SVG`.

### Task 14: Stepper com câmera fixa e bolinha de ida/volta
**Files:** Modify `assets/stepper.js`, `scripts/lib/html.mjs` (se preciso), `tests/html.test.mjs`
**Comportamento:** ao abrir, enquadra o diagrama inteiro; passos não mexem na câmera; passo de aresta acende `de`, `para` e a aresta (`.hl`), escurece o resto; bolinha percorre `path.flow` (ida) ou `path.resposta` invertido (volta, bolinha vazada) por 900 ms em loop; barra "A → B" ou "B ⇠ A · resposta"; tocar 1500 ms; reduced motion sem bolinha.
- [ ] Testes: html contém o intervalo 1500 e o texto "⇠"; teste unitário de `destaques` cobre volta (Task 11). Verificação manual em Chrome: transform da câmera igual antes e depois de ←/→; captura de um passo de volta.
- [ ] Implementar; commit `feat: câmera fixa e bolinha de ida e volta`.

### Task 15: Documentação da skill e exemplos
**Files:** Modify `SKILL.md`, `references/gramaticas/fluxo.md`, `references/modelo.md`, `docs/f0-resultado.md`; regerar `exemplos/*` (RIGHT)
- [ ] Documentar: passo = ligação; `resposta`/`sentido` com exemplo de requisição; direção padrão RIGHT; regerar os 3 exemplos com `--nome` existente e a nova direção; atualizar números; `npm test` verde; commit `docs: requisição viva na skill e exemplos regenerados`.
