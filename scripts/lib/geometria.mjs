// Verificador de geometria do Layout (arestas ortogonais, sem atravessar card, sem sobreposição).
// segmentDistance/segmentHitsRect/intervalGap portados de
// ~/.claude/skills/diagramas-legais/scripts/route_edges.mjs:84-130 (mesma lógica; segmentos
// {start:[x,y], end:[x,y]}, retângulos {x, y, width, height}).
// Diferença em relação à origem: EPSILON = 0.5 (a origem usa 1e-6). O ELK devolve coordenadas
// fracionárias (ex.: 229.333…; centros de porta em x.5) e a conversão para absoluto soma offsets
// de pais, então pontos que deveriam ser colineares/na borda diferem por frações de pixel;
// 0.5 é meio pixel, abaixo do que se vê no SVG e acima do ruído numérico.

export const EPSILON = 0.5;
// Métrica do rótulo de aresta (ESTILO.rotulo, 12px): altura de linha e folga interna.
export const ROTULO_LINHA = 16;
const LARGURA_CHAR_ESTIMADA = 7; // fallback quando o rótulo não traz w medido

export function intervalGap(firstStart, firstEnd, secondStart, secondEnd) {
  const firstLow = Math.min(firstStart, firstEnd);
  const firstHigh = Math.max(firstStart, firstEnd);
  const secondLow = Math.min(secondStart, secondEnd);
  const secondHigh = Math.max(secondStart, secondEnd);
  return Math.max(0, secondLow - firstHigh, firstLow - secondHigh);
}

export function segmentDistance(first, second) {
  const firstHorizontal = Math.abs(first.start[1] - first.end[1]) <= EPSILON;
  const secondHorizontal = Math.abs(second.start[1] - second.end[1]) <= EPSILON;
  if (firstHorizontal && secondHorizontal) {
    return Math.hypot(
      intervalGap(first.start[0], first.end[0], second.start[0], second.end[0]),
      Math.abs(first.start[1] - second.start[1]),
    );
  }
  if (!firstHorizontal && !secondHorizontal) {
    return Math.hypot(
      Math.abs(first.start[0] - second.start[0]),
      intervalGap(first.start[1], first.end[1], second.start[1], second.end[1]),
    );
  }
  const horizontal = firstHorizontal ? first : second;
  const vertical = firstHorizontal ? second : first;
  return Math.hypot(
    intervalGap(horizontal.start[0], horizontal.end[0], vertical.start[0], vertical.start[0]),
    intervalGap(vertical.start[1], vertical.end[1], horizontal.start[1], horizontal.start[1]),
  );
}

export function segmentHitsRect(segment, rectangle) {
  const firstHorizontal = Math.abs(segment.start[1] - segment.end[1]) <= EPSILON;
  const left = rectangle.x;
  const top = rectangle.y;
  const right = left + rectangle.width;
  const bottom = top + rectangle.height;
  if (firstHorizontal) {
    const y = segment.start[1];
    return y > top + EPSILON && y < bottom - EPSILON &&
      intervalGap(segment.start[0], segment.end[0], left, right) <= EPSILON;
  }
  const x = segment.start[0];
  return x > left + EPSILON && x < right - EPSILON &&
    intervalGap(segment.start[1], segment.end[1], top, bottom) <= EPSILON;
}
// fim do trecho portado

const segmentos = (pontos) => {
  const s = [];
  for (let i = 1; i < pontos.length; i++) s.push({ start: pontos[i - 1], end: pontos[i] });
  return s;
};
const diagonal = (s) => Math.abs(s.start[0] - s.end[0]) > EPSILON && Math.abs(s.start[1] - s.end[1]) > EPSILON;
const horizontal = (s) => Math.abs(s.start[1] - s.end[1]) <= EPSILON;
const ret = (n) => ({ x: n.x, y: n.y, width: n.w, height: n.h });
// Interior do card (recuado 1px): a aresta pode tocar a borda (é onde ela entra/sai), não o miolo.
const miolo = (n) => ({ x: n.x + 1, y: n.y + 1, width: n.w - 2, height: n.h - 2 });

// Retângulo do rótulo: (x, y) é o canto superior esquerdo; w/h vêm do layout (medidos) ou estimados.
export function retanguloRotulo(r) {
  const h = r.h ?? r.linhas.length * ROTULO_LINHA;
  const w = r.w ?? Math.max(...r.linhas.map((l) => l.length)) * LARGURA_CHAR_ESTIMADA;
  return { x: r.x, y: r.y, width: w, height: h };
}

const retSobrepoe = (a, b) =>
  a.x < b.x + b.width - EPSILON && b.x < a.x + a.width - EPSILON &&
  a.y < b.y + b.height - EPSILON && b.y < a.y + a.height - EPSILON;

// Dois segmentos colineares (mesma orientação, mesma reta) que compartilham comprimento > 0.
function colineares(a, b) {
  if (diagonal(a) || diagonal(b)) return false;
  const ha = horizontal(a);
  if (ha !== horizontal(b)) return false;
  const [i, j] = ha ? [1, 0] : [0, 1];
  if (Math.abs(a.start[i] - b.start[i]) > EPSILON) return false;
  const lo = Math.max(Math.min(a.start[j], a.end[j]), Math.min(b.start[j], b.end[j]));
  const hi = Math.min(Math.max(a.start[j], a.end[j]), Math.max(b.start[j], b.end[j]));
  return hi - lo > EPSILON;
}

// Segmento ortogonal passa pelo interior do retângulo {x, y, width, height} (folga EPSILON nas bordas).
function segmentoCruzaRet(s, r) {
  const x0 = Math.min(s.start[0], s.end[0]), x1 = Math.max(s.start[0], s.end[0]);
  const y0 = Math.min(s.start[1], s.end[1]), y1 = Math.max(s.start[1], s.end[1]);
  return x1 > r.x + EPSILON && x0 < r.x + r.width - EPSILON && y1 > r.y + EPSILON && y0 < r.y + r.height - EPSILON;
}

export function verificarGeometria(layout) {
  const v = [];
  const arestas = layout.arestas || [];
  const nos = layout.nos || [];
  for (const a of arestas) {
    const segs = segmentos(a.pontos);
    if (segs.some(diagonal)) v.push({ tipo: 'diagonal', aresta: a.id });
    for (const n of nos) {
      if (segs.some((s) => !diagonal(s) && segmentHitsRect(s, miolo(n)))) v.push({ tipo: 'atravessa-no', aresta: a.id, alvo: n.id });
    }
  }
  for (let i = 0; i < arestas.length; i++) {
    const si = segmentos(arestas[i].pontos);
    for (let j = i + 1; j < arestas.length; j++) {
      const sj = segmentos(arestas[j].pontos);
      if (si.some((a) => sj.some((b) => colineares(a, b))))
        v.push({ tipo: 'sobreposicao', aresta: arestas[i].id, alvo: arestas[j].id });
    }
  }
  const rotulos = arestas.filter((a) => a.rotulo).map((a) => ({ id: a.id, r: retanguloRotulo(a.rotulo) }));
  rotulos.forEach(({ id, r }, i) => {
    for (const n of nos) if (retSobrepoe(r, ret(n))) v.push({ tipo: 'rotulo-colide', aresta: id, alvo: n.id });
    for (let j = i + 1; j < rotulos.length; j++)
      if (retSobrepoe(r, rotulos[j].r)) v.push({ tipo: 'rotulo-colide', aresta: id, alvo: rotulos[j].id });
  });
  // Rótulo é pílula com fundo: uma aresta alheia que passa por dentro dele some sob a pílula.
  // Encostar na borda (até EPSILON) não conta; a própria aresta do rótulo pode passar por baixo.
  for (const { id, r } of rotulos)
    for (const b of arestas) {
      if (b.id === id) continue;
      if (segmentos(b.pontos).some((s) => segmentoCruzaRet(s, r))) v.push({ tipo: 'rotulo-cruzado', aresta: id, alvo: b.id });
    }
  return v;
}
