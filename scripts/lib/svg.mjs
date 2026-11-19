// Emissão do SVG animado (sem JS e sem objeto estrangeiro HTML) no visual do floorplan.
// Estrutura estável para o stepper (Task 6): cada nó é <g class="no papel-X" data-id>, cada aresta é
// <g class="aresta papel-X" data-id> com path.trace (com marker-end) e path.flow.
import { readFileSync } from 'node:fs';
import { medir, ESTILO } from './texto.mjs';
import { CARD, MARGEM } from './layout-fluxo.mjs';
import { PAPEIS } from './cores.mjs';
import { PAPEIS_NO, PAPEIS_ARESTA } from './modelo.mjs';

const ASSETS = new URL('../../assets/', import.meta.url);
const lerAsset = (rel, enc) => readFileSync(new URL(rel, ASSETS), enc);

let _css = null;
function cssBase() {
  if (!_css) {
    // Só Inter é usada no SVG (todos os estilos de texto são sans); JetBrains Mono fica de fora para
    // poupar ~54 KB do orçamento de 150 KB.
    const inter = lerAsset('fonts/inter-latin-wght-normal.woff2').toString('base64');
    _css = {
      fontes: `@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${inter}) format("woff2")}`,
      tokens: lerAsset('tokens.css', 'utf8'),
      diagrama: lerAsset('diagrama.css', 'utf8'),
    };
  }
  return _css;
}

const ANIMACAO = `.aresta.corre .flow, .aresta.hl .flow { animation: fluxo 1.1s linear infinite; }
@keyframes fluxo { to { stroke-dashoffset: -24; } }`;

export function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const n1 = (v) => Math.round(v * 10) / 10;

const ROTULO_NO = {
  feliz: 'etapa do caminho feliz',
  gate: 'gate',
  memoria: 'memória / estado',
  neutro: 'passo neutro',
  externo: 'sistema externo',
};
const ROTULO_ARESTA = { sequencia: 'sequência', feliz: 'caminho feliz', retorno: 'retorno', falha: 'falha' };

const EST = {
  subtitulo: { familia: 'sans', peso: 400, tamanho: 13 },
  legenda: { familia: 'sans', peso: 500, tamanho: 12 },
  rodape: { familia: 'sans', peso: 500, tamanho: 12 },
  selo: { familia: 'sans', peso: 600, tamanho: 10.5 },
};

// Arestas papel "feliz" referenciadas nos passos do primeiro flow: as únicas que correm em repouso.
export function caminhoFeliz(diagrama) {
  const refs = new Set((diagrama.flows?.[0]?.passos || []).map((p) => p.ref));
  return new Set(diagrama.arestas.filter((a) => a.papel === 'feliz' && refs.has(a.id)).map((a) => a.id));
}

// Baseline de uma linha de texto centrada verticalmente na caixa da linha.
const baseline = (topo, alturaLinha, tamanho) => topo + alturaLinha / 2 + tamanho * 0.35;

function selo(fontes, x, y) {
  const w = Math.ceil(medir(fontes, 'proposto', EST.selo)) + 14;
  const h = 16;
  return `<g class="selo"><rect x="${n1(x)}" y="${n1(y)}" width="${w}" height="${h}" rx="8"/><text x="${n1(x + w / 2)}" y="${n1(baseline(y, h, 10.5))}" text-anchor="middle">proposto</text></g>`;
}

function emitirNo(no, caixa, fontes) {
  const cls = ['no', `papel-${no.papel}`, no.nivel === 'proposto' ? 'proposto' : null].filter(Boolean).join(' ');
  const { x, y, w, h, linhasNome, linhasDescricao } = caixa;
  const conteudo = linhasNome.length * CARD.linhaNome + linhasDescricao.length * CARD.linhaDescricao;
  let topo = y + (h - conteudo) / 2;
  const tx = n1(x + CARD.padX);
  const spans = [];
  for (const l of linhasNome) {
    spans.push(`<tspan class="nome" x="${tx}" y="${n1(baseline(topo, CARD.linhaNome, ESTILO.nome.tamanho))}">${esc(l)}</tspan>`);
    topo += CARD.linhaNome;
  }
  for (const l of linhasDescricao) {
    spans.push(`<tspan class="descricao" x="${tx}" y="${n1(baseline(topo, CARD.linhaDescricao, ESTILO.descricao.tamanho))}">${esc(l)}</tspan>`);
    topo += CARD.linhaDescricao;
  }
  let s = `<g class="${cls}" data-id="${esc(no.id)}"><rect class="card" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="20"/><text>${spans.join('')}</text>`;
  if (no.nivel === 'proposto') {
    const sw = Math.ceil(medir(fontes, 'proposto', EST.selo)) + 14;
    s += selo(fontes, x + w - 18 - sw, y - 8);
  }
  return `${s}</g>\n`;
}

function emitirAresta(aresta, geo, corre, fontes) {
  const cls = ['aresta', `papel-${aresta.papel}`, corre ? 'corre' : null, aresta.nivel === 'proposto' ? 'proposto' : null]
    .filter(Boolean)
    .join(' ');
  const d = geo.pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${n1(x)},${n1(y)}`).join(' ');
  let s = `<g class="${cls}" data-id="${esc(aresta.id)}"><path class="trace" d="${d}" marker-end="url(#seta-${aresta.papel})"/><path class="flow" d="${d}"/>`;
  const r = geo.rotulo;
  if (r) {
    const lh = r.h / r.linhas.length;
    const linhas = r.linhas
      .map((l, i) => `<tspan x="${n1(r.x + r.w / 2)}" y="${n1(baseline(r.y + i * lh, lh, ESTILO.rotulo.tamanho))}">${esc(l)}</tspan>`)
      .join('');
    s += `<g class="rotulo"><rect x="${n1(r.x)}" y="${n1(r.y)}" width="${n1(r.w)}" height="${n1(r.h)}" rx="6"/><text text-anchor="middle">${linhas}</text></g>`;
  }
  if (aresta.nivel === 'proposto') {
    const sw = Math.ceil(medir(fontes, 'proposto', EST.selo)) + 14;
    let cx;
    let cy;
    if (r) {
      cx = r.x + r.w / 2;
      cy = r.y + r.h + 2 + 8;
    } else {
      // meio do segmento mais longo
      let melhor = 0;
      for (let i = 1; i < geo.pontos.length; i++) {
        const [x0, y0] = geo.pontos[i - 1];
        const [x1, y1] = geo.pontos[i];
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len > melhor) {
          melhor = len;
          cx = (x0 + x1) / 2;
          cy = (y0 + y1) / 2;
        }
      }
    }
    s += selo(fontes, cx - sw / 2, cy - 8);
  }
  return `${s}</g>\n`;
}

function emitirZona(z) {
  return `<g class="zona" data-id="${esc(z.id)}"><rect x="${n1(z.x)}" y="${n1(z.y)}" width="${n1(z.w)}" height="${n1(z.h)}" rx="24"/></g>\n`;
}

// Nome da zona fica num grupo acima das arestas (com halo do fundo, ver diagrama.css): em DOWN as
// arestas entram na zona pela faixa do nome e não podem riscar o texto.
function emitirNomeZona(z) {
  return `<text data-zona="${esc(z.id)}" x="${n1(z.x + 24)}" y="${n1(z.y + 28)}">${esc(z.nome)}</text>\n`;
}

// Itens da legenda: só papéis/estilos presentes no diagrama, na ordem canônica.
function itensLegenda(diagrama) {
  const nos = new Set(diagrama.nos.map((n) => n.papel));
  const arestas = new Set(diagrama.arestas.map((a) => a.papel));
  const itens = [];
  for (const p of PAPEIS_NO) if (nos.has(p)) itens.push({ tipo: 'no', papel: p, texto: ROTULO_NO[p] });
  for (const p of PAPEIS_ARESTA) if (arestas.has(p)) itens.push({ tipo: 'aresta', papel: p, texto: ROTULO_ARESTA[p] });
  if ([...diagrama.nos, ...diagrama.arestas].some((x) => x.nivel === 'proposto')) itens.push({ tipo: 'proposto', texto: 'proposto' });
  return itens;
}

const AMOSTRA = 22;
const AMOSTRA_GAP = 8;
const ITEM_GAP = 24;

function larguraLegenda(itens, fontes) {
  return itens.reduce((s, it, i) => s + (i ? ITEM_GAP : 0) + AMOSTRA + AMOSTRA_GAP + medir(fontes, it.texto, EST.legenda), 0);
}

function emitirLegenda(itens, fontes, y0, altura) {
  const cy = y0 + altura / 2;
  let x = MARGEM;
  const partes = itens.map((it) => {
    let amostra;
    let cls;
    if (it.tipo === 'aresta') {
      cls = `item papel-${it.papel}`;
      const tracejada = it.papel === 'retorno' || it.papel === 'falha' ? ' stroke-dasharray="5 4"' : '';
      amostra = `<line class="amostra-aresta" x1="${n1(x + 1)}" y1="${n1(cy)}" x2="${n1(x + AMOSTRA - 1)}" y2="${n1(cy)}"${tracejada}/>`;
    } else {
      cls = it.tipo === 'proposto' ? 'item proposto' : `item papel-${it.papel}`;
      amostra = `<rect class="amostra-no" x="${n1(x + 1)}" y="${n1(cy - 6)}" width="${AMOSTRA - 2}" height="12" rx="4"/>`;
    }
    const tx = x + AMOSTRA + AMOSTRA_GAP;
    const s = `<g class="${cls}">${amostra}<text x="${n1(tx)}" y="${n1(cy + 12 * 0.35)}">${esc(it.texto)}</text></g>`;
    x = tx + medir(fontes, it.texto, EST.legenda) + ITEM_GAP;
    return s;
  });
  return `<g class="legenda">${partes.join('')}</g>\n`;
}

function marcadores(diagrama) {
  const usados = PAPEIS_ARESTA.filter((p) => diagrama.arestas.some((a) => a.papel === p));
  return usados
    .map(
      (p) =>
        `<marker id="seta-${p}" class="seta papel-${p}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,1 L9,5 L1,9 z"/></marker>`,
    )
    .join('');
}

export function emitirSvg(diagrama, layout, fontes, opcoes = {}) {
  const tema = opcoes.tema === 'claro' ? 'claro' : 'escuro';
  const animar = opcoes.animar !== false;
  const css = cssBase();

  const titulo = String(diagrama.titulo);
  const subtitulo = diagrama.subtitulo ? String(diagrama.subtitulo) : '';
  const rodape = `tipo ${diagrama.tipo} · ${diagrama.gramatica}`;
  const itens = itensLegenda(diagrama);

  // O layout mede só o conteúdo do ELK: se cabeçalho ou legenda+rodapé forem mais largos, alarga o canvas.
  const largura = Math.ceil(
    Math.max(
      layout.largura,
      2 * MARGEM + medir(fontes, titulo, ESTILO.titulo),
      2 * MARGEM + (subtitulo ? medir(fontes, subtitulo, EST.subtitulo) : 0),
      2 * MARGEM + larguraLegenda(itens, fontes) + 32 + medir(fontes, rodape, EST.rodape),
    ),
  );
  const altura = Math.ceil(layout.altura);

  const cab = layout.cabecalho;
  const yTitulo = subtitulo ? cab.y + 42 : cab.y + 50;
  const cabecalho =
    `<text class="titulo" x="${MARGEM}" y="${yTitulo}">${esc(titulo)}</text>` +
    (subtitulo ? `<text class="subtitulo" x="${MARGEM}" y="${cab.y + 64}">${esc(subtitulo)}</text>` : '');

  const porIdNo = new Map(layout.nos.map((n) => [n.id, n]));
  const porIdAresta = new Map(layout.arestas.map((a) => [a.id, a]));
  // Layout incompleto é erro de quem chamou: nunca some um nó ou aresta do desenho em silêncio.
  for (const n of diagrama.nos) if (!porIdNo.has(n.id)) throw new Error(`emitirSvg: nó "${n.id}" ausente no layout`);
  for (const a of diagrama.arestas)
    if (!porIdAresta.has(a.id)) throw new Error(`emitirSvg: aresta "${a.id}" ausente no layout`);
  const corre = caminhoFeliz(diagrama);

  const zonas = (layout.zonas || []).map(emitirZona).join('');
  const nomesZona = (layout.zonas || []).map(emitirNomeZona).join('');
  const arestas = diagrama.arestas
    .map((a) => emitirAresta(a, porIdAresta.get(a.id), corre.has(a.id), fontes))
    .join('');
  const nos = diagrama.nos
    .map((n) => emitirNo(n, porIdNo.get(n.id), fontes))
    .join('');

  const leg = layout.legenda;
  const legenda = emitirLegenda(itens, fontes, leg.y, leg.altura);
  const yRodape = n1(leg.y + leg.altura / 2 + 12 * 0.35);

  const estilo = [css.fontes, css.tokens, css.diagrama, animar ? ANIMACAO : ''].join('\n');
  const tema_attr = tema === 'claro' ? ' data-theme="light"' : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="${esc(titulo)}"${tema_attr}>\n` +
    `<title>${esc(titulo)}</title>\n` +
    `<style>\n${estilo}\n</style>\n` +
    `<defs>${marcadores(diagrama)}</defs>\n` +
    `<rect class="fundo" x="0" y="0" width="${largura}" height="${altura}" fill="${PAPEIS[tema].fundo}"/>\n` +
    `<g class="cabecalho">${cabecalho}</g>\n` +
    `<g class="zonas">\n${zonas}</g>\n` +
    `<g class="arestas">\n${arestas}</g>\n` +
    `<g class="nomes-zona">\n${nomesZona}</g>\n` +
    `<g class="nos">\n${nos}</g>\n` +
    legenda +
    `<text class="rodape" x="${largura - MARGEM}" y="${yRodape}" text-anchor="end">${esc(rodape)}</text>\n` +
    `</svg>\n`
  );
}
