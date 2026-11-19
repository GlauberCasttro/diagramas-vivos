# diagramas-vivos — adendo F0.1: fluxo como requisição viva

Data: 2026-11-18 · Origem: feedback do dono ao ver o primeiro diagrama real (swarm-claw)

## O que o dono disse
- O diagrama ficou "longe, não dá para ver" e "demora muito em cada processo".
- "Tem que ser mais fluido, uma apresentação mais legal", como os flows do floorplan.
- "Montar o fluxo de entrada, retorno, ligação entre componentes; quando um componente tem retorno, mostrar
  também, como se fosse uma requisição funcionando."

## Comparação medida com o floorplan (flow "Uma demanda chega e é avaliada")
- Floorplan: câmera parada com o mapa inteiro; cada passo é uma ligação A → B; acende os dois cards e a
  seta, escurece o resto, bolinha corre de A para B; layout compacto e horizontal.
- F0: câmera pula e dá zoom por passo; passos alternam nó/aresta (17 passos); 0,5 s de transição + 3 s de
  pausa; layout vertical de 3.226 px.

## Decisões (substituem o que conflitar no design e no plano F0)
1. **Passo = ligação.** `passos[].ref` aponta para uma aresta (A → B); `sentido: "volta"` percorre a mesma
   aresta de B para A (a resposta). Passo apontando para nó continua permitido (início/fim da história).
2. **Ida e volta.** Aresta pode ter `resposta` (texto curto, ex.: "200 OK", "patch"). Com `resposta`, o SVG
   desenha a volta como seta tracejada paralela à ida (mesma cor da aresta, mais fina), com o rótulo da
   resposta. A cor vermelha de `retorno` continua reservada para refazer/falha.
3. **Câmera fixa.** O HTML abre com o diagrama inteiro enquadrado e não dá zoom por passo; o passo só
   muda destaque (`.hl` em A, B e na aresta; `.dim` no resto). Zoom/pan manuais continuam.
4. **Movimento.** Bolinha corre de A para B (ou de B para A na volta, com marcador vazado). "Tocar" a
   1,5 s por passo. Barra mostra "título · passo i de n", "A → B" (ou "B ⇠ A · resposta") e a nota.
5. **Layout compacto e horizontal.** Direção padrão volta a `RIGHT`, com zonas como colunas lado a lado,
   espaçamento entre camadas ~60 px, cards 240 px de largura, e o diagrama deve caber em ~1600×900 para até
   ~12 nós. `DOWN` fica opcional.

## Fora deste adendo
Outras gramáticas (F1+), Mermaid, subset de fontes.
