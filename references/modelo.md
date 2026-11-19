# Formato do diagram.json (F0)

```
{ versao: 1, tipo: number, gramatica: "fluxo", titulo, subtitulo?,
  zonas?: [{id, nome}],
  nos: [{id, nome, descricao?, papel, zona?, nivel?}],
  arestas: [{id, de, para, rotulo?, resposta?, papel, nivel?}],
  flows: [{id, titulo, passos: [{ref, nota, sentido?}]}] }
```

- `papel` de nó: `feliz`, `gate`, `memoria`, `neutro` ou `externo`.
- `papel` de aresta: `sequencia`, `feliz`, `retorno` ou `falha`.
- `nivel`: `informado` ou `proposto` (F0 não aceita `inferido`).
- Ids são únicos entre nós e arestas. `de`/`para` apontam para nós; `zona` para uma zona.
- Cada flow tem no mínimo 2 passos; `ref` aponta para um id de nó ou aresta; `nota` é obrigatória.
- `resposta` (aresta, opcional): texto de 1 a 40 caracteres; desenha a volta (seta tracejada paralela à ida). `sentido` (passo, opcional): `ida` (padrão) ou `volta`; só vale quando `ref` é aresta, e `volta` exige que a aresta tenha `resposta`.
- Deve haver pelo menos 1 flow.

`validar(diagrama)` em `scripts/lib/modelo.mjs` retorna `{ ok, erros }` e coleta todos os erros.
