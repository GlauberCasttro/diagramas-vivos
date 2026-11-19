// Layout da gramática "fluxo" com elkjs (layered + ORTHOGONAL), rodado no Node na geração.
// Zonas viram nós compostos (INCLUDE_CHILDREN). Saída: coordenadas absolutas, com o cabeçalho
// reservado no topo e a legenda no rodapé.
import ELK from 'elkjs/lib/elk.bundled.js';
import { ESTILO, quebrar, medir } from './texto.mjs';
import { ROTULO_LINHA } from './geometria.mjs';

export const CARD = { largura: 260, padX: 20, padY: 20, linhaNome: 22, linhaDescricao: 19, minAltura: 72 };
export const CABECALHO_ALTURA = 80; // título + subtítulo
export const LEGENDA_ALTURA = 56;
export const MARGEM = 32;
const ZONA_PAD = { topo: 44, lado: 24, base: 24 }; // topo inclui o nome da zona (ESTILO.zona)
const ROTULO_MAX = 160;
const ROTULO_PAD = 4;

const ESPACOS = {
  // viewer.html:1036-1041
  'elk.layered.spacing.nodeNodeBetweenLayers': '130',
  'elk.spacing.nodeNode': '32',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '8',
  'elk.spacing.edgeNode': '24',
};

export function alturaCard(linhasNome, linhasDescricao) {
  return Math.max(
    CARD.minAltura,
    CARD.padY + CARD.linhaNome * linhasNome + CARD.linhaDescricao * linhasDescricao + CARD.padY,
  );
}

export async function layoutFluxo(diagrama, fontes, opcoes = {}) {
  const direcao = opcoes.direcao || 'RIGHT';
  const conteudo = CARD.largura - 2 * CARD.padX;

  const cards = new Map();
  for (const n of diagrama.nos) {
    const linhasNome = quebrar(fontes, n.nome, ESTILO.nome, conteudo, 2);
    const linhasDescricao = n.descricao ? quebrar(fontes, n.descricao, ESTILO.descricao, conteudo, 3) : [];
    cards.set(n.id, { linhasNome, linhasDescricao, h: alturaCard(linhasNome.length, linhasDescricao.length) });
  }

  const elkNo = (n) => ({ id: n.id, width: CARD.largura, height: cards.get(n.id).h });
  const zonas = (diagrama.zonas || []).map((z) => ({
    id: z.id,
    layoutOptions: {
      'elk.padding': `[top=${ZONA_PAD.topo},left=${ZONA_PAD.lado},bottom=${ZONA_PAD.base},right=${ZONA_PAD.lado}]`,
      ...ESPACOS,
    },
    children: diagrama.nos.filter((n) => n.zona === z.id).map(elkNo),
  }));
  const soltos = diagrama.nos.filter((n) => !n.zona).map(elkNo);

  const rotulos = new Map();
  const edges = diagrama.arestas.map((a) => {
    // Aresta de retorno entra invertida no ELK: assim a quebra de ciclo nunca inverte o caminho
    // de ida (que manteria a ordem de leitura); os pontos são desinvertidos na saída.
    const volta = a.papel === 'retorno';
    const e = { id: a.id, sources: [volta ? a.para : a.de], targets: [volta ? a.de : a.para] };
    if (a.rotulo) {
      const linhas = quebrar(fontes, a.rotulo, ESTILO.rotulo, ROTULO_MAX, 2);
      const w = Math.ceil(Math.max(...linhas.map((l) => medir(fontes, l, ESTILO.rotulo)))) + 2 * ROTULO_PAD;
      const h = linhas.length * ROTULO_LINHA + 2 * ROTULO_PAD;
      rotulos.set(a.id, linhas);
      e.labels = [{ id: `${a.id}#rotulo`, text: a.rotulo, width: w, height: h }];
    }
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

  const res = await new ELK().layout(grafo);

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

  const saidaArestas = diagrama.arestas.map((a) => {
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
    if (a.papel === 'retorno') pontos.reverse();
    const saida = { id: a.id, pontos };
    if (rotulos.has(a.id)) {
      const l = e.labels[0];
      const [x, y] = P(o.x + l.x, o.y + l.y);
      saida.rotulo = { x, y, w: l.width, h: l.height, linhas: rotulos.get(a.id) };
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
}
