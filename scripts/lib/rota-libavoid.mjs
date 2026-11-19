// Ramo B: re-roteia as arestas com libavoid sobre as posições de nós que o ELK produziu.
// Adaptado de ~/.claude/skills/diagramas-legais/scripts/route_edges.mjs (chooseSides, makePort,
// parâmetros do roteador, carga do wasm e leitura de displayRoute). Diferenças em relação à origem:
// entrada é um Layout (não routing.json); portas de um mesmo lado do card são espalhadas
// (offset (i+1)/(n+1)) para as arestas não dividirem o trecho de saída; markerOffset = 0 (a ponta
// termina exatamente na borda do card); laços (de === para) mantêm os pontos do ELK.
import { AvoidLib } from 'libavoid-js';
import { ROTULO_LINHA, verificarGeometria } from './geometria.mjs';

const CLEARANCE = 8;
const MIN_GAP = 4;
const EPS = 1e-6;

function chooseSides(src, dst) {
  const dx = dst.x + dst.w / 2 - (src.x + src.w / 2);
  const dy = dst.y + dst.h / 2 - (src.y + src.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

function makePort(n, side, offset) {
  const ports = {
    left: { b: [n.x, n.y + n.h * offset], v: [-1, 0] },
    right: { b: [n.x + n.w, n.y + n.h * offset], v: [1, 0] },
    top: { b: [n.x + n.w * offset, n.y], v: [0, -1] },
    bottom: { b: [n.x + n.w * offset, n.y + n.h], v: [0, 1] },
  };
  const { b, v } = ports[side];
  return { boundary: b, outside: [b[0] + v[0] * CLEARANCE, b[1] + v[1] * CLEARANCE] };
}

const dedup = (pts) => pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1][0]) > EPS || Math.abs(p[1] - pts[i - 1][1]) > EPS);

// Remove pontos intermediários colineares (mesma reta), mantendo a forma.
function simplificar(pts) {
  const out = [];
  for (const p of pts) {
    while (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      const colX = Math.abs(a[0] - b[0]) < EPS && Math.abs(b[0] - p[0]) < EPS;
      const colY = Math.abs(a[1] - b[1]) < EPS && Math.abs(b[1] - p[1]) < EPS;
      if (colX || colY) out.pop(); else break;
    }
    out.push(p);
  }
  return out;
}

function enumValue(Avoid, flat, group) {
  const v = Avoid[flat] ?? Avoid[group]?.[flat];
  if (v === undefined) throw new Error(`libavoid-js enum não encontrado: ${flat}`);
  return typeof v === 'number' ? v : v.value;
}

// Rótulo no ponto médio do maior segmento, ao lado da linha. Tenta primeiro esse segmento (acima/abaixo se
// horizontal, direita/esquerda se vertical) e, se colidir com card ou outro rótulo, os demais por tamanho.
function posicionarRotulo(rotulo, pontos, ocupados) {
  const w = rotulo.w ?? 0, h = rotulo.h ?? rotulo.linhas.length * ROTULO_LINHA;
  const segs = [];
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1], b = pontos[i];
    segs.push({ a, b, c: Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) });
  }
  if (segs.length === 0) return rotulo;
  segs.sort((s1, s2) => s2.c - s1.c);
  const livre = (r) => !ocupados.some((o) =>
    r.x < o.x + o.w - 0.5 && o.x < r.x + r.w - 0.5 && r.y < o.y + o.h - 0.5 && o.y < r.y + r.h - 0.5);
  let primeiro = null;
  for (const { a, b } of segs) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const horiz = Math.abs(a[1] - b[1]) <= Math.abs(a[0] - b[0]);
    const cand = horiz
      ? [{ x: mx - w / 2, y: my - h - 2 }, { x: mx - w / 2, y: my + 2 }]
      : [{ x: mx + 2, y: my - h / 2 }, { x: mx - w - 2, y: my - h / 2 }];
    for (const c of cand) {
      const r = { ...rotulo, x: c.x, y: c.y };
      primeiro ??= r;
      if (livre({ x: r.x, y: r.y, w, h })) return r;
    }
  }
  return primeiro;
}

let carga = null;
const carregar = () => (carga ??= AvoidLib.load().catch((e) => { carga = null; throw e; }));

const TENTATIVAS = 10;

// Pontuação de um candidato: nº de violações de verificarGeometria (diagonal, atravessa-no, sobreposicao,
// rotulo-colide). Diagonais contam: se o libavoid falhar numa rota, displayRoute devolve reta diagonal.
export const pontuar = (layout) => verificarGeometria(layout).length;

/**
 * Re-roteia as arestas com libavoid sobre as posições de nós do layout.
 * ATENÇÃO: o resultado pode AINDA ter violações (é a melhor de várias tentativas, não uma garantia).
 * Quem chama deve rodar verificarGeometria(resultado) e tratar o resíduo (a CLI sai com código 2).
 */
export async function rotearLibavoid(layout, diagrama) {
  const nos = new Map(layout.nos.map((n) => [n.id, n]));
  const arestasModelo = new Map(diagrama.arestas.map((a) => [a.id, a]));
  const roteaveis = layout.arestas.filter((a) => {
    const m = arestasModelo.get(a.id);
    return m && m.de !== m.para;
  });

  // Lados das portas e agrupamento por (card, lado) para espalhar arestas que dividem o mesmo lado.
  const lados = new Map();
  const grupos = new Map();
  const reg = (no, lado, id, ponta) => {
    const k = `${no}|${lado}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push({ id, ponta });
  };
  for (const a of roteaveis) {
    const m = arestasModelo.get(a.id);
    const [ls, lt] = chooseSides(nos.get(m.de), nos.get(m.para));
    lados.set(a.id, { ls, lt });
    reg(m.de, ls, a.id, 's');
    reg(m.para, lt, a.id, 't');
  }

  await carregar();
  const Avoid = AvoidLib.getInstance();

  // Tentativa 0: portas igualmente espaçadas. Se der sobreposição colinear entre arestas (portas de cards
  // diferentes caindo na mesma coordenada), as próximas tentativas deslocam as portas de forma
  // determinística; vence a tentativa com menos violações de geometria.
  let melhor = null;
  for (let t = 0; t < TENTATIVAS; t++) {
    let seed = 12345 + t * 7919;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const offsets = new Map();
    for (const lista of grupos.values()) {
      lista.forEach((g, i) => {
        let o = (i + 1) / (lista.length + 1);
        if (t > 0) o = Math.min(0.85, Math.max(0.15, o + (rnd() - 0.5) * 0.3 / lista.length));
        offsets.set(`${g.id}|${g.ponta}`, o);
      });
    }
    const candidato = rotearUma(Avoid, layout, roteaveis, arestasModelo, nos, lados, offsets);
    const falhas = pontuar(candidato);
    if (!melhor || falhas < melhor.falhas) melhor = { candidato, falhas };
    if (falhas === 0) break;
  }
  return melhor.candidato;
}

function rotearUma(Avoid, layout, roteaveis, arestasModelo, nos, lados, offsets) {
  const flags = enumValue(Avoid, 'PolyLineRouting', 'RouterFlag') | enumValue(Avoid, 'OrthogonalRouting', 'RouterFlag');
  const router = new Avoid.Router(flags);
  if (typeof router.delete !== 'function') throw new Error('libavoid-js: Router.delete ausente; API incompatível');
  try {
    router.setRoutingParameter(enumValue(Avoid, 'segmentPenalty', 'RoutingParameter'), 50);
    router.setRoutingParameter(enumValue(Avoid, 'crossingPenalty', 'RoutingParameter'), 2000);
    router.setRoutingParameter(enumValue(Avoid, 'fixedSharedPathPenalty', 'RoutingParameter'), 2000);
    router.setRoutingParameter(enumValue(Avoid, 'shapeBufferDistance', 'RoutingParameter'), CLEARANCE);
    router.setRoutingParameter(enumValue(Avoid, 'idealNudgingDistance', 'RoutingParameter'), Math.max(CLEARANCE, MIN_GAP));
    router.setRoutingOption(enumValue(Avoid, 'nudgeOrthogonalSegmentsConnectedToShapes', 'RoutingOption'), true);
    router.setRoutingOption(enumValue(Avoid, 'nudgeSharedPathsWithCommonEndPoint', 'RoutingOption'), true);

    layout.nos.forEach((n, i) => {
      new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(n.x, n.y), new Avoid.Point(n.x + n.w, n.y + n.h)), i + 1);
    });

    const rotas = roteaveis.map((a) => {
      const m = arestasModelo.get(a.id);
      const { ls, lt } = lados.get(a.id);
      const ps = makePort(nos.get(m.de), ls, offsets.get(`${a.id}|s`));
      const pt = makePort(nos.get(m.para), lt, offsets.get(`${a.id}|t`));
      const conn = new Avoid.ConnRef(router, new Avoid.ConnEnd(new Avoid.Point(...ps.outside)), new Avoid.ConnEnd(new Avoid.Point(...pt.outside)));
      // setRoutingType exige o objeto do enum (passar o número vira polilinha, com diagonais).
      conn.setRoutingType(Avoid.ConnType.ConnType_Orthogonal);
      conn.setHateCrossings(true);
      return { id: a.id, ps, pt, conn };
    });

    router.processTransaction();

    const novos = new Map();
    for (const r of rotas) {
      const dr = r.conn.displayRoute();
      const rt = dr.ps ?? dr;
      const at = rt.get_ps?.bind(rt) ?? rt.get?.bind(rt);
      if (!at) throw new Error(`${r.id}: API de rota do libavoid-js não suportada`);
      const roteados = Array.from({ length: rt.size() }, (_, i) => { const p = at(i); return [p.x, p.y]; });
      novos.set(r.id, simplificar(dedup([r.ps.boundary, ...roteados, r.pt.boundary])));
    }

    // Rótulos: cards e rótulos já posicionados são obstáculos. Laços mantêm o rótulo do ELK.
    const ocupados = layout.nos.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
    for (const a of layout.arestas) {
      if (a.rotulo && !novos.has(a.id)) ocupados.push({ x: a.rotulo.x, y: a.rotulo.y, w: a.rotulo.w, h: a.rotulo.h });
    }
    const arestas = layout.arestas.map((a) => {
      const pontos = novos.get(a.id);
      if (!pontos) return a; // laço: mantém os pontos do ELK
      const saida = { ...a, pontos };
      if (a.rotulo) {
        saida.rotulo = posicionarRotulo(a.rotulo, pontos, ocupados);
        ocupados.push({ x: saida.rotulo.x, y: saida.rotulo.y, w: saida.rotulo.w, h: saida.rotulo.h ?? 0 });
      }
      return saida;
    });
    return { ...layout, arestas };
  } finally {
    router.delete();
  }
}
