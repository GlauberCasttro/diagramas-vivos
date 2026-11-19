// Portions derived from floorplan (MIT) (c) 2026 Hayden Smith
// Regras puras do passo a passo, sem DOM. Importado pelos testes (node) e embutido no HTML antes de
// assets/stepper.js (html.mjs remove as palavras "export" ao embutir).

// O que o passo i (0-based, dentro do flow) realça.
// passos: [{ref}] do flow; arestas: {id: {de, para}}. Retorna {nos: Set, arestas: Set}.
// - ref aresta: a aresta e os nós das pontas.
// - ref nó: o nó e a aresta pela qual se chegou a ele:
//   passo anterior é aresta com para === ref -> essa aresta (inclusive se for um laço);
//   passo anterior é nó X !== ref -> arestas X -> ref;
//   caso contrário (primeiro passo, mesmo nó, aresta que não chega a ref) -> só o nó.
//   Laço nunca é inferido: só entra se o passo anterior FOR a aresta do laço.
export function destaques(passos, i, arestas) {
  const nos = new Set(), hl = new Set();
  const ref = passos[i].ref;
  const a = arestas[ref];
  if (a) {
    hl.add(ref); nos.add(a.de); nos.add(a.para);
    return { nos, arestas: hl };
  }
  nos.add(ref);
  const ant = i > 0 ? passos[i - 1].ref : null;
  if (ant != null) {
    const aa = arestas[ant];
    if (aa) { if (aa.para === ref) hl.add(ant); }
    else if (ant !== ref) {
      for (const [id, x] of Object.entries(arestas)) if (x.de === ant && x.para === ref) hl.add(id);
    }
  }
  return { nos, arestas: hl };
}

// Passo pedido pelo hash: "#passo=N" com 1 <= N; N acima de total é limitado a total.
// Hash inválido, ausente ou "#passo=0" -> 0 (repouso).
export function passoDoHash(hash, total) {
  const m = /^#passo=(\d+)$/.exec(hash || '');
  if (!m) return 0;
  const n = +m[1];
  return n < 1 ? 0 : Math.min(n, total);
}
