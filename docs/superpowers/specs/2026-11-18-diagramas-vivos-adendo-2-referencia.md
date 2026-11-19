# diagramas-vivos — adendo 2: o SVG da referência é o alvo

Data: 2026-11-18 · Origem: o dono enviou `docs/referencia-visual/02-agente.svg` e disse "queria dessa forma".
Prevalece sobre o design, o plano F0 e o adendo 1 onde conflitar.

## O que a referência faz (e passa a ser requisito)
1. **O próprio SVG é vivo, sem JavaScript.** Animação SMIL encadeada: para cada cenário (flow), uma bolinha
   (`.token`) percorre cada ligação em sequência (`animateMotion` com `mpath` para o `path` da aresta;
   `begin="mN.end+0.25s"`), e o conjunto repete em loop (`begin="0.5s;mUltimo.end+1.1s"`). Funciona via
   `<img>`, no GitHub/Azure DevOps e no preview do VS Code.
2. **Ritmo:** duração de cada salto proporcional ao comprimento (~0,38 s por 120 px, mínimo 0,3 s), pausa
   de 0,25 s entre saltos, 1,1 s entre cenários.
3. **Chegada:** quando a bolinha chega num card, o contorno do card pisca (`animate opacity 0;1;0`, 0,7 s,
   na cor do ícone do card).
4. **Aresta ativa:** o tracejado que corre (`.flow`) só aparece enquanto o cenário dela toca (`set opacity`).
5. **Cenários no rodapé:** uma linha por flow: "N. Título: A → B → C …", que fica forte enquanto toca.
6. **Ida e volta:** a volta é uma aresta própria tracejada (`.ret`), na mesma cor do tipo, com chevron na
   chegada; a bolinha percorre a volta como qualquer outra ligação. (Arestas com `resposta` do adendo 1
   geram essa aresta de volta automaticamente.)
7. **Visual claro do floorplan:** fundo `#f3f3f1` com grade de pontos de 24 px; cards brancos raio 20 com
   sombra suave; **ladrilho de ícone 30×30** colorido por card + nome 15/600 + descrição 13; **selo**
   opcional (ex.: "MCP"); portas (círculos r 3,4) nas pontas das arestas; rótulos em pílula com fundo;
   cantos arredondados nas arestas; legenda por tipo de ligação + retorno + proposto.
8. **Cor da aresta pelo tipo de ligação** (`tipo`: chamada, rpc, dados, evento, fila), não pelo papel.
   Papel do nó dá a cor/ícone do card (gate continua vermelho). `retorno`/`falha` = tracejado.
9. **Layout horizontal compacto** (colunas de cards 300 px com 120 px entre colunas), como a referência.
10. O HTML continua existindo (o mesmo SVG + passo a passo opcional), mas o artefato principal é o SVG vivo.

## Modelo (acréscimos)
- `nos[].icone` opcional ∈ `pessoa | servico | ferramenta | banco | gate | externo | fila | documento |
  agente`; padrão derivado do papel.
- `nos[].selo` opcional (texto ≤ 12).
- `arestas[].tipo` opcional ∈ `chamada | rpc | dados | evento | fila`; padrão `chamada`.
