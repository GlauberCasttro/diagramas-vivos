# diagramas-vivos — F0 (spike + skill instalada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar diagramas da gramática **fluxo** a partir de um `diagram.json`, com layout ELK feito na geração, saindo como SVG animado + HTML com passo a passo no visual do floorplan, verificados por script, e medir o critério de GO/NO-GO da F0 com os 3 fixtures da `diagramas-legais`.

**Architecture:** Pipeline em Node ESM: `diagram.json` → validação → medição de texto (fontkit, fontes reais) → layout (elkjs em Node; ramo B: posições do ELK + rotas do libavoid) → verificação de geometria → emissão SVG (sem JS) e HTML (SVG inline + stepper) → captura por passo com Chrome headless. O modelo (Claude) só escreve o `diagram.json`; scripts fazem o resto.

**Tech Stack:** Node ≥ 18 (ESM, `node:test`), `elkjs@0.9.3`, `fontkit@2.0.4`, `libavoid-js@0.5.0-beta.5` (só ramo B), Python 3 + Google Chrome headless (captura).

**Spec:** `docs/superpowers/specs/2026-11-18-diagramas-vivos-design.md` (§7.2 modelo, §7.4 visual, §7.5 flow vivo, §7.6 artefatos, §7.7 verificação, §7.9 instalação, §8 linha F0).

Fases F1–F6 ficam para planos próprios, escritos depois do resultado desta F0 (o resultado decide o roteador usado daqui em diante).

## Global Constraints

- Repositório: `~/Repositorios/diagramas-vivos` (raiz = raiz da skill). Instalação: symlink `~/.claude/skills/diagramas-vivos` → repositório.
- Artefatos offline e autocontidos: nenhum `http(s)://` em `src`/`href`/`url()` do SVG ou do HTML.
- SVG sem JS e **sem `foreignObject`**; texto em `<text>`/`<tspan>` com quebra calculada na geração.
- Orçamento: **SVG < 150 KB**, **HTML < 300 KB** (bytes do arquivo).
- Tema escuro por padrão; tema claro disponível no HTML. Contraste de texto dos papéis **≥ 4.5:1** nos dois temas.
- `prefers-reduced-motion: reduce` desliga toda animação contínua em qualquer tela.
- Papéis de nó: `feliz | gate | memoria | neutro | externo`. Papéis de aresta: `sequencia | feliz | retorno | falha`. `nivel`: `informado` (padrão, sem marca) | `proposto` (tracejado + selo).
- Em repouso só correm as arestas do **caminho feliz do primeiro flow**; no passo a passo, as do passo atual.
- Todo diagrama tem ≥ 1 flow com ≥ 2 passos; todo `ref` de passo existe.
- Trechos derivados do floorplan levam cabeçalho `Portions derived from floorplan (MIT) (c) 2026 Hayden Smith`; `NOTICE` lista floorplan (MIT), Inter e JetBrains Mono (OFL 1.1), elkjs (EPL-2.0, só nos scripts), libavoid-js (LGPL-2.1+, só nos scripts).
- Nome de saída: `NN-slug.{svg,html,diagram.json}`, `NN` = sequência do projeto com 2 dígitos (3 a partir de 100).
- **Decisão deste plano:** na F0 as fontes entram como os woff2 `latin` do floorplan, inteiros (Inter 48 KB + JetBrains Mono 40 KB), sem subset por diagrama. Se o SVG estourar 150 KB, o subset entra no plano da F1. Caracteres fora da cobertura `latin` (ex.: `→` U+2192) geram **aviso** na verificação.

## Review Focus

1. **Nome ou descrição longos demais para o card** → quebra em no máximo 2 linhas (nome) / 3 linhas (descrição) com reticências; nada vaza do card. Teste na Task 2 e na Task 5.
2. **Texto em português com acentos e símbolos** (ç, ã, é, —, →) → acentos e travessão renderizam com a fonte embutida; `→` aparece como aviso de cobertura. Teste na Task 2.
3. **Passo de flow que aponta para nó/aresta inexistente, ou flow com 1 passo** → validação falha com mensagem que cita o `id` do flow e o `ref`; nunca se inventa caminho. Teste na Task 1.
4. **Aresta de retorno (para trás) e laço** → rota ortogonal sem atravessar card nem sobrepor outra aresta. Teste na Task 3 com o fixture de deploy.
5. **HTML aberto via `file://`, sem rede e com redução de movimento** → nada animado em repouso, stepper funciona por teclado e por `#passo=N`. Teste na Task 6.

---

## File Structure

```
package.json                 deps fixas, "type":"module", script test
NOTICE
SKILL.md                     processo da F0 (só gramática fluxo)
references/modelo.md         schema do diagram.json (F0: campos comuns + fluxo)
references/gramaticas/fluxo.md
assets/fonts/                woff2 latin + licenças (copiados do floorplan)
assets/tokens.css            tokens do floorplan + papéis
assets/diagrama.css          card, aresta, seta, rótulo, legenda, animação, reduced-motion
assets/stepper.js            passo a passo do HTML
assets/template.html         casca do HTML com marcadores
scripts/lib/modelo.mjs       validar()
scripts/lib/texto.mjs        fontes, medir(), quebrar(), cobertura()
scripts/lib/layout-fluxo.mjs layoutFluxo()
scripts/lib/geometria.mjs    verificarGeometria()
scripts/lib/rota-libavoid.mjs rotearLibavoid()
scripts/lib/svg.mjs          emitirSvg()
scripts/lib/html.mjs         emitirHtml()
scripts/lib/cores.mjs        contraste()
scripts/gerar.mjs            CLI
scripts/render_check.py      captura SVG + passos do HTML
exemplos/{deploy,fluxo-card,skill}/diagram.json  (+ saídas geradas)
tests/*.test.mjs
docs/f0-resultado.md         medição e decisão GO/NO-GO
```

---

### Task 1: Esqueleto do projeto e validação do modelo

**Files:**
- Create: `package.json`, `NOTICE`, `.gitignore` (já existe: acrescentar `out/`), `assets/fonts/*` (copiar de `~/.claude/skills/floorplan/assets/vendor/fonts/`: `inter-latin-wght-normal.woff2`, `jetbrains-mono-latin-wght-normal.woff2`, `inter-LICENSE.txt`, `jetbrains-mono-LICENSE.txt`), `references/modelo.md`, `scripts/lib/modelo.mjs`
- Test: `tests/modelo.test.mjs`, `tests/fixtures/minimo.json`

**Interfaces:**
- Produces: `validar(diagrama: object) -> { ok: boolean, erros: string[] }` em `scripts/lib/modelo.mjs`. Formato do `diagram.json` (F0):
  `{ versao: 1, tipo: number, gramatica: "fluxo", titulo, subtitulo?, zonas?: [{id, nome}], nos: [{id, nome, descricao?, papel, zona?, nivel?}], arestas: [{id, de, para, rotulo?, papel, nivel?}], flows: [{id, titulo, passos: [{ref, nota}]}] }`

- [ ] **Step 1: Escrever `package.json`** com `"name":"diagramas-vivos"`, `"type":"module"`, `"engines":{"node":">=18"}`, deps exatas `elkjs 0.9.3`, `fontkit 2.0.4`, `libavoid-js 0.5.0-beta.5`, script `"test":"node --test tests/"`. Rodar `npm install` e conferir `package-lock.json`.
- [ ] **Step 2: Escrever o teste que falha** `tests/modelo.test.mjs`:
  - `minimo.json` (2 nós `a`,`b`, aresta `a-b` papel `feliz`, flow `f1` com passos `a`,`a-b`) → `{ok:true, erros:[]}`
  - papel de nó `"verde"` → erro contém `nos[a].papel`
  - aresta `para:"z"` inexistente → erro contém `arestas[a-b].para: z`
  - flow com 1 passo → erro contém `flows[f1]: mínimo 2 passos`
  - passo `ref:"x"` inexistente → erro contém `flows[f1].passos[1].ref: x`
  - sem `flows` → erro contém `flows: mínimo 1`
  - ids duplicados entre nós e arestas → erro contém `id duplicado: a`
  - `nivel:"inferido"` → erro (F0 aceita só `informado|proposto`)
- [ ] **Step 3: Rodar** `node --test tests/modelo.test.mjs` → FAIL (`validar` não existe).
- [ ] **Step 4: Implementar `validar`** em `scripts/lib/modelo.mjs` sem dependências (checagem manual de campos; coletar todos os erros, não parar no primeiro). Documentar o formato em `references/modelo.md`.
- [ ] **Step 5: Rodar** `npm test` → PASS.
- [ ] **Step 6: Escrever `NOTICE`** (texto do Global Constraints com os 4 componentes e licenças) e commit:
  `git add -A && git commit -m "feat: esqueleto e validação do diagram.json"`

### Task 2: Medição e quebra de texto com as fontes reais

**Files:**
- Create: `scripts/lib/texto.mjs`
- Test: `tests/texto.test.mjs`

**Interfaces:**
- Produces:
  - `carregarFontes(dirFontes: string) -> Promise<Fontes>` (Inter e JetBrains Mono via `fontkit.openSync`)
  - `medir(fontes, texto: string, estilo: {familia: "sans"|"mono", peso: number, tamanho: number}) -> number` (largura em px; usa `font.getVariation({wght: peso})`)
  - `quebrar(fontes, texto, estilo, larguraMax: number, maxLinhas: number) -> string[]` (quebra por palavra; última linha com `…` se cortar)
  - `cobertura(fontes, textos: string[]) -> string[]` (caracteres sem glifo, únicos)
  - Estilos fixos exportados como `ESTILO = { nome: {familia:"sans",peso:600,tamanho:15}, descricao: {familia:"sans",peso:400,tamanho:13}, rotulo: {familia:"sans",peso:500,tamanho:12}, titulo: {familia:"sans",peso:700,tamanho:22}, zona: {familia:"sans",peso:600,tamanho:14} }` (nome e descrição = card do floorplan, `viewer.html:174,182`)

- [ ] **Step 1: Teste que falha** `tests/texto.test.mjs`:
  - `medir("Build", ESTILO.nome) > 0` e `medir("WWWW") > medir("iiii")` no mesmo estilo
  - peso 700 mede mais que peso 400 para `"Aprovação manual"`
  - `quebrar("Verificação de integridade do pipeline de entrega contínua", ESTILO.nome, 180, 2)` → 2 linhas, cada uma com `medir ≤ 180`, última termina com `…`
  - `quebrar("Build", ESTILO.nome, 180, 2)` → `["Build"]`
  - `cobertura(["ação — ok"])` → `[]`; `cobertura(["sim → não"])` → `["→"]`
- [ ] **Step 2:** `node --test tests/texto.test.mjs` → FAIL.
- [ ] **Step 3: Implementar** em `scripts/lib/texto.mjs` (fontkit `layout(texto).advanceWidth * tamanho / unitsPerEm`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: medição e quebra de texto com Inter e JetBrains Mono`

### Task 3: Layout da gramática fluxo com ELK e verificador de geometria

**Files:**
- Create: `scripts/lib/layout-fluxo.mjs`, `scripts/lib/geometria.mjs` (funções `segmentDistance`/`segmentHitsRect` portadas de `~/.claude/skills/diagramas-legais/scripts/route_edges.mjs:84-130`, com nota de origem)
- Test: `tests/layout.test.mjs`, `tests/fixtures/retorno.json` (5 nós em sequência + 1 aresta `retorno` do 4º para o 2º + 2 zonas)

**Interfaces:**
- Consumes: `validar` (Task 1), `carregarFontes/quebrar/ESTILO` (Task 2)
- Produces:
  - `layoutFluxo(diagrama, fontes, opcoes?: {direcao?: "RIGHT"|"DOWN"}) -> Promise<Layout>`
  - `Layout = { largura, altura, cabecalho: {y, altura}, legenda: {y, altura}, zonas: [{id, nome, x, y, w, h}], nos: [{id, x, y, w, h, linhasNome: string[], linhasDescricao: string[]}], arestas: [{id, pontos: [x,y][], rotulo?: {x, y, linhas: string[]}}] }` (coordenadas absolutas, já incluindo cabeçalho no topo e legenda no rodapé)
  - `verificarGeometria(layout) -> [{tipo: "diagonal"|"atravessa-no"|"sobreposicao"|"rotulo-colide", aresta: string, alvo?: string}]`
- Valores: card largura **260** (descrição em 3 linhas) altura = 20 + 22·linhasNome + 19·linhasDescricao + 20 (mínimo 72); ELK `algorithm: layered`, `edgeRouting: ORTHOGONAL`, `hierarchyHandling: INCLUDE_CHILDREN` (zonas = nós compostos), espaçamentos de `viewer.html:1036-1041` (`nodeNodeBetweenLayers 130`, `nodeNode 32`, `edgeEdgeBetweenLayers 8`, `edgeNode 24`), rótulos de aresta como `labels` do ELK com largura medida (`ESTILO.rotulo`).

- [ ] **Step 1: Teste que falha** `tests/layout.test.mjs`:
  - `minimo.json` → 2 nós sem sobreposição, 1 aresta com ≥ 2 pontos, todos os pontos dentro de `largura×altura`
  - `retorno.json` → `verificarGeometria(layout)` é `[]`; a aresta de retorno tem ≥ 3 pontos; cada nó está dentro do retângulo da sua zona
  - todo segmento de toda aresta é horizontal ou vertical
  - `verificarGeometria` de um layout montado à mão com aresta diagonal → contém `{tipo:"diagonal"}`; com segmento cruzando um nó → `{tipo:"atravessa-no"}`
- [ ] **Step 2:** `node --test tests/layout.test.mjs` → FAIL.
- [ ] **Step 3: Implementar** `layoutFluxo` (monta grafo ELK, roda `new ELK().layout`, converte `sections` em `pontos` absolutos somando offsets de pais) e `verificarGeometria`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: layout fluxo com ELK e verificador de geometria`

### Task 4: Ramo B — rotas do libavoid sobre posições do ELK

**Files:**
- Create: `scripts/lib/rota-libavoid.mjs` (adaptado de `~/.claude/skills/diagramas-legais/scripts/route_edges.mjs`, com nota de origem)
- Test: `tests/rota-libavoid.test.mjs`

**Interfaces:**
- Consumes: `Layout` (Task 3), `verificarGeometria` (Task 3)
- Produces: `rotearLibavoid(layout, diagrama) -> Promise<Layout>` (mesmas posições de nós/zonas; só `arestas[].pontos` recalculados; rótulos reposicionados no ponto médio do maior segmento)

- [ ] **Step 1: Teste que falha:** para `retorno.json`, `rotearLibavoid(await layoutFluxo(...))` mantém `nos` idênticos, todas as arestas ortogonais e `verificarGeometria` = `[]`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** reaproveitando `chooseSides`, `makePort` e o roteamento do arquivo original.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: ramo B de roteamento com libavoid`

### Task 5: Emissão do SVG animado no visual do floorplan

**Files:**
- Create: `assets/tokens.css` (copiar `~/.claude/skills/floorplan/assets/viewer.html:33-93` escuro e `:66-90` claro, cabeçalho MIT; remover `--k-*`, `--n-*`, `--m-*`; acrescentar papéis), `assets/diagrama.css` (card de `viewer.html:157-216` traduzido para SVG: retângulo raio 20, fundo `--surface`, borda `--hair-2`, sombra; arestas: `.trace` + `.flow` de `viewer.html:226-234`; marcadores de seta; rótulo; legenda; `@media (prefers-reduced-motion: reduce) { * { animation: none !important } }`), `scripts/lib/cores.mjs`, `scripts/lib/svg.mjs`
- Test: `tests/svg.test.mjs`, `tests/cores.test.mjs`

**Interfaces:**
- Consumes: `Layout` (Tasks 3/4), `carregarFontes` (Task 2)
- Produces:
  - `contraste(corA: string, corB: string) -> number` (razão WCAG)
  - `PAPEIS = { escuro: {fundo, feliz, gate, memoria, neutro, externo}, claro: {...} }` exportado de `cores.mjs`. Escuro: fundo `#0f0f0f`, feliz `#6fd7a8`, gate `#f28b8b`, memoria `#7aa7ff`, neutro `#b4b4b4`, externo `#e3a6f0` (todos tokens do floorplan). Claro: fundo do `:root[data-theme="light"]` do floorplan; cores escolhidas pelo implementador com o teste de contraste.
  - `emitirSvg(diagrama, layout, fontes, opcoes?: {tema?: "escuro"|"claro", animar?: boolean}) -> string`
- Regras: cada nó vira `<g class="no papel-X" data-id>`; cada aresta `<g class="aresta papel-X" data-id>` com `path.trace`, `path.flow` e `marker-end`; arestas do caminho feliz do primeiro flow (arestas `papel: feliz` referenciadas nos passos do primeiro flow) recebem classe `corre`; `retorno`/`falha` tracejadas; `nivel:"proposto"` = contorno tracejado + selo "proposto"; fontes woff2 embutidas em `@font-face` base64 dentro de `<style>`; legenda derivada só dos papéis/estilos usados; cabeçalho com título e subtítulo; rodapé com `tipo` do catálogo.

- [ ] **Step 1: Testes que falham:**
  - `cores.test.mjs`: para cada tema e papel, `contraste(papel, fundo) >= 4.5`
  - `svg.test.mjs` (com `minimo.json` e `retorno.json`): resultado começa com `<svg`, contém `@font-face`, não contém `foreignObject`, `<script`, `http://`, `https://`; número de `class="no ` = nº de nós; número de `class="aresta ` = nº de arestas; só arestas do caminho feliz do 1º flow têm `corre`; contém `prefers-reduced-motion`; legenda de `minimo.json` cita "caminho feliz" e **não** cita "gate"; `Buffer.byteLength < 150*1024`
  - nome com 60 caracteres produz no máximo 2 `<tspan>` de nome no card
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** `cores.mjs` e `svg.mjs` (strings de template; escapar `& < > "` em todo texto vindo do modelo).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: emissão de SVG animado no visual do floorplan`

### Task 6: HTML com passo a passo

**Files:**
- Create: `assets/template.html` (marcadores `/*__TOKENS__*/`, `/*__CSS__*/`, `<!--__SVG__-->`, `/*__DADOS__*/`, `/*__STEPPER__*/`; script de tema adaptado de `viewer.html:6-27` com chave `diagramas-vivos-tema`), `assets/stepper.js`, `scripts/lib/html.mjs`
- Test: `tests/html.test.mjs`

**Interfaces:**
- Consumes: `emitirSvg` (Task 5)
- Produces: `emitirHtml(diagrama, layout, svg: string) -> string`
- Comportamento do stepper (`assets/stepper.js`, sem dependências): barra no estilo de `viewer.html:289-297` com título do flow, "passo i de n", nota (até 3 linhas), pontos de progresso, botões anterior/próximo/tocar/sair; teclas `←` `→` `Esc` `Espaço` (tocar/pausar, 3 s por passo); passo atual: nós/arestas do `ref` recebem `.hl`, o resto `.dim`; se o `ref` é nó, a câmera centraliza e aproxima o nó (zoom 1.4, transição 0.5 s); se é aresta, enquadra a aresta com folga 80 px; ponto percorrendo a aresta do passo via `animateMotion`; pan com arraste e zoom com roda; `#passo=N` abre direto no passo N (1-based) sem transição; botão de tema (auto/claro/escuro). Com `prefers-reduced-motion`: sem `animateMotion`, sem transição, sem "tocar".

- [ ] **Step 1: Teste que falha** `tests/html.test.mjs`: resultado contém o SVG inteiro, o JSON dos flows, o stepper; não contém `http://`/`https://`; `Buffer.byteLength < 300*1024`; contém `prefers-reduced-motion`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** `html.mjs` (substituição de marcadores, escapando `</script` no JSON) e `stepper.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Verificação manual no navegador:** gerar `minimo.json` (Task 7 ainda não existe: chamar as funções num `node -e` curto), abrir via `file://`, conferir ←/→/Esc, `#passo=2`, troca de tema e, com "Reduzir movimento" ligado no macOS, nenhuma animação.
- [ ] **Step 6: Commit** `feat: HTML com passo a passo guiado`

### Task 7: CLI `gerar.mjs`

**Files:**
- Create: `scripts/gerar.mjs`
- Test: `tests/gerar.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–6
- Produces: `node scripts/gerar.mjs <diagram.json> --saida <dir> [--roteador elk|libavoid] [--nome NN-slug]`
  - sem `--nome`: `NN` = maior prefixo numérico em `<dir>` + 1 (2 dígitos; 3 a partir de 100), `slug` do título (minúsculas, sem acento, hífens)
  - escreve `NN-slug.svg`, `NN-slug.html`, `NN-slug.diagram.json`
  - imprime JSON `{arquivos: {svg, html, modelo}, bytes: {svg, html}, violacoes: [], avisos: [], roteador}`
  - códigos de saída: `0` ok; `1` modelo inválido (nada escrito); `2` violações de geometria ou orçamento estourado (arquivos escritos, para inspeção)

- [ ] **Step 1: Teste que falha** (com `child_process.execFileSync` num diretório temporário): `minimo.json` → exit 0 e três arquivos `01-*`; segunda execução cria `02-*`; `--nome 07-teste` sobrescreve `07-teste.*`; modelo inválido → exit 1 e diretório vazio; texto com `→` → `avisos` contém `→`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: CLI gerar`

### Task 8: Captura por passo (`render_check.py`)

**Files:**
- Create: `scripts/render_check.py` (base: `~/.claude/skills/diagramas-legais/scripts/render_check.py`, só a parte de Chrome headless)
- Test: `tests/render_check.test.mjs`

**Interfaces:**
- Consumes: saídas da Task 7
- Produces: `python3 scripts/render_check.py <NN-slug.html> [--saida <dir>]` → captura `svg-escuro.png`, `svg-claro.png` e `passo-01.png … passo-NN.png` (todos os passos de todos os flows, em sequência, via `#passo=N`, nos temas escuro e claro como `passo-NN-escuro.png`/`passo-NN-claro.png`, viewport 1600×1000, escala 2); imprime a lista de arquivos; exit 1 se o Chrome não for encontrado (mensagem diz onde procurou).

- [ ] **Step 1: Teste que falha:** gera `minimo.json`, roda o script, espera exit 0 e `2 + 2 × nº de passos` PNGs não vazios.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** (`--headless --screenshot --window-size --force-device-scale-factor=2 --virtual-time-budget=1500`; caminho do Chrome do macOS e `google-chrome`/`chromium` no PATH).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: captura de cada passo do flow`

### Task 9: Os 3 fixtures e o resultado da F0

**Files:**
- Create: `exemplos/deploy/diagram.json`, `exemplos/fluxo-card/diagram.json`, `exemplos/skill/diagram.json`, `docs/f0-resultado.md`, `tests/exemplos.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–8

- [ ] **Step 1: Escrever os 3 `diagram.json`** com o conteúdo dos SVGs de `~/.claude/skills/diagramas-legais/assets/exemplos/` (`exemplo-deploy-aprovacao.svg`, `exemplo-fluxo-setas.svg`, `exemplo-skill-diagramas.svg`): mesmas zonas, nós (nome = linha em negrito, descrição = linha de baixo), arestas e rótulos; papéis pela cor original (verde = `feliz`, contorno vermelho = `gate`, azul = `memoria`, tracejado vermelho = `retorno`); 1 flow por exemplo com o caminho principal e uma nota por passo.
- [ ] **Step 2: Teste** `tests/exemplos.test.mjs`: cada exemplo é válido e gera com `--roteador elk` sem violações e dentro do orçamento.
- [ ] **Step 3: Rodar** `npm test`. Se algum exemplo falhar com ELK, rodar com `--roteador libavoid` e registrar (é o critério da F0, não um bug a esconder).
- [ ] **Step 4: Gerar as saídas** em `exemplos/<nome>/` e rodar `render_check.py` em cada uma; olhar as imagens procurando texto vazando, nota cobrindo nó e seta sobre rótulo; corrigir e repetir até limpo.
- [ ] **Step 5: Escrever `docs/f0-resultado.md`:** por exemplo, violações com ELK e com libavoid, bytes de SVG e HTML, avisos de cobertura, e a decisão: **GO com ELK**, **GO com ramo B** (ELK + libavoid) ou **NO-GO** (os dois com violação), conforme spec §8.
- [ ] **Step 6: Commit** `feat: fixtures da F0 e resultado`

### Task 10: SKILL.md, instalação e publicação

**Files:**
- Create: `SKILL.md`, `references/gramaticas/fluxo.md`
- Modify: `README.md` (estado: F0; como usar)

- [ ] **Step 1: Escrever `SKILL.md`** com frontmatter `name: diagramas-vivos` e `description` que **só dispara** com `/diagramas-vivos` ou pedido de diagrama "vivo", "animado", "com flow" ou "passo a passo" (spec §1, Convivência). Corpo: (1) entender o pedido e decidir zonas, papéis e flow; (2) escrever `diagram.json` conforme `references/modelo.md` e `references/gramaticas/fluxo.md`; (3) `node scripts/gerar.mjs … --saida docs/diagramas` com o roteador decidido em `docs/f0-resultado.md`; (4) exit 1 → corrigir modelo; exit 2 → ajustar e repetir; (5) `render_check.py` e olhar as imagens; (6) entregar SVG e HTML dizendo qual abrir. Nesta fase só a gramática fluxo: para outro tipo, dizer que chega na F1+ e oferecer fluxo.
- [ ] **Step 2: Instalar:** `ln -s ~/Repositorios/diagramas-vivos ~/.claude/skills/diagramas-vivos` (antes, conferir que o destino não existe) e `npm install` no repositório.
- [ ] **Step 3: Teste de fumaça como usuário:** numa sessão nova do Claude Code, pedir `/diagramas-vivos fluxo de deploy com aprovação manual`; esperado: SVG + HTML em `docs/diagramas/` do diretório atual, verificação limpa.
- [ ] **Step 4: Commit e publicar:** `git add -A && git commit -m "feat: SKILL.md da F0 e instalação"` e `git push`.
