// Portions derived from floorplan (MIT) (c) 2026 Hayden Smith
// Emissão do SVG animado (sem JS e sem objeto estrangeiro HTML) no visual da referência escolhida pelo
// dono (docs/referencia-visual/02-agente.svg, derivada do floorplan): tema claro por padrão, grade de
// pontos, cards brancos com ladrilho de ícone, cor da aresta pelo tipo, portas nas pontas.
// Estrutura estável para o stepper (Task 6) e para a animação SMIL (Task 14):
// - nó: <g id="n-<id>" class="no papel-X icone-Y" data-id>;
// - aresta: <g class="aresta [volta] papel-X tipo-Y" data-id> com path#a-<id>.trace e path.flow; a volta
//   (adendo 1/2) é a aresta `<id>~volta` do Layout: data-id="<id>~volta" e path#a-<id>--volta ("~" não
//   entra em id do DOM; o modelo reserva o sufixo "--volta");
// - por cima dos cards: <g class="portas"> com rótulo em pílula, portas e chevron de cada aresta;
// - cenários vivos (adendo 2, itens 1–6): <g id="requisicao"> com um token por passo de aresta
//   (animateMotion m1..mN encadeados em loop), contorno de chegada piscando nos cards, .flow visível só
//   enquanto o cenário da aresta toca e uma linha por flow no rodapé. Tudo SMIL, sem JS.
import { readFileSync } from 'node:fs';
import { medir, ESTILO } from './texto.mjs';
import { CARD, MARGEM, SUFIXO_VOLTA, geometriaCard } from './layout-fluxo.mjs';
import { PAPEIS } from './cores.mjs';
import { TIPOS_ARESTA } from './modelo.mjs';

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

// O tracejado corre em todas as arestas; quem decide se aparece é o atributo opacity (SMIL no SVG vivo,
// .hl/.dim no passo a passo do HTML).
const ANIMACAO = `.aresta .flow { animation: fluxo 1.1s linear infinite; }
@keyframes fluxo { to { stroke-dashoffset: -24; } }`;

export function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const n1 = (v) => Math.round(v * 10) / 10;

// Id do DOM de uma aresta do Layout: a volta `<id>~volta` vira `<id>--volta`.
export const idDom = (id) => (id.endsWith(SUFIXO_VOLTA) ? id.slice(0, -SUFIXO_VOLTA.length) + '--volta' : id);

// Polilinha ortogonal com cantos arredondados (spec §7.4), como o roundedPath do floorplan
// (viewer.html:1047-1060). A curva fica dentro do triângulo do cotovelo, a no máximo `r` px dele; a
// verificação de geometria continua sobre a polilinha. O último trecho é sempre reta: o chevron segue
// alinhado. Pontos colineares não ganham curva.
export function caminhoArredondado(pontos, r = 10) {
  const [x0, y0] = pontos[0];
  let d = `M${n1(x0)},${n1(y0)}`;
  for (let i = 1; i < pontos.length - 1; i++) {
    const [ax, ay] = pontos[i - 1];
    const [bx, by] = pontos[i];
    const [cx, cy] = pontos[i + 1];
    const d1 = Math.hypot(bx - ax, by - ay);
    const d2 = Math.hypot(cx - bx, cy - by);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const colinear = Math.abs((bx - ax) * (cy - by) - (by - ay) * (cx - bx)) < 1e-9;
    if (!rr || colinear) {
      d += ` L${n1(bx)},${n1(by)}`;
      continue;
    }
    const p1 = [bx + ((ax - bx) * rr) / d1, by + ((ay - by) * rr) / d1];
    const p2 = [bx + ((cx - bx) * rr) / d2, by + ((cy - by) * rr) / d2];
    d += ` L${n1(p1[0])},${n1(p1[1])} Q${n1(bx)},${n1(by)} ${n1(p2[0])},${n1(p2[1])}`;
  }
  const [zx, zy] = pontos[pontos.length - 1];
  return `${d} L${n1(zx)},${n1(zy)}`;
}

// Ícones em traço numa caixa 30×30 (mesmo estilo da referência: pessoa, servico, ferramenta e banco
// vêm de 02-agente.svg; os demais foram desenhados no mesmo traço).
export const ICONES_PATH = {
  pessoa: 'M15 14a3 3 0 1 0 0-6a3 3 0 1 0 0 6 M9 22c0-4.5 12-4.5 12 0',
  servico: 'M8 8h14v5H8z M8 17h14v5H8z',
  ferramenta: 'M8 9h14v12H8z M11 13l3 2-3 2 M16 17.5h3',
  banco: 'M9 10.5c0-3 12-3 12 0v9c0 3-12 3-12 0z M9 10.5c0 3 12 3 12 0',
  gate: 'M15 7.5l6.5 2.5v4.5c0 4-2.8 6.6-6.5 8c-3.7-1.4-6.5-4-6.5-8V10z M12.2 15l2 2 3.6-3.6',
  externo: 'M22 15a7 7 0 1 1-14 0a7 7 0 1 1 14 0z M8 15h14 M15 8c2.6 3.2 2.6 10.8 0 14 M15 8c-2.6 3.2-2.6 10.8 0 14',
  fila: 'M7.5 11h4v8h-4z M13 11h4v8h-4z M18.5 11h4v8h-4z',
  documento: 'M10 7.5h6.5l3.5 3.5v11.5H10z M16.5 7.5V11H20 M12.5 15h5 M12.5 18.5h5',
  agente: 'M15 7.5l1.8 5.7 5.7 1.8-5.7 1.8L15 22.5l-1.8-5.7L7.5 15l5.7-1.8z',
};

// Ícone padrão quando o nó não traz `icone`.
const ICONE_DO_PAPEL = { gate: 'gate', memoria: 'banco', externo: 'externo', feliz: 'servico', neutro: 'servico' };
export const iconeDe = (no) => no.icone || ICONE_DO_PAPEL[no.papel] || 'servico';
const tipoDe = (aresta) => aresta.tipo || 'chamada';

const ROTULO_TIPO = { chamada: 'chamada', rpc: 'RPC', dados: 'dados', evento: 'evento', fila: 'fila' };

const EST = {
  subtitulo: { familia: 'sans', peso: 400, tamanho: 13 },
  legenda: { familia: 'sans', peso: 500, tamanho: 12 },
  rodape: { familia: 'sans', peso: 500, tamanho: 12 },
  selo: { familia: 'sans', peso: 400, tamanho: 11.5 },
  cen: { familia: 'sans', peso: 600, tamanho: 12.5 },
};

// Arestas papel "feliz" referenciadas nos passos do primeiro flow: as únicas que correm em repouso.
export function caminhoFeliz(diagrama) {
  const refs = new Set((diagrama.flows?.[0]?.passos || []).map((p) => p.ref));
  return new Set(diagrama.arestas.filter((a) => a.papel === 'feliz' && refs.has(a.id)).map((a) => a.id));
}

function emitirNo(no, caixa, fontes, vivo) {
  const icone = iconeDe(no);
  const cls = ['no', `papel-${no.papel}`, `icone-${icone}`, no.nivel === 'proposto' ? 'proposto' : null].filter(Boolean).join(' ');
  const { x, y, w, h, linhasNome, linhasDescricao } = caixa;
  const g = geometriaCard(linhasNome.length, linhasDescricao.length, Boolean(no.selo));
  const ix = x + CARD.padX;
  const iy = y + CARD.padY;
  const spans = [];
  linhasNome.forEach((l, i) => spans.push(`<tspan class="nome" x="${n1(x + CARD.nomeX)}" y="${n1(y + g.nome[i])}">${esc(l)}</tspan>`));
  linhasDescricao.forEach((l, j) =>
    spans.push(`<tspan class="descricao" x="${n1(ix)}" y="${n1(y + g.descricao[j])}">${esc(l)}</tspan>`),
  );
  let s =
    `<g id="n-${esc(no.id)}" class="${cls}" data-id="${esc(no.id)}">` +
    `<rect class="card" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="20"/>` +
    `<rect class="ladrilho" x="${n1(ix)}" y="${n1(iy)}" width="${CARD.icone}" height="${CARD.icone}" rx="10"/>` +
    `<path class="icone" transform="translate(${n1(ix)},${n1(iy)})" d="${ICONES_PATH[icone]}"/>` +
    `<text>${spans.join('')}</text>`;
  if (no.selo) {
    const sw = Math.ceil(medir(fontes, no.selo, EST.selo)) + 16;
    const sy = y + g.seloY;
    s += `<g class="selo"><rect x="${n1(ix)}" y="${n1(sy)}" width="${sw}" height="${CARD.selo}" rx="${CARD.selo / 2}"/><text x="${n1(ix + 8)}" y="${n1(sy + 14.5)}">${esc(no.selo)}</text></g>`;
  }
  // Chegada (adendo 2, item 3): o contorno pisca 0,7 s quando o token chega (ou sai, no 1º passo do flow);
  // passo que é o próprio nó entra na cadeia como um <animate id="mK"> deste contorno.
  const ch = vivo?.chegada.get(no.id);
  if (ch && (ch.begins.length || ch.passos.length)) {
    const pisca = ch.begins.length
      ? `<animate attributeName="opacity" values="0;1;0" dur="0.7s" begin="${ch.begins.join(';')}"/>`
      : '';
    const passos = ch.passos.map((e) => `<animate id="${e.id}" attributeName="opacity" values="0;1;0" dur="0.7s" begin="${e.begin}"/>`).join('');
    s += `<rect class="chegada" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="20" opacity="0">${pisca}${passos}</rect>`;
  }
  return `${s}</g>\n`;
}

// Traço e fluxo da aresta (abaixo dos cards).
function emitirAresta(id, aresta, geo, { volta, corre }, vivo) {
  const ret = volta || aresta.papel === 'retorno' || aresta.papel === 'falha';
  const cls = [
    'aresta',
    volta ? 'volta' : null,
    `papel-${aresta.papel}`,
    `tipo-${tipoDe(aresta)}`,
    corre ? 'corre' : null,
    aresta.nivel === 'proposto' ? 'proposto' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const d = caminhoArredondado(geo.pontos);
  // Sem animação, o caminho feliz fica visível parado; com animação, o SMIL liga o .flow no cenário.
  const sets = vivo?.sets.get(id) || [];
  const op = vivo ? '0' : corre ? '.95' : '0';
  const flow = sets.length ? `<path class="flow" d="${d}" opacity="${op}">${sets.join('')}</path>` : `<path class="flow" d="${d}" opacity="${op}"/>`;
  return `<g class="${cls}" data-id="${esc(id)}"><path id="a-${esc(idDom(id))}" class="trace${ret ? ' ret' : ''}" d="${d}"/>${flow}</g>\n`;
}

// Rótulo em pílula, portas nas pontas e, nas arestas de retorno, chevron na chegada (acima dos cards).
function emitirTopo(id, aresta, geo, { volta }) {
  const ret = volta || aresta.papel === 'retorno' || aresta.papel === 'falha';
  let s = `<g class="tipo-${tipoDe(aresta)}" data-aresta="${esc(id)}">`;
  const r = geo.rotulo;
  if (r) {
    const lh = r.h / r.linhas.length;
    const linhas = r.linhas
      .map((l, i) => `<tspan x="${n1(r.x + r.w / 2)}" y="${n1(r.y + i * lh + lh / 2 + ESTILO.rotulo.tamanho * 0.35)}">${esc(l)}</tspan>`)
      .join('');
    s += `<g class="rotulo"><rect x="${n1(r.x)}" y="${n1(r.y)}" width="${n1(r.w)}" height="${n1(r.h)}" rx="6"/><text text-anchor="middle">${linhas}</text></g>`;
  }
  const p = geo.pontos;
  const [ax, ay] = p[0];
  const [zx, zy] = p[p.length - 1];
  s += `<circle class="port" cx="${n1(ax)}" cy="${n1(ay)}" r="3.4"/><circle class="port" cx="${n1(zx)}" cy="${n1(zy)}" r="3.4"/>`;
  if (ret && p.length >= 2) {
    const [px, py] = p[p.length - 2];
    const ang = n1((Math.atan2(zy - py, zx - px) * 180) / Math.PI);
    s += `<path class="chevron" d="M-13,-4 L-6,0 L-13,4" transform="translate(${n1(zx)},${n1(zy)}) rotate(${ang})"/>`;
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

// Itens da legenda, como na referência: tipos de ligação usados (ordem canônica), retorno, proposto; e
// gate quando houver nó gate (o único papel que muda a cor do card).
function itensLegenda(diagrama) {
  const tipos = new Set(diagrama.arestas.map(tipoDe));
  const itens = TIPOS_ARESTA.filter((t) => tipos.has(t)).map((t) => ({ k: 'tipo', tipo: t, texto: ROTULO_TIPO[t] }));
  const temRet = diagrama.arestas.some((a) => a.resposta || a.papel === 'retorno' || a.papel === 'falha');
  if (temRet) itens.push({ k: 'retorno', texto: 'retorno' });
  if ([...diagrama.nos, ...diagrama.arestas].some((x) => x.nivel === 'proposto')) itens.push({ k: 'proposto', texto: 'proposto' });
  if (diagrama.nos.some((n) => n.papel === 'gate')) itens.push({ k: 'gate', texto: 'gate' });
  return itens;
}

const AMOSTRA = 28;
const AMOSTRA_GAP = 10;
const ITEM_GAP = 24;

function larguraLegenda(itens, fontes) {
  return itens.reduce((s, it, i) => s + (i ? ITEM_GAP : 0) + AMOSTRA + AMOSTRA_GAP + medir(fontes, it.texto, EST.legenda), 0);
}

function emitirLegenda(itens, fontes, y0, largura) {
  const cy = y0 + 22;
  let x = MARGEM;
  const partes = itens.map((it) => {
    let amostra;
    let cls = `item ${it.k}`;
    if (it.k === 'tipo') {
      cls += ` tipo-${it.tipo}`;
      amostra =
        `<path class="amostra" d="M${n1(x)},${n1(cy)} L${n1(x + AMOSTRA)},${n1(cy)}"/>` +
        `<circle class="port" cx="${n1(x)}" cy="${n1(cy)}" r="3.4"/><circle class="port" cx="${n1(x + AMOSTRA)}" cy="${n1(cy)}" r="3.4"/>`;
    } else if (it.k === 'retorno') {
      amostra = `<path class="amostra ret" d="M${n1(x)},${n1(cy)} L${n1(x + AMOSTRA)},${n1(cy)}"/>`;
    } else if (it.k === 'proposto') {
      amostra = `<rect x="${n1(x)}" y="${n1(cy - 8)}" width="${AMOSTRA}" height="16" rx="5"/>`;
    } else {
      amostra = `<rect x="${n1(x + 6)}" y="${n1(cy - 8)}" width="16" height="16" rx="5"/>`;
    }
    const tx = x + AMOSTRA + AMOSTRA_GAP;
    const s = `<g class="${cls}">${amostra}<text x="${n1(tx)}" y="${n1(cy + 4)}">${esc(it.texto)}</text></g>`;
    x = tx + medir(fontes, it.texto, EST.legenda) + ITEM_GAP;
    return s;
  });
  const sep = `<line class="separador" x1="${MARGEM}" y1="${n1(y0)}" x2="${largura - MARGEM}" y2="${n1(y0)}"/>`;
  return `<g class="legenda">${sep}${partes.join('')}</g>\n`;
}

// ---------- cenários vivos (adendo 2, itens 1–6) ----------
const RITMO = { inicio: 0.5, salto: 0.25, entreFlows: 1.1, porPx: 0.38 / 120, minimo: 0.3, cauda: 0.5 };
const comprimento = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const SETA = ' \u2192 ';
// Opacidade das linhas de cenário em repouso: >= 4,5:1 composta sobre o fundo nos dois temas (teste em svg.test).
export const CEN_REPOUSO = '.8';

// Cadeia SMIL: um elemento por passo (animateMotion para aresta, animate do contorno para nó), ids
// m1..mN na ordem dos flows; cada um começa 0,25 s depois do anterior (1,1 s entre flows) e o primeiro
// recomeça 1,1 s depois do último (loop).
export function cenarios(diagrama, layout) {
  const geo = new Map(layout.arestas.map((a) => [a.id, a]));
  const arestas = new Map(diagrama.arestas.map((a) => [a.id, a]));
  const nomes = new Map(diagrama.nos.map((n) => [n.id, n.nome]));
  const cadeia = [];
  const flows = [];
  for (const f of diagrama.flows || []) {
    const ini = cadeia.length;
    const rota = [];
    const marcar = (no) => { if (rota[rota.length - 1] !== no) rota.push(no); };
    for (const p of f.passos || []) {
      const a = arestas.get(p.ref);
      const k = cadeia.length + 1;
      if (a) {
        const volta = p.sentido === 'volta';
        const idLayout = volta ? a.id + SUFIXO_VOLTA : a.id;
        const g = geo.get(idLayout);
        if (!g) throw new Error(`emitirSvg: aresta "${idLayout}" do flow ${f.id} ausente no layout`);
        const origem = volta ? a.para : a.de;
        const chegada = volta ? a.de : a.para;
        const dur = Math.round(Math.max(RITMO.minimo, comprimento(g.pontos) * RITMO.porPx) * 100) / 100;
        cadeia.push({ id: `m${k}`, tipo: 'aresta', idLayout, origem, chegada, dur, primeiro: cadeia.length === ini });
        marcar(origem);
        marcar(chegada);
      } else {
        cadeia.push({ id: `m${k}`, tipo: 'no', no: p.ref, primeiro: cadeia.length === ini });
        marcar(p.ref);
      }
    }
    if (cadeia.length > ini) flows.push({ f, ini, fim: cadeia.length - 1, rota: rota.map((n) => nomes.get(n) ?? n) });
  }
  const N = cadeia.length;
  cadeia.forEach((e, i) => {
    if (i === 0) e.begin = `${RITMO.inicio}s;m${N}.end+${RITMO.entreFlows}s`;
    else e.begin = `m${i}.end+${e.primeiro ? RITMO.entreFlows : RITMO.salto}s`;
  });

  const chegada = new Map();
  const ch = (no) => chegada.get(no) || chegada.set(no, { begins: [], passos: [] }).get(no);
  const sets = new Map();
  for (const fl of flows) {
    const fimFlow = `m${fl.fim + 1}.end+${RITMO.cauda}s`;
    const vistos = new Set();
    for (let i = fl.ini; i <= fl.fim; i++) {
      const e = cadeia[i];
      if (e.tipo === 'no') { ch(e.no).passos.push(e); continue; }
      if (e.primeiro) ch(e.origem).begins.push(`${e.id}.begin`);
      ch(e.chegada).begins.push(`${e.id}.end`);
      if (!vistos.has(e.idLayout)) {
        vistos.add(e.idLayout);
        const l = sets.get(e.idLayout) || sets.set(e.idLayout, []).get(e.idLayout);
        l.push(`<set attributeName="opacity" to=".95" begin="${e.id}.begin" end="${fimFlow}"/>`);
      }
    }
    fl.begin = `m${fl.ini + 1}.begin`;
    fl.end = fimFlow;
  }
  for (const c of chegada.values()) c.begins = [...new Set(c.begins)];
  return { cadeia, flows, chegada, sets };
}

function emitirTokens(vivo) {
  const tokens = vivo.cadeia
    .filter((e) => e.tipo === 'aresta')
    .map(
      (e) =>
        `<circle class="token" r="3.4" opacity="0"><set attributeName="opacity" to="1" begin="${e.id}.begin" end="${e.id}.end"/>` +
        `<animateMotion id="${e.id}" dur="${e.dur}s" begin="${e.begin}" calcMode="linear"><mpath href="#a-${esc(idDom(e.idLayout))}"/></animateMotion></circle>\n`,
    )
    .join('');
  return `<g id="requisicao">\n${tokens}</g>\n`;
}

// Uma linha por flow: "N. Título: A → B → …", truncada com "…" se não couber.
function linhaCenario(fontes, i, fl, max) {
  const n = `${i + 1}. ${fl.f.titulo}`;
  let partes = fl.rota.slice();
  let resto = `: ${partes.join(SETA)}`;
  while (partes.length > 1 && medir(fontes, n + resto, EST.cen) > max) {
    partes = partes.slice(0, -1);
    resto = `: ${partes.join(SETA)}${SETA}\u2026`;
  }
  return { n, resto };
}

export function emitirSvg(diagrama, layout, fontes, opcoes = {}) {
  const tema = opcoes.tema === 'escuro' ? 'escuro' : 'claro';
  const animar = opcoes.animar !== false;
  const vivo = animar ? cenarios(diagrama, layout) : null;
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
  // Linhas dos cenários (adendo 2, item 5) abaixo da legenda: o canvas cresce para caber.
  const yCen = (i) => layout.legenda.y + 52 + i * 22;
  const nCen = vivo ? vivo.flows.length : 0;
  const altura = Math.ceil(nCen ? Math.max(layout.altura, yCen(nCen - 1) + 20) : layout.altura);

  const cab = layout.cabecalho;
  // Referência: 28 px entre a linha de base do título e a do subtítulo.
  const yTitulo = subtitulo ? cab.y + 40 : cab.y + 50;
  const cabecalho =
    `<text class="titulo" x="${MARGEM}" y="${yTitulo}">${esc(titulo)}</text>` +
    (subtitulo ? `<text class="subtitulo" x="${MARGEM}" y="${cab.y + 68}">${esc(subtitulo)}</text>` : '');

  const porIdNo = new Map(layout.nos.map((n) => [n.id, n]));
  const porIdAresta = new Map(layout.arestas.map((a) => [a.id, a]));
  const modeloAresta = new Map(diagrama.arestas.map((a) => [a.id, a]));
  // Layout incompleto é erro de quem chamou: nunca some um nó ou aresta do desenho em silêncio.
  for (const n of diagrama.nos) if (!porIdNo.has(n.id)) throw new Error(`emitirSvg: nó "${n.id}" ausente no layout`);
  for (const a of diagrama.arestas) {
    if (!porIdAresta.has(a.id)) throw new Error(`emitirSvg: aresta "${a.id}" ausente no layout`);
    if (a.resposta && !porIdAresta.has(a.id + SUFIXO_VOLTA))
      throw new Error(`emitirSvg: volta "${a.id}${SUFIXO_VOLTA}" ausente no layout`);
  }
  const corre = caminhoFeliz(diagrama);

  // Arestas na ordem do Layout (a volta vem logo depois da ida).
  const desenho = layout.arestas.map((geo) => {
    const volta = geo.id.endsWith(SUFIXO_VOLTA);
    const base = volta ? geo.id.slice(0, -SUFIXO_VOLTA.length) : geo.id;
    const aresta = modeloAresta.get(base);
    if (!aresta) throw new Error(`emitirSvg: aresta "${geo.id}" do layout sem aresta no modelo`);
    return { id: geo.id, aresta, geo, volta, corre: !volta && corre.has(base) };
  });

  const zonas = (layout.zonas || []).map(emitirZona).join('');
  const nomesZona = (layout.zonas || []).map(emitirNomeZona).join('');
  const arestas = desenho.map((e) => emitirAresta(e.id, e.aresta, e.geo, e, vivo)).join('');
  const topo = desenho.map((e) => emitirTopo(e.id, e.aresta, e.geo, e)).join('');
  const nos = diagrama.nos.map((n) => emitirNo(n, porIdNo.get(n.id), fontes, vivo)).join('');

  const leg = layout.legenda;
  const legenda = emitirLegenda(itens, fontes, leg.y, largura);
  const yRodape = n1(leg.y + 22 + 4);
  const cen = vivo
    ? vivo.flows
        .map((fl, i) => {
          const { n, resto } = linhaCenario(fontes, i, fl, largura - 2 * MARGEM);
          return `<text class="cen" x="${MARGEM}" y="${n1(yCen(i))}" opacity="${CEN_REPOUSO}"><tspan class="n">${esc(n)}</tspan><tspan>${esc(resto)}</tspan><set attributeName="opacity" to="1" begin="${fl.begin}" end="${fl.end}"/></text>\n`;
        })
        .join('')
    : '';

  const estilo = [css.fontes, css.tokens, css.diagrama, animar ? ANIMACAO : ''].join('\n');
  const temaAttr = tema === 'escuro' ? ' data-theme="dark"' : '';
  const grade = tema === 'escuro' ? '#262626' : '#d2d2ce';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="${esc(titulo)}"${temaAttr}>\n` +
    `<title>${esc(titulo)}</title>\n` +
    `<style>\n${estilo}\n</style>\n` +
    `<defs><pattern id="grade" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${grade}"/></pattern></defs>\n` +
    `<rect class="fundo" x="0" y="0" width="${largura}" height="${altura}" fill="${PAPEIS[tema].fundo}"/>\n` +
    `<rect class="grade" x="0" y="0" width="${largura}" height="${altura}" fill="url(#grade)"/>\n` +
    `<g class="cabecalho">${cabecalho}</g>\n` +
    `<g class="zonas">\n${zonas}</g>\n` +
    `<g class="arestas">\n${arestas}</g>\n` +
    `<g class="nomes-zona">\n${nomesZona}</g>\n` +
    `<g class="nos">\n${nos}</g>\n` +
    `<g class="portas">\n${topo}</g>\n` +
    (vivo ? emitirTokens(vivo) : '') +
    legenda +
    (cen ? `<g class="cenarios">\n${cen}</g>\n` : '') +
    `<text class="rodape" x="${largura - MARGEM}" y="${yRodape}" text-anchor="end">${esc(rodape)}</text>\n` +
    `</svg>\n`
  );
}
