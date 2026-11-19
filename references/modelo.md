# Formato do diagram.json (F0.1)

```
{ versao: 1, tipo: number, gramatica: "fluxo", titulo, subtitulo?,
  zonas?: [{id, nome}],
  nos: [{id, nome, descricao?, papel, icone?, selo?, zona?, nivel?}],
  arestas: [{id, de, para, rotulo?, resposta?, tipo?, papel, nivel?}],
  flows: [{id, titulo, passos: [{ref, nota, sentido?}]}] }
```

- `papel` de nó: `feliz`, `gate`, `memoria`, `neutro` ou `externo`.
- `papel` de aresta: `sequencia`, `feliz`, `retorno` ou `falha`.
- `icone` (nó, opcional): `pessoa`, `servico`, `ferramenta`, `banco`, `gate`, `externo`, `fila`, `documento` ou `agente`; sem ele, o ícone sai do papel.
- `selo` (nó, opcional): texto de 1 a 12 caracteres (ex.: "MCP").
- `tipo` (aresta, opcional): `chamada` (padrão), `rpc`, `dados`, `evento` ou `fila`; dá a cor da ligação.
- `nivel`: `informado` ou `proposto` (F0 não aceita `inferido`).
- Ids (zonas, nós, arestas, flows) usam só `^[A-Za-z0-9_-]+$` (viram id no DOM do SVG: `n-<id>`, `a-<id>`); o sufixo `--volta` é reservado (`a-<id>--volta` é o path da volta). Ids são únicos entre nós e arestas. `de`/`para` apontam para nós; `zona` para uma zona.
- Cada flow tem no mínimo 2 passos; `ref` aponta para um id de nó ou aresta; `nota` é obrigatória.
- `resposta` (aresta, opcional): texto de 1 a 40 caracteres; gera a volta como aresta própria só no Layout (id `<id>~volta`, do `para` ao `de`, roteada pelo ELK, rótulo = resposta); não escreva `~volta` no modelo. `sentido` (passo, opcional): `ida` (padrão) ou `volta`; só vale quando `ref` é aresta, e `volta` exige que a aresta tenha `resposta`.
- Deve haver pelo menos 1 flow. Para tocar uma ligação, o passo usa o id da **aresta** (`sentido: "volta"` para a resposta); passo de nó só no começo e no fim do cenário (convenção, não validada).
- Resultado da geração: o `.svg` é vivo (SMIL, sem JS): cada flow é um cenário, e o primeiro é o caminho feliz. O arquivo `.svg` começa com `<?xml version="1.0" encoding="UTF-8"?>`; o HTML embute o SVG sem essa linha.

`validar(diagrama)` em `scripts/lib/modelo.mjs` retorna `{ ok, erros }` e coleta todos os erros.
