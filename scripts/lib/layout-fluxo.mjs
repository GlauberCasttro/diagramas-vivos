// Portions derived from floorplan (MIT) (c) 2026 Hayden Smith
// Layout da gramática "fluxo" com elkjs (layered + ORTHOGONAL), rodado no Node na geração.
// Zonas viram nós compostos (INCLUDE_CHILDREN). Saída: coordenadas absolutas, com o cabeçalho
// reservado no topo e a legenda no rodapé.
import ELK from 'elkjs/lib/elk.bundled.js';
import { ESTILO, quebrar, medir } from './texto.mjs';
import { ROTULO_LINHA } from './geometria.mjs';

// Card da referência (docs/referencia-visual/02-agente.svg): ladrilho de ícone 30×30 a (18,16), nome ao
// lado (x 58, baseline 36, linhas de 20), descrição abaixo (baseline 69, linhas de 19), selo em pílula de
// 21 px 13 px abaixo da última linha e 16 px de folga embaixo.
export const CARD = {
  largura: 300, padX: 18, padY: 16, icone: 30, nomeX: 58, linhaNome: 20, linhaDescricao: 19, selo: 21, minAltura: 72,
};
export const CABECALHO_ALTURA = 80; // título + subtítulo
export const LEGENDA_ALTURA = 56;
export const MARGEM = 32;
const ZONA_PAD = { topo: 44, lado: 24, base: 24 }; // topo inclui o nome da zona (ESTILO.zona)
const ROTULO_MAX = 160;
const ROTULO_PAD = 4;

// Sufixo do id da aresta de volta (só no Layout, nunca no modelo): `<id>~volta`.
export const SUFIXO_VOLTA = '~volta';

const ESPACOS = {
  // Referência visual (docs/referencia-visual/02-agente.svg): colunas de cards de 300 px com 120 px
  // entre elas. Base: viewer.html:1036-1041.
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.spacing.nodeNode': '36',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '8',
  'elk.spacing.edgeNode': '24',
};

// Posições verticais (relativas ao topo do card) de cada linha e do selo, e a altura do card.
export function geometriaCard(linhasNome, linhasDescricao, selo = false) {
  const extraNome = CARD.linhaNome * Math.max(0, linhasNome - 1);
  const nome = Array.from({ length: linhasNome }, (_, i) => 36 + CARD.linhaNome * i);
  const descricao = Array.from({ length: linhasDescricao }, (_, j) => 69 + extraNome + CARD.linhaDescricao * j);
  const ultima = descricao.length ? descricao[descricao.length - 1] : null;
  let seloY = null;
  let h;
  if (selo) {
    seloY = ultima !== null ? ultima + 13 : 56 + extraNome;
    h = seloY + CARD.selo + 16;
  } else {
    h = ultima !== null ? ultima + 21 : 62 + extraNome;
  }
  return { nome, descricao, seloY, h: Math.max(CARD.minAltura, h) };
}

export function alturaCard(linhasNome, linhasDescricao, selo = false) {
  return geometriaCard(linhasNome, linhasDescricao, selo).h;
}

const minimoZona = (w, direcao) => (direcao === 'DOWN' ? `(0,${w})` : `(${w},0)`);

export async function layoutFluxo(diagrama, fontes, opcoes = {}) {
  const direcao = opcoes.direcao || 'RIGHT';
  const conteudo = CARD.largura - 2 * CARD.padX;
  const conteudoNome = CARD.largura - CARD.nomeX - CARD.padX; // nome divide a linha com o ladrilho

  const cards = new Map();
  for (const n of diagrama.nos) {
    const linhasNome = quebrar(fontes, n.nome, ESTILO.nome, conteudoNome, 2);
    const linhasDescricao = n.descricao ? quebrar(fontes, n.descricao, ESTILO.descricao, conteudo, 3) : [];
    const h = alturaCard(linhasNome.length, linhasDescricao.length, Boolean(n.selo));
    cards.set(n.id, { linhasNome, linhasDescricao, h });
  }

  const elkNo = (n) => ({ id: n.id, width: CARD.largura, height: cards.get(n.id).h });
  const zonas = (diagrama.zonas || []).map((z) => ({
    id: z.id,
    layoutOptions: {
      'elk.padding': `[top=${ZONA_PAD.topo},left=${ZONA_PAD.lado},bottom=${ZONA_PAD.base},right=${ZONA_PAD.lado}]`,
      // O nome da zona é uma linha só (svg.mjs, x = zona.x + 24): a zona nunca fica mais estreita que ele.
      // Com INCLUDE_CHILDREN o ELK 0.9.3 aplica o mínimo de nó composto já transposto em DOWN
      // ((w,h) vira altura,largura), por isso o par é invertido nessa direção.
      'elk.nodeSize.constraints': 'MINIMUM_SIZE',
      'elk.nodeSize.minimum': minimoZona(Math.ceil(2 * ZONA_PAD.lado + medir(fontes, z.nome, ESTILO.zona)), direcao),
      ...ESPACOS,
    },
    children: diagrama.nos.filter((n) => n.zona === z.id).map(elkNo),
  }));
  const soltos = diagrama.nos.filter((n) => !n.zona).map(elkNo);

  // Arestas do Layout: as do modelo e, logo depois de cada uma com `resposta`, a volta própria
  // (`<id>~volta`, de = para original, para = de original, rótulo = resposta).
  // `invertida`: os pontos do ELK vêm no sentido contrário ao da saída e são desinvertidos.
  const roteadas = [];
  for (const a of diagrama.arestas) {
    // Aresta de retorno entra invertida no ELK: assim a quebra de ciclo nunca inverte o caminho
    // de ida (que manteria a ordem de leitura).
    const retorno = a.papel === 'retorno';
    const [s, t] = retorno ? [a.para, a.de] : [a.de, a.para];
    const par = Boolean(a.resposta);
    roteadas.push({ id: a.id, s, t, texto: a.rotulo, invertida: retorno, par });
    // A volta entra no ELK no mesmo sentido da ida: as duas ficam na mesma ordem de camadas, lado a
    // lado, sem criar ciclo; a saída é desinvertida para ir do `para` ao `de`.
    if (a.resposta) roteadas.push({ id: `${a.id}${SUFIXO_VOLTA}`, s, t, texto: a.resposta, invertida: !retorno, par });
  }

  const rotulos = new Map();
  for (const r of roteadas) {
    if (!r.texto) continue;
    const linhas = quebrar(fontes, r.texto, ESTILO.rotulo, ROTULO_MAX, 2);
    const w = Math.ceil(Math.max(...linhas.map((l) => medir(fontes, l, ESTILO.rotulo)))) + 2 * ROTULO_PAD;
    rotulos.set(r.id, { linhas, w, h: linhas.length * ROTULO_LINHA + 2 * ROTULO_PAD, texto: r.texto, inicio: r.par });
  }

  // Duas passadas possíveis. Compacta: o ELK roteia sem rótulos (rótulo central vira uma camada a mais,
  // que custa largura de rótulo + 2 × 120 px por coluna) e cada rótulo é posto em cima da própria
  // aresta, num trecho livre. Se algum rótulo não couber limpo, refaz com os rótulos no ELK.
  const nomesZona = (diagrama.zonas || []).map((z) => ({ id: z.id, w: 2 * ZONA_PAD.lado + medir(fontes, z.nome, ESTILO.zona) }));
  const montar = async (comRotulos) => {
    const edges = roteadas.map((r) => {
      const e = { id: r.id, sources: [r.s], targets: [r.t] };
      const q = rotulos.get(r.id);
      if (comRotulos && q) e.labels = [{ id: `${r.id}#rotulo`, text: q.texto, width: q.w, height: q.h }];
      return e;
    });
    const grafo = {
      id: 'raiz',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direcao,
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.edgeLabels.placement': 'CENTER',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.padding': '[top=0,left=0,bottom=0,right=0]',
        ...ESPACOS,
      },
      children: [...zonas, ...soltos],
      edges,
    };
    return converter(await new ELK().layout(grafo), comRotulos);
  };

  const converter = (res, comRotulos) => {
    // Posições absolutas de todo nó (zonas e cards), para converter coordenadas relativas.
    const abs = new Map([['raiz', { x: 0, y: 0 }]]);
    const visitar = (no, ox, oy) => {
      for (const c of no.children || []) {
        const p = { x: ox + c.x, y: oy + c.y, w: c.width, h: c.height };
        abs.set(c.id, p);
        visitar(c, p.x, p.y);
      }
    };
    visitar(res, 0, 0);

    const dx = MARGEM;
    const dy = CABECALHO_ALTURA + MARGEM;
    const P = (x, y) => [x + dx, y + dy];

    const saidaZonas = (diagrama.zonas || []).map((z) => {
      const p = abs.get(z.id);
      return { id: z.id, nome: z.nome, x: p.x + dx, y: p.y + dy, w: p.w, h: p.h };
    });
    const saidaNos = diagrama.nos.map((n) => {
      const p = abs.get(n.id);
      const c = cards.get(n.id);
      return { id: n.id, x: p.x + dx, y: p.y + dy, w: p.w, h: p.h, linhasNome: c.linhasNome, linhasDescricao: c.linhasDescricao };
    });

    const elkArestas = [];
    const coletar = (no) => {
      for (const e of no.edges || []) elkArestas.push(e);
      for (const c of no.children || []) coletar(c);
    };
    coletar(res);
    const porId = new Map(elkArestas.map((e) => [e.id, e]));

    const saidaArestas = roteadas.map((a) => {
      const e = porId.get(a.id);
      const o = abs.get(e.container || 'raiz') || { x: 0, y: 0 };
      const pontos = [];
      for (const s of e.sections || []) {
        for (const q of [s.startPoint, ...(s.bendPoints || []), s.endPoint]) {
          const pt = P(o.x + q.x, o.y + q.y);
          const ult = pontos[pontos.length - 1];
          if (!ult || ult[0] !== pt[0] || ult[1] !== pt[1]) pontos.push(pt);
        }
      }
      if (a.invertida) pontos.reverse();
      const saida = { id: a.id, pontos };
      if (comRotulos && rotulos.has(a.id)) {
        const l = e.labels[0];
        const [x, y] = P(o.x + l.x, o.y + l.y);
        saida.rotulo = { x, y, w: l.width, h: l.height, linhas: rotulos.get(a.id).linhas };
      }
      return saida;
    });

    const largura = Math.ceil(res.width + 2 * MARGEM);
    const alturaConteudo = Math.ceil(res.height + 2 * MARGEM);
    const legendaY = CABECALHO_ALTURA + alturaConteudo;
    return {
      largura,
      altura: legendaY + LEGENDA_ALTURA,
      cabecalho: { y: 0, altura: CABECALHO_ALTURA },
      legenda: { y: legendaY, altura: LEGENDA_ALTURA },
      zonas: saidaZonas,
      nos: saidaNos,
      arestas: saidaArestas,
    };
  };

  // `modoRotulos` diz qual passada valeu: 'compacto' (rótulos sobre as arestas) ou 'elk'.
  const compacto = await montar(false);
  if (porRotulosNasArestas(compacto, rotulos, nomesZona, direcao)) return { ...compacto, modoRotulos: 'compacto' };
  return { ...(await montar(true)), modoRotulos: 'elk' };
}

// ---- Rótulos sobre a própria aresta (passada compacta) ----
const FOLGA_ROTULO = 4; // distância mínima do rótulo a card, a outro rótulo e ao nome da zona
const FOLGA_LINHA = 2; // distância mínima do rótulo a uma aresta alheia
const FOLGA_LADO = 3; // rótulo encostado ao lado da aresta (quando não cabe em cima dela)
const PASSO_ROTULO = 2; // passo, em px, do deslizamento do rótulo ao longo do trecho

const sobrepoe = (a, b, f) =>
  a.x < b.x + b.w + f && b.x < a.x + a.w + f && a.y < b.y + b.h + f && b.y < a.y + a.h + f;
const cruzaSegmento = (r, p, q, f) =>
  Math.max(p[0], q[0]) > r.x - f && Math.min(p[0], q[0]) < r.x + r.w + f &&
  Math.max(p[1], q[1]) > r.y - f && Math.min(p[1], q[1]) < r.y + r.h + f;

// Centros candidatos ao longo de um trecho p→s: do meio para as pontas; num par ida/volta (`inicio`), da
// ponta de saída para a outra, para a ida e a volta, que correm lado a lado, não disputarem o meio.
function centros(p, s, inicio) {
  const c = Math.abs(s[0] - p[0]) + Math.abs(s[1] - p[1]);
  const ds = [];
  if (inicio) for (let d = 0; d <= c; d += PASSO_ROTULO) ds.push(d);
  else for (let k = 0; k <= c / 2; k += PASSO_ROTULO) ds.push(c / 2 - k, ...(k ? [c / 2 + k] : []));
  const ux = Math.sign(s[0] - p[0]), uy = Math.sign(s[1] - p[1]);
  return ds.map((d) => [p[0] + ux * d, p[1] + uy * d]);
}

// Põe cada rótulo (pílula com fundo) centrado num trecho da própria aresta, dos trechos no sentido do
// fluxo para os demais e do mais longo para o mais curto, deslizando ao longo dele (ver `centros`); o rótulo
// não pode encostar em card, em outro rótulo, no nome nem na borda de uma zona, nem em aresta alheia, e fica entre o cabeçalho e a legenda. Muta `layout` e devolve true
// se todos couberam; false deixa a decisão (refazer com rótulos no ELK) para quem chamou.
function porRotulosNasArestas(layout, rotulos, nomesZona, direcao) {
  const larguraNome = new Map(nomesZona.map((z) => [z.id, z.w]));
  const ocupados = [
    ...layout.nos,
    ...layout.zonas.map((z) => ({ x: z.x, y: z.y, w: larguraNome.get(z.id), h: ZONA_PAD.topo })),
  ];
  const topo = layout.cabecalho.y + layout.cabecalho.altura;
  // Borda tracejada das zonas: preferência por rótulo. Primeiro sem montar nela; se não couber em lugar
  // nenhum, aceita montar (a pílula, com fundo, só interrompe o tracejado).
  const bordas = layout.zonas.flatMap(({ x, y, w, h }) => [
    [[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]], [[x, y + h], [x + w, y + h]], [[x, y], [x, y + h]],
  ]);
  for (const a of layout.arestas) {
    const q = rotulos.get(a.id);
    if (!q) continue;
    const alheias = layout.arestas.filter((b) => b !== a);
    const livre = (r, evitarBordas) =>
      r.x >= 0 && r.x + r.w <= layout.largura && r.y >= topo && r.y + r.h <= layout.legenda.y &&
      !ocupados.some((o) => sobrepoe(r, o, FOLGA_ROTULO)) &&
      !alheias.some((b) => b.pontos.some((p, i) => i > 0 && cruzaSegmento(r, b.pontos[i - 1], p, FOLGA_LINHA))) &&
      !(evitarBordas && bordas.some(([p, q]) => cruzaSegmento(r, p, q, FOLGA_LINHA)));
    const trechos = [];
    for (let i = 1; i < a.pontos.length; i++) {
      const [p, s] = [a.pontos[i - 1], a.pontos[i]];
      const horizontal = Math.abs(s[1] - p[1]) < Math.abs(s[0] - p[0]);
      trechos.push({ p, s, c: Math.abs(s[0] - p[0]) + Math.abs(s[1] - p[1]), noFluxo: horizontal === (direcao !== 'DOWN') });
    }
    // Primeiro os trechos que atravessam o vão entre colunas (no sentido do fluxo), depois os demais.
    trechos.sort((t1, t2) => t2.noFluxo - t1.noFluxo || t2.c - t1.c);
    let achado = null;
    // Em cima da linha primeiro (a pílula cobre a aresta, como na referência); só então encostado ao
    // lado dela, a FOLGA_LADO px.
    for (const evitarBordas of [true, false]) {
      for (const lado of [0, 1, -1]) {
        for (const { p, s } of trechos) {
          const horizontal = Math.abs(s[1] - p[1]) < Math.abs(s[0] - p[0]);
          const ox = horizontal ? 0 : lado * (q.w / 2 + FOLGA_LADO);
          const oy = horizontal ? lado * (q.h / 2 + FOLGA_LADO) : 0;
          for (const [cx, cy] of centros(p, s, q.inicio)) {
            const r = { x: cx + ox - q.w / 2, y: cy + oy - q.h / 2, w: q.w, h: q.h };
            if (livre(r, evitarBordas)) { achado = r; break; }
          }
          if (achado) break;
        }
        if (achado) break;
      }
      if (achado) break;
    }
    if (!achado) return false;
    a.rotulo = { ...achado, linhas: q.linhas };
    ocupados.push(achado);
  }
  return true;
}
