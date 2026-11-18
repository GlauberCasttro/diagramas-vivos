# diagramas-vivos — design

Data: 2026-11-18 · Autor: Claude (com o dono) · Estado: aprovado pelo dono em 2026-11-18
Anexos: `2026-11-18-diagramas-vivos-catalogo.json` (os 245 tipos mapeados em 12 gramáticas,
com categoria) e `2026-11-18-diagramas-vivos-catalogo-original.txt` (a lista do dono).

## 1. Intenção e porquê

Uma **skill nova**, `~/.claude/skills/diagramas-vivos`, nascida da `diagramas-legais`.
A `diagramas-legais` gera um SVG estático no "padrão swarm" (fundo branco, zonas
tracejadas, setas ortogonais com libavoid); o dono acha o visual feio e quer diagramas com
**flow vivo**: o mesmo movimento e o mesmo passo a passo guiado do floorplan
(`~/.claude/skills/floorplan`, MIT, Hayden Smith).

A nova skill não é "um desenhista de fluxo": cobre **todo o catálogo de 245 tipos de
diagrama de engenharia** que o dono listou (fluxo, arquitetura, processos, OO, dados,
infra, integração, segurança, estados, testes, requisitos, agentes de IA, planejamento).

**Convivência.** Não se mexe na `diagramas-legais` (local nem cópia da conta) nem na
`universal-diagram-engineering` (outro experimento do dono, na conta). Como as três
respondem a pedidos de diagrama, a `diagramas-vivos` **só dispara quando chamada pelo
nome** (`/diagramas-vivos`) **ou quando o pedido fala em diagrama vivo, animado, com flow
ou passo a passo**, para não roubar os pedidos genéricos dos outros testes do dono
*(decisão do Claude)*.

## 2. Decisões do dono (não reabrir)

1. Gera **todos os 245 tipos** do catálogo, com a numeração dele (fixa).
2. Entrada nesta fase: **o que o usuário descreve**. Ler código fica para uma fase futura.
3. **Todo diagrama tem flow vivo.**
4. Visual = **o mesmo design do floorplan** (tokens, cards nome + descrição, Inter /
   JetBrains Mono, tema escuro padrão e claro, arestas com tracejado que corre, passo a
   passo com nota).
5. Ao acionar, a skill **recomenda** um tipo (com o motivo) + 2 alternativas + "ver
   catálogo"; número ou nome digitado funciona; se o pedido já nomeia o tipo, gera direto.
6. Semântica de cor mantida: verde = caminho feliz, vermelho = gate/falha/retorno,
   azul = memória/estado.
7. Diagramas **sem setas** (matriz, pirâmide, story map…): o flow vivo é o passo a passo que
   acende linha/célula/bloco; não se inventam setas.
8. **Notações formais** (BPMN, UML, ERD, C4) usam os **símbolos normativos de verdade**,
   com o acabamento do floorplan.
9. Os **SVGs antigos** da `diagramas-legais` não são migrados; ela continua existindo como
   está.
10. É uma **skill nova com outro nome**; `diagramas-legais` e
    `universal-diagram-engineering` não são tocadas.

## 3. Metas, não-metas, anti-metas

**Metas**
- Cobrir os 245 tipos, agrupados em 12 gramáticas de layout.
- Cada diagrama sai em dois artefatos: **SVG animado** (aparece inline em PR, README e wiki)
  e **HTML com passo a passo** (explorar, apresentar).
- Visual indistinguível do floorplan para quem conhece o floorplan.
- Verificação mecânica antes de entregar, como hoje (nada de "confia que ficou bom").

**Não-metas (nesta fase)**
- Gerar diagramas a partir do código (code-to-diagram), sincronização, drift, comparação
  entre commits. O modelo intermediário já prevê isso, mas não se implementa agora.
- Editor visual / arrastar nós.
- Exportar para PlantUML, Structurizr, draw.io, Excalidraw, BPMN XML.

**Anti-metas (seria fracasso mesmo funcionando)**
- Diagrama bonito e **semanticamente errado** (setas inventadas, símbolo UML trocado,
  sequência desenhada como fluxograma).
- 245 presets rasos que geram saídas indistinguíveis entre tipos parecidos.
- HTML de megabytes por diagrama, ou layout que só se conhece quando o leitor abre.
- Fork do visualizador do floorplan que diverge e ninguém mantém.

## 4. Restrições

- Roda como skill do Claude Code: scripts em Node (≥18) e Python 3 dentro da skill.
- Artefatos gerados são **offline e autocontidos** (sem CDN).
- Licenças: trechos derivados do floorplan levam o aviso MIT; fontes Inter e JetBrains
  Mono são OFL (aviso junto); o ELK (EPL-2.0) **roda só na geração** e não vai dentro dos
  artefatos.
- Movimento respeita `prefers-reduced-motion` em qualquer tela.
- Contraste AA para texto nos dois temas.

## 5. Abordagens consideradas

| | Abordagem | Por que não / por que sim |
|---|---|---|
| A | Usar o visualizador do floorplan como motor (gerar `graph.json` do floorplan) | Rejeitada. O visualizador é um app de mapa de código (drill-down, Ask, servidor, health); não sabe sequência, tempo, ER, raias nem matriz — mais da metade do catálogo. Fica acoplada a cada mudança do floorplan. |
| C | Mermaid com pele do floorplan | Rejeitada. Layout do Mermaid não se controla, restyling profundo é frágil, cards nome + descrição não cabem, símbolos e flow ficam "parecidos", não iguais. |
| **B** | **Renderizador próprio herdando o design do floorplan** | **Escolhida pelo dono.** Única que entrega os 245 tipos, flow vivo em todos e o mesmo design. |

Refinamentos da B que saíram da revisão com subagentes (mapeamento dos 245, auditoria do
visualizador do floorplan, crítica adversarial) e entram neste design:
- **Layout na geração, não no navegador.** O ELK roda em Node na hora de gerar; o artefato
  carrega coordenadas prontas. Elimina ~1,6 MB de ELK por arquivo, deixa o layout
  verificável antes da entrega e determinístico.
- **Extrair peças, não copiar o app.** Do `viewer.html` (2,4 mil linhas) aproveitam-se só
  ~25%: tokens, card, animação da aresta, pan/zoom, estilo da barra do flow. O stepper é
  escrito do zero, pequeno.
- **SVG + HTML.** PR do GitHub/Azure DevOps não mostra HTML; SVG com animação CSS aparece.
- **Catálogo como dados**, com sinônimos marcados e golden só para formas distintas.

## 6. Como funciona para quem usa

```
/diagramas-vivos fluxo de aprovação de PR do harness

Recomendo o 51 · Swimlane — o trabalho muda de mãos quatro vezes
(PO → dev → reviewer → qa), e as raias mostram de quem é cada passo.
Também serviriam: 161 · Máquina de estados (estados da task) e
5 · Sequência (mensagens entre agentes).

[1] Gerar o 51  [2] Gerar o 161  [3] Gerar o 5  [4] Ver o catálogo
```

- **Recomendação**: 1 tipo + motivo em uma frase + 2 alternativas que **obrigatoriamente
  vêm de gramáticas diferentes** da recomendada (o erro caro é errar a gramática, ex.:
  sequência × fluxo; não o sinônimo).
- **Tipo nomeado** ("diagrama de sequência do login", "o 161"): gera direto. Palavras
  ambíguas sozinhas ("fluxo", "estados", "arquitetura") **não** contam como nomear.
- **Catálogo**: 13 categorias com contagem → lista numerada da categoria → escolha. Número ou
  nome digitado funciona em qualquer ponto.
- **Pedido vago** ("faz um diagrama"): uma pergunta sobre o conteúdo antes de recomendar.
- Usa a ferramenta de pergunta com opções do Claude Code (limite de 4 opções por pergunta,
  por isso os dois níveis).
- **Sem diálogo** (chamada por outro agente, ou sem a ferramenta de pergunta): a skill
  segue com a recomendação e escreve no início da resposta qual tipo escolheu e por quê.
  Nunca recusa *(decisão do Claude)*.
- **Tipo de gramática ainda não pronta** (durante as fases): com diálogo, avisa e oferece a
  melhor alternativa pronta; sem diálogo, gera a melhor alternativa pronta e diz isso.
  O legado SVG não é usado como fallback *(decisão do Claude)*.

Depois da escolha a skill escreve o `diagram.json`, gera, verifica e entrega os dois
arquivos, dizendo onde estão e qual abrir.

## 7. Arquitetura

```
pedido → [1 recomendação] → tipo escolhido (preset)
       → [2 modelagem]   → diagram.json            (o modelo escreve)
       → [3 layout]      → layout.json             (script: ELK em Node ou layout próprio)
       → [4 emissão]     → NN-slug.svg  +  NN-slug.html  (+ .mmd quando houver)
       → [5 verificação] → relatório; falhou → volta ao 2 ou 3
```

Divisão de trabalho: **o modelo decide conteúdo e significado** (que nós, que papel, que
flow, que notas). **Scripts fazem layout, desenho e verificação.** O modelo nunca escreve
coordenadas nem SVG à mão.

### 7.1 Catálogo — `references/presets.json`

Fontes: o anexo `2026-11-18-diagramas-vivos-catalogo.json` (já traz `n`, `nome`, `categoria`, `gramatica`, `preset`,
`alias_de` para os 245) e a lista original do dono em `2026-11-18-diagramas-vivos-catalogo-original.txt` (as 13
categorias com seus intervalos exatos). Os campos `notacao_formal`, `keywords`, `tier` e
`fase` **não existem ainda**: preenchê-los é a primeira tarefa da F1, por script onde der
(fase sai da gramática; tier B = os 32 aliases) e à mão no resto, com **revisão do dono
antes de seguir** *(decisão do Claude)*.

Classificados por julgamento, com a alternativa a revisar nessa mesma tarefa: 18 navegação
(estados ↔ fluxo), 26/27 hexagonal/clean (blocos-anéis ↔ contexto), 40 event sourcing
(tempo ↔ fluxo), 148 RBAC (rede ↔ matriz), 195 event storming (tempo ↔ raias),
199 decisões arquiteturais (tempo ↔ rede).

Uma entrada por tipo (245):

| campo | conteúdo |
|---|---|
| `n`, `nome`, `categoria` | numeração e nome do dono |
| `gramatica` | uma das 12 (ver 7.3) |
| `preset` | vocabulário e regras em poucas palavras ("nós = estados; arestas = eventos; inicial/final obrigatórios") |
| `alias_de` | quando é sinônimo de outro tipo (32 casos) — herda tudo, muda nome e legenda |
| `notacao_formal` | `bpmn` · `uml-*` · `erd-crowsfoot` · `c4` · null |
| `keywords` | sinais para a recomendação |
| `tier` | `A` = forma distinta (recebe golden e eval) · `B` = variação de outro preset |
| `fase` | em que fase de construção a gramática dele fica pronta |

### 7.2 Modelo intermediário — `diagram.json`

Independente de renderizador. Campos comuns:

- `versao`, `tipo` (n do catálogo), `gramatica`, `titulo`, `subtitulo`
- `zonas[]`: agrupamentos numerados quando a narrativa tem atos (`id`, `nome`, `filhos`)
- `nos[]`: `id`, `nome`, `descricao` (≤ 1 frase), `papel` (`feliz` | `gate` | `memoria` | `neutro` | `externo`), `forma` (do vocabulário da gramática/notação), `pai` (contêiner), `nivel` (ver 7.8)
- `arestas[]`: `id`, `de`, `para`, `rotulo`, `papel` (`sequencia` | `feliz` | `retorno` | `falha`), `estilo` normativo quando há notação (ex.: `heranca`, `composicao`, `mensagem-assincrona`)
- `flows[]`: `id`, `titulo`, `passos[]` com `ref` (id de nó, aresta ou elemento da gramática) e `nota`
- Blocos específicos por gramática: `sequencia.participantes/mensagens/fragmentos`,
  `tempo.eixo/trilhas/barras/marcos`, `matriz.linhas/colunas/celulas`,
  `entidades.atributos/metodos/cardinalidades`, `blocos.camadas/aneis`, `ciclo.etapas/centro`.

A legenda **não** se escreve: é derivada dos papéis, estilos e formas efetivamente usados.

### 7.3 As 12 gramáticas

| gramática | tipos | layout | o que é o flow vivo | onde se origina |
|---|---|---|---|---|
| contexto | 66 | ELK layered hierárquico (contêineres aninhados) | requisição atravessa componentes e fronteiras; pub/sub replica o token | ELK |
| fluxo | 44 | ELK layered ortogonal, zonas opcionais | token percorre o caminho; decisão escolhe um ramo; fork gera tokens paralelos | ELK |
| sequencia | 25 | próprio: lifelines em colunas, eixo Y = ordem | mensagem corre entre lifelines; ativação acende | próprio |
| estados | 18 | ELK layered | estado ativo acende; token corre pela transição | ELK |
| tempo | 15 | próprio: eixo X com escala, trilhas em Y | cursor de "agora" varre o eixo; barras se preenchem | próprio |
| entidades | 14 | próprio para os cards-tabela + ELK com portas por atributo | narra uma navegação (join FK→PK, chamada) acendendo a linha do atributo | ELK + próprio |
| rede | 14 | ELK layered (DAG) ou stress | propagação em ondas pelos dependentes (impacto) | ELK |
| blocos | 13 | próprio: pilha, pirâmide, anéis, empacotamento | requisição atravessa camadas; nos sem fluxo, acende bloco a bloco | próprio |
| raias | 10 | ELK com partições por raia | token cruza raias; o handoff pisca a fronteira | ELK |
| matriz | 10 | próprio: grade com cabeçalhos | célula/linha acende em sequência; nada de setas | próprio |
| ciclo | 9 | próprio: anel radial com centro opcional | token circula; contador de volta; memória central pisca | próprio |
| arvore | 7 | ELK mrtree | desce da raiz a uma folha seguindo as respostas | ELK |

Mapeamento tipo a tipo: anexo. Classificações feitas por julgamento e revisáveis: 18, 26,
27, 40, 148, 195, 199 (ver anexo, `findings` da revisão).

### 7.4 Visual

- **Tokens** extraídos de `floorplan/assets/viewer.html:33-93` (tema escuro) e `66-90`
  (claro) para `assets/tokens.css`, com aviso MIT. Script de tema (auto/claro/escuro) de
  `viewer.html:6-27`.
- **Cores semânticas próprias**, recalibradas para AA em cada tema: `--papel-feliz` (verde),
  `--papel-gate` (vermelho), `--papel-memoria` (azul), `--papel-neutro`, `--papel-externo`.
  As cores por tipo de conexão do floorplan (`--k-*`, `--n-*`) **não** entram.
- **Card** = o do floorplan (`viewer.html:157-216`, `cardHTML 939-970`): nome + descrição,
  raio 20, sombra do card; o papel aparece como cor do ícone/anel, não como fundo chapado.
- **Arestas**: cantos arredondados como no floorplan (o style-spec da `diagramas-legais`,
  que proibia, não vale aqui); **pontas de seta** (o floorplan não tem) e
  **rótulos** desenhados; tracejado para retorno/falha.
- **Formas normativas** por notação: BPMN (eventos círculo, gateways losango, tarefas,
  pools/lanes), UML (classe em 3 compartimentos, pontas de herança/composição/agregação,
  estado inicial/final, nós de decisão/fork/join, lifelines e fragmentos), ERD (pé de
  galinha), C4 (pessoa, sistema, contêiner, componente com as convenções C4). Todas com a
  paleta, a fonte e os cantos do floorplan.
- **Tipografia**: Inter (texto) e JetBrains Mono (identificadores técnicos), embutidas em
  subset latino. Medição de texto feita **na geração** com a métrica real da fonte (não a
  heurística 0,52 × caracteres do style-spec antigo).
- Legenda no rodapé, sempre (derivada).

### 7.5 Flow vivo

- **Em repouso** (os dois artefatos): o tracejado corre devagar **só no caminho feliz** do
  primeiro flow; o resto fica parado. Movimento em tudo vira ruído.
- **No passo a passo** (HTML): o passo atual destaca seus nós e arestas, o tracejado corre
  neles, um ponto percorre a aresta (`animateMotion`), o resto esmaece (padrão de
  `viewer.html:1884-1905`).
- **Gramáticas sem setas**: o destaque percorre linha, célula ou bloco; nenhuma seta
  inventada (decisão 7).
- `prefers-reduced-motion`: sem animação contínua; o passo a passo continua funcionando
  com destaque estático.

### 7.6 Os artefatos

- **`NN-slug.svg`**: diagrama completo + animação CSS de repouso + legenda. Sem JS (roda via
  `<img>`, inline em PR, README e wiki). Tema escuro por padrão (decisão 4), com fundo
  explícito para não depender da página. **SVG puro**: sem `foreignObject` (o card HTML do
  floorplan é refeito em `<text>` com quebra de linha calculada na geração) e com **subset
  das fontes só com os glifos usados**, embutido. Meta < 150 KB *(decisão do Claude)*.
- **`NN-slug.html`**: o mesmo SVG inline + stepper + pan/zoom + troca de tema + fontes.
  Alvo **< 300 KB**. Stepper novo, pequeno: barra do flow no estilo do floorplan
  (`viewer.html:289-297`) com nota maior, avanço manual (←/→, botões) e "tocar" automático,
  câmera que **centraliza e aproxima o nó de cada passo** (o floorplan não faz isso; base
  em `centerOn 1411-1416`), Esc sai.
- **`NN-slug.diagram.json`**: o modelo, salvo junto, para regerar e para a fase de código.
- **`NN-slug.mmd`** (Mermaid, só gramáticas fluxo, sequência, estados, entidades e tempo-
  gantt), com comentário no topo dizendo o que se perde (stepper, notas, formas).
- Local: `docs/diagramas/` do projeto (ou onde o usuário disser). **`NN` é a sequência do
  projeto** (como hoje, 2 dígitos, 3 a partir de 100), não o número do tipo; o tipo fica no
  `diagram.json` e no rodapé. Regerar a partir de um `diagram.json` sobrescreve os arquivos
  do mesmo `NN-slug`; diagrama novo ganha o próximo `NN` *(decisão do Claude)*.

### 7.7 Verificação (obrigatória, como hoje)

1. **Esquema**: `diagram.json` válido; refs de passos existem; papéis e formas pertencem ao
   preset/notação.
2. **Geometria** sobre o `layout.json`: o verificador de violações do `route_edges.mjs`
   (segmentos diagonais, aresta atravessando nó, arestas sobrepostas, rótulo colidindo),
   reaproveitado e estendido para cards e rótulos.
3. **Render**: Chrome headless captura o SVG e **cada passo** do HTML (quadro inicial e um
   por passo, nos dois temas); a skill olha as imagens procurando texto vazando, nota
   cobrindo o nó, seta sobre rótulo.
4. **Orçamento**: HTML < 300 KB; contraste AA dos papéis nos dois temas.
5. **Evals**: substituem as atuais (que assumem 980 px e zonas tracejadas); um golden por
   tipo tier A, começando pelos 3 fixtures existentes reescritos como `diagram.json`.

### 7.8 Nível identificado / inferido / proposto

Fica no modelo (campo `nivel` por nó e aresta), porque a fase de código vai usá-lo. Nesta
fase não há código para "identificar": o padrão é **informado** (veio do usuário, sem
marca visual). O usuário pode dizer que algo é **proposto** (ainda não existe) e isso
aparece tracejado e com selo "proposto" na legenda. **Inferido** não é usado nesta fase.

### 7.9 Onde a skill mora e como é instalada

- **Repositório próprio**: `~/Repositorios/diagramas-vivos`, publicado no GitHub do dono
  como repositório **público** (pedido do dono). Este design e os anexos vivem em
  `docs/superpowers/specs/` desse repositório.
- **Licença do repositório**: MIT, com `NOTICE` listando o floorplan (MIT), as fontes (OFL)
  e o ELK (EPL-2.0, só usado pelos scripts de geração) *(decisão do Claude)*.
- **Instalação**: link simbólico `~/.claude/skills/diagramas-vivos` → raiz do repositório,
  para que o Claude Code use sempre o que está no repositório, sem cópia que desatualiza
  *(decisão do Claude)*. O conteúdo da skill (SKILL.md, references, assets, scripts) fica
  na raiz do repositório.

### 7.10 Estrutura da skill

Do `diagramas-legais` se **copiam** (sem alterar o original) o verificador de geometria de
`scripts/route_edges.mjs`, o `scripts/render_check.py` (base para a nova captura) e os 3
fixtures de `scripts/fixtures/`.

```
diagramas-vivos/
  SKILL.md                      recomendar → modelar → gerar → verificar → entregar
  NOTICE                        MIT floorplan, OFL fontes, EPL ELK (só scripts)
  references/
    presets.json                os 245
    gramaticas/<id>.md          vocabulário, formas, regras e flow de cada gramática
    notacoes/<bpmn|uml|erd|c4>.md
    modelo.md                   schema do diagram.json
  assets/
    tokens.css, fonts/, shapes/ (formas normativas), stepper.js, template.html
    exemplos/<tier A>/          diagram.json + svg + html
  scripts/
    layout.mjs                  ELK em Node + layouts próprios por gramática
    emit.mjs                    layout.json → svg, html, mmd
    verify.mjs                  esquema + geometria + orçamento
    render_check.py             captura SVG e passos do HTML (Chrome headless)
    route_edges.mjs, emit_paths.mjs   copiados da diagramas-legais (ramo B da F0)
```

## 8. Fases de construção

Todos os 245 tipos ficam no catálogo desde a F1; tipo cuja gramática ainda não está pronta
é recomendado com aviso ("chega na fase X") e não é gerado de mentira.

| fase | entrega | critério para seguir |
|---|---|---|
| **F0 · spike** | 3 fixtures atuais em `diagram.json` → ELK em Node → SVG + HTML com stepper | os 3 fixtures com **zero violações** no verificador de geometria; HTML < 300 KB; SVG < 150 KB; visual aprovado pelo dono ao lado do floorplan. **"ELK perde"** = algum fixture com violação que o libavoid não tem. **Ramo B já previsto:** posições do ELK + roteamento das arestas pelo libavoid (`route_edges.mjs`); só se o ramo B também falhar, parar e rever *(decisão do Claude)*. |
| **F1** | gramáticas fluxo, contexto, estados, rede, árvore (149 tipos) + recomendação + catálogo inteiro + verificação nova + evals tier A dessas gramáticas | evals passando; dono testa 5 pedidos reais |
| **F2** | sequência (25) | idem |
| **F3** | raias e matriz (20) | idem |
| **F4** | tempo (15) | idem |
| **F5** | entidades, ciclo e blocos (36), com UML/ERD normativos completos | idem |
| **F6** | export Mermaid das gramáticas compatíveis | perdas declaradas no arquivo |

Notações formais entram na fase da sua gramática (BPMN e UML de atividades na F1/F3,
sequência UML na F2, classes/ERD na F5).

## 9. Riscos que continuam abertos

- **ELK hierárquico** (contexto, 66 tipos) com arestas cruzando contêineres pode gerar
  rotas feias; é o primeiro alvo da F1 depois da F0.
- **Recomendação** depende de julgamento do modelo; mitigado pelas alternativas de
  gramáticas diferentes e por sempre perguntar antes de gerar.
- **Tema escuro no PR**: SVG escuro em página clara de PR pode destoar; se incomodar, o
  SVG ganha variante clara (decisão do dono no F0).
- Ninguém mediu ainda um HTML real: os 300 KB são meta, não medição.

## 10. Deixado para quem constrói

- Estrutura interna de `layout.mjs`/`emit.mjs`, nomes de funções, testes unitários.
- Algoritmo exato dos layouts próprios (sequência, tempo, matriz, ciclo, blocos).
- Parâmetros finos do ELK por gramática.
- Desenho exato dos ícones e formas normativas, desde que fiéis à notação.
- Quais tipos são tier A além dos óbvios (o anexo traz os 32 aliases como tier B certos).
