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

> **Revisão 2026-11-19:** Tasks 12–15 reescritas depois que o dono escolheu a referência visual
> `docs/referencia-visual/02-agente.svg` (adendo 2: `docs/superpowers/specs/2026-11-18-diagramas-vivos-adendo-2-referencia.md`,
> que prevalece sobre as Global Constraints acima onde conflitar: card 300, 120 entre colunas, 36 entre nós).
> O artefato principal passa a ser o SVG vivo (SMIL, sem JS); câmera fixa e ritmo continuam valendo no HTML.

### Task 12: Modelo (icone, selo, tipo), volta como aresta própria e layout compacto
**Files:** Modify `scripts/lib/modelo.mjs`, `references/modelo.md`, `scripts/lib/layout-fluxo.mjs`, `scripts/gerar.mjs` (padrão `--direcao RIGHT`); Create `tests/fixtures/requisicao.json` (11 nós, 3–4 zonas, cadeia de chamadas com 4 arestas com `resposta`, tipos variados, 1 `selo`); Test `tests/modelo.test.mjs`, `tests/layout.test.mjs`, `tests/gerar.test.mjs`
**Interfaces:** `validar` aceita `nos[].icone` (pessoa|servico|ferramenta|banco|gate|externo|fila|documento|agente), `nos[].selo` (≤ 12 caracteres), `arestas[].tipo` (chamada|rpc|dados|evento|fila); `layoutFluxo` cria, para cada aresta com `resposta`, uma aresta de volta própria no Layout com id `<id>~volta` (de = para original, para = de original), roteada pelo ELK como as outras, com rótulo = resposta; `CARD.largura = 300`; ELK `nodeNodeBetweenLayers 120`, `nodeNode 36`; CLI padrão `RIGHT`.
- [ ] Testes que falham: icone/selo/tipo inválidos dão erro com o caminho; `layoutFluxo(requisicao)` tem uma aresta `x~volta` por aresta com resposta, começando na borda do card `para` original e terminando na do `de`; `verificarGeometria == []`; `1 <= largura/altura <= 3`; CLI sem `--direcao` usa RIGHT.
- [ ] Implementar; `npm test` verde; commit `feat: icone, selo, tipo, volta como aresta e layout compacto`.

### Task 13: SVG no visual da referência
**Files:** Modify `scripts/lib/svg.mjs`, `scripts/lib/cores.mjs`, `assets/tokens.css`, `assets/diagrama.css`; Test `tests/svg.test.mjs`, `tests/cores.test.mjs`
**Alvo:** reproduzir `docs/referencia-visual/02-agente.svg` (adendo 2, itens 7 e 8): tema **claro por padrão** (`#f3f3f1` + grade de pontos 24 px), cards brancos raio 20 com sombra, ladrilho de ícone 30×30 (cor por ícone/papel; gate vermelho), selo em pílula, portas r 3,4 nas pontas, rótulo em pílula com fundo, cor da aresta pelo `tipo`, `~volta`/`retorno`/`falha` tracejados com chevron na chegada, legenda por tipo + retorno + proposto; tema escuro continua disponível (`tema:"escuro"`). Contraste AA testado.
- [ ] Testes: tema padrão claro (fundo `#f3f3f1` e `pattern` da grade); um ladrilho de ícone por nó; selo renderizado e escapado; cor do traço = cor do `tipo`; `~volta` com classe `ret`; legenda só com tipos usados; orçamento.
- [ ] Implementar (ícones como `path` em traço 30×30, como na referência); commit `feat: SVG no visual da referência`.

### Task 14: Cenários vivos no SVG (SMIL) e HTML com câmera fixa
**Files:** Modify `scripts/lib/svg.mjs`, `assets/stepper.js`, `scripts/lib/html.mjs`; Test `tests/svg.test.mjs`, `tests/html.test.mjs`
**Comportamento (adendo 2, itens 1–6):** para cada flow, em ordem, cada passo de aresta (ida) ou volta (`sentido:"volta"` → aresta `~volta`) vira um `animateMotion` com `mpath` para o path da aresta, ids `m1..mN`, `begin` encadeado (`mK.end+0.25s`; entre flows `+1.1s`; o primeiro `0.5s;mN.end+1.1s` para repetir), `dur` = max(0,3 s, comprimento/120 × 0,38 s); `.token` visível só durante o salto; contorno do card de chegada pisca 0,7 s; `.flow` da aresta visível só enquanto o flow dela toca; passo que é nó só pisca o card; rodapé com uma linha por flow ("N. Título: A → B → …") forte enquanto toca; `prefers-reduced-motion`: sem token e sem `.flow`. HTML: mesmo SVG; câmera enquadra tudo e não se move entre passos; no passo a passo os tokens SMIL ficam ocultos e o stepper destaca A, B e a aresta; tocar 1500 ms; barra "A → B" ou "B ⇠ A · resposta".
- [ ] Testes: nº de `animateMotion` = nº de passos de aresta; `begin` do primeiro contém `0.5s;` e referencia o último; cada `mpath` aponta para um path existente; uma linha de rodapé por flow; html contém 1500 e "⇠"; verificação em Chrome: duas capturas em instantes diferentes mostram a bolinha em lugares diferentes.
- [ ] Implementar; commit `feat: cenários vivos no SVG e câmera fixa no HTML`.

### Task 15: Documentação e exemplos
**Files:** `SKILL.md`, `references/gramaticas/fluxo.md`, `references/modelo.md`, `docs/f0-resultado.md`, `README.md`, `exemplos/*` (regenerar em RIGHT)
- [ ] Documentar o SVG vivo como entregável principal, flows como cenários de requisição, `tipo`/`icone`/`selo`/`resposta`/`sentido` com um exemplo completo de requisição; regerar os 3 exemplos; `npm test` verde; commit `docs: requisição viva e exemplos regenerados`.
