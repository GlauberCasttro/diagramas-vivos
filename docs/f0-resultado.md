# Resultado da F0 — diagramas vivos

Data: 2026-11-18 · branch `f0` · Node 26 · elkjs 0.9.3 · libavoid-js 0.5.0-beta.5

Critério (spec §8, verbatim): "os 3 fixtures com zero violações no verificador de geometria; HTML < 300 KB;
SVG < 150 KB; visual aprovado pelo dono ao lado do floorplan. 'ELK perde' = algum fixture com violação que o
libavoid não tem. Ramo B já previsto: posições do ELK + roteamento das arestas pelo libavoid; só se o ramo B
também falhar, parar e rever."

## Decisão

**GO com ELK** na parte mecânica do critério: os 3 fixtures têm zero violações no verificador de geometria com
o roteador ELK, nas duas direções, e todos os arquivos ficam dentro do orçamento. O ramo B (libavoid) não foi
necessário: também dá zero violações em todos os casos, então "ELK perde" não acontece.

**Pendente:** "visual aprovado pelo dono ao lado do floorplan". Não é decisão deste relatório. As saídas para essa
revisão estão em `exemplos/<nome>/01-*.html` (abrir no navegador) e os achados visuais abaixo são o que o dono
deve olhar primeiro.

## Os 3 fixtures

Reescritos a partir dos SVGs da skill `diagramas-legais` (`assets/exemplos/`), sem alterar a skill de origem.

| Fixture | Origem | Zonas | Nós | Arestas | Passos do flow |
|---|---|---|---|---|---|
| `exemplos/deploy/` | `exemplo-deploy-aprovacao.svg` | 3 | 11 | 8 (3 retorno) | 9 |
| `exemplos/fluxo-card/` | `exemplo-fluxo-setas.svg` | 4 | 20 | 17 (2 retorno) | 15 |
| `exemplos/skill/` | `exemplo-skill-diagramas.svg` | 4 | 14 | 12 (2 retorno) | 11 |

Mapeamento: nome = linha em negrito, descrição = linha de baixo; caixa verde (preenchida ou contorno verde) =
`feliz`, contorno vermelho = `gate`, azul = `memoria`, demais = `neutro`; aresta verde = `feliz`, cinza =
`sequencia`, tracejado vermelho = `retorno`. Zona = "N · nome — subtítulo" com o texto original.

Adaptações (registradas para não passarem por fidelidade):
- Caixas de memória tinham duas linhas de descrição: viraram uma descrição só, unidas por vírgula ou ponto e
  vírgula. Os nomes em CAIXA ALTA viraram caixa normal (o caixa alta era só estilo).
- Três rótulos da origem não pertencem a nenhuma seta (texto solto sob um gate) e **ficaram de fora**, porque o
  modelo só tem rótulo de aresta e inventar um nó-destino seria improvisar:
  `fluxo-card` "não → card fica para humano" (sob Elegível?), "sim → pergunta vira comentário no card; resposta
  retoma o run" (sob Precisa de humano?) e "smoke/canário falhou → rollback + nova rodada" (sob Homologação). O
  conteúdo dos dois primeiros aparece nas notas do flow.
- `deploy`: Deploy → Rollback → Alerta são tracejado vermelho na origem e entraram como `retorno`, conforme o
  mapeamento do brief. Semanticamente são um ramo de **falha** (seguem adiante no tempo); com `retorno` o ELK
  inverte a aresta e desenha Rollback e Alerta **acima** do Deploy. Com papel `falha` eles ficariam abaixo.
  Decisão do dono.

## Números

Saídas versionadas: `--roteador elk --direcao DOWN`.

| Fixture | Direção | Violações ELK | Violações libavoid | SVG (B) | HTML (B) | Canvas | Avisos de cobertura |
|---|---|---|---|---|---|---|---|
| deploy | DOWN (versionado) | 0 | 0 | 79 753 | 102 356 | 1596 × 1904 | `→` |
| deploy | RIGHT | 0 | 0 | 79 704 | 102 150 | 3160 × 949 | `→` |
| fluxo-card | DOWN (versionado) | 0 | 0 | 84 735 | 109 395 | 1992 × 3969 | `→` |
| fluxo-card | RIGHT | 0 | 0 | 84 737 | 108 912 | 6805 × 1045 | `→` |
| skill | DOWN (versionado) | 0 | 0 | 81 588 | 104 989 | 1450 × 2615 | `≤`, `→` |
| skill | RIGHT | 0 | 0 | 81 521 | 104 563 | 4388 × 829 | `≤`, `→` |

Com libavoid os bytes variam menos de 1 KB (deploy DOWN 79 881 / 102 490; fluxo-card DOWN 85 489 / 110 407;
skill DOWN 81 745 / 105 182). Limites: SVG < 153 600 B, HTML < 307 200 B. Folga: SVG usa ~55%, HTML ~36%.
A maior parte do SVG são as fontes woff2 inteiras embutidas (decisão da F0; subset fica para a F1).

Avisos de cobertura: `→` (U+2192) aparece nos rótulos de retorno copiados da origem; `≤` (U+2264) na descrição
"cabe em x ≤ 956". Os dois estão fora do subset `latin` da Inter e caem na fonte do sistema — esperado
(global-constraints), não é violação.

## Direção: DOWN, e por quê

O layout usa ELK `layered` com as zonas como nós compostos (`INCLUDE_CHILDREN`), numa direção só para o
diagrama inteiro. Em RIGHT cada nó da cadeia principal vira uma coluna (260 px de card + 130 px entre camadas):
o `fluxo-card` chega a **6805 px de largura** para 1045 de altura (proporção 6,5:1) e o `skill` a 4388 px
(5,3:1). Em DOWN as proporções ficam 0,84, 0,50 e 0,55, que se lêem rolando a página e cabem no zoom de foco do
passo a passo. **Escolha: DOWN nos três.** Para isso `scripts/gerar.mjs` ganhou `--direcao DOWN|RIGHT`
(padrão DOWN desde a revisão final, repassado a `layoutFluxo`; teste em `tests/gerar.test.mjs`) e a saída JSON informa `direcao`.

Nenhuma das duas reproduz a composição da origem (zonas empilhadas, nós em linha dentro de cada zona, 980 px de
largura): isso exigiria direção por zona, o que o ELK não faz com `INCLUDE_CHILDREN`. Ver achado V1.

## Correções feitas no gerador durante a inspeção

1. **Nome da zona vazava da zona** (ex.: "1 · Gatilho — o card nasce e o orquestrador decide se assume" numa
   zona de uma coluna, 308 px). `layout-fluxo.mjs` agora dá a cada zona largura mínima = nome medido + 2 × 24.
   Descoberta no caminho: com `INCLUDE_CHILDREN` o ELK 0.9.3 aplica `elk.nodeSize.minimum` de nó composto
   **transposto** em DOWN (a largura pedida virava altura e inflava a zona de memória), então o par é invertido
   nessa direção. Teste em `tests/layout.test.mjs` (RIGHT e DOWN: largura cabe o nome, altura não infla).
2. **Seta riscando o nome da zona.** Em DOWN as arestas entram na zona por cima, atravessando a faixa do nome
   (visto em `fluxo-card`: "3 · Entrega…" e "2 · Sandbox…"). `svg.mjs` passou os nomes de zona para um grupo
   `nomes-zona` desenhado depois das arestas, com halo da cor do fundo (`paint-order: stroke`) em
   `assets/diagrama.css`: a seta passa por trás do texto. Teste em `tests/svg.test.mjs`.

## Achados visuais (para o dono; não corrigidos)

- **V1 — Composição alta e espaçada.** 130 px entre camadas e as camadas extras dos rótulos de aresta deixam
  setas verticais longas (`fluxo-card` tem 3969 px de altura; a origem tinha 880). A origem é bem mais densa.
  Caminhos possíveis na F1: espaçamento menor entre camadas, ou layout em duas etapas (zonas empilhadas, cada uma
  com direção RIGHT própria, arestas entre zonas roteadas depois — o ramo B já sabe rotear sobre posições dadas).
- **V2 — Cards desalinhados da coluna.** Toda aresta de retorno (e cada rótulo) cria nó fictício na camada
  intermediária, e o ELK desloca o card daquela camada para o lado (Testes em `deploy`, Roteador e Renderiza em
  `skill`, Codifica/Testa em `fluxo-card`). Testei `nodePlacement` NETWORK_SIMPLEX, LINEAR_SEGMENTS e
  BRANDES_KOEPF+BALANCED: nenhum muda o resultado.
- **V3 — Zonas de memória flutuam.** Sem arestas, a zona de memória vai para a primeira camada, ao lado da zona
  1. Fica legível, mas não "no rodapé" como na origem.
- **V4 — Ordem do ramo de rollback** em `deploy` (ver Adaptações): consequência de `retorno` para um ramo que é
  de falha.
- **V5 — O verificador de geometria não conhece o nome da zona.** O cruzamento seta × nome de zona só apareceu
  na inspeção visual; hoje está resolvido pelo halo, mas o verificador continua cego para ele.
- **V6 — `render_check.py` não mostra o canvas inteiro.** A captura `svg-*.png` é a janela de 1600 × 1000 no
  canto superior esquerdo: em todos os três fixtures corta a maior parte do diagrama. Para a inspeção usei um
  render de página inteira à parte (Chrome headless com a janela do tamanho do viewBox, escala 0,5). As capturas
  de passo (`passo-NN-*.png`) estão boas: o zoom de foco centraliza o nó/aresta do passo e a nota do passo fica
  no topo sem cobrir o foco em nenhum dos 35 passos dos três fixtures (revisados os 35 no tema escuro, em
  folha de contato, e amostras no claro). Detalhe cosmético: nos passos 2–3 de `deploy` e `skill` a nota cobre
  parte do título do diagrama (cabeçalho), não o foco.

O que foi olhado e está limpo: nenhum texto vaza de card (máx. 3 linhas de descrição, sem reticências nesses
fixtures), nenhuma seta sobre rótulo de aresta, nota de passo nunca cobre o nó em foco, tema claro e escuro
legíveis, os retornos em vermelho tracejado e o caminho feliz animado só no primeiro flow.

## Como reproduzir

```
node scripts/gerar.mjs exemplos/deploy/diagram.json --saida exemplos/deploy --nome 01-deploy-com-aprovacao-manual --direcao DOWN
node scripts/gerar.mjs exemplos/fluxo-card/diagram.json --saida exemplos/fluxo-card --nome 01-ciclo-de-card-do-board-ate-producao --direcao DOWN
node scripts/gerar.mjs exemplos/skill/diagram.json --saida exemplos/skill --nome 01-como-a-skill-gera-um-diagrama --direcao DOWN
python3 scripts/render_check.py exemplos/<nome>/01-*.html   # capturas em <stem>-capturas/ (fora do git)
```

Trocar `--roteador libavoid` dá o ramo B; `--direcao RIGHT` dá a versão horizontal.
