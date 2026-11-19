// Emissão do HTML: SVG embutido + passo a passo guiado (assets/stepper.js), sem rede e sem dependências.
// Portions derived from floorplan (MIT) (c) 2026 Hayden Smith
// Origem: floorplan/assets/viewer.html (barra do flow :289-297, .dim/.hl e pulso de highlightFlow :1884-1905).
import { readFileSync } from 'node:fs';
import { esc } from './svg.mjs';

const ASSETS = new URL('../../assets/', import.meta.url);
const lerAsset = (rel) => readFileSync(new URL(rel, ASSETS), 'utf8');

// CSS da página (moldura, barra, controles) e dos estados do passo a passo (.hl/.dim/.pulso).
const CSS = `html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font-family: var(--sans); }
#palco { position: fixed; inset: 0; overflow: hidden; cursor: grab; touch-action: none; }
#palco.arrastando { cursor: grabbing; }
#vp { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
#vp.anim { transition: transform .5s var(--ease); }
#vp > svg { display: block; }
.painel { background: var(--elev); border: 1px solid var(--hair-2); box-shadow: var(--shadow-float); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
#barra { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); width: min(680px, calc(100% - 24px)); box-sizing: border-box; padding: 14px 14px 14px 20px; display: flex; gap: 12px; align-items: center; z-index: 3; border-radius: var(--r-panel); }
#barra .fk { font-size: 12px; color: var(--text-3); margin-bottom: 2px; }
#barra .ft { flex: 1; min-width: 0; line-height: 1.5; font-size: 14px; }
#barra #b-passo { font-weight: 600; }
#barra .nota { color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
#barra .dots { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
#barra .dots i { width: 18px; height: 3px; border-radius: 2px; background: rgba(var(--ink), .12); transition: background .3s var(--ease); }
#barra .dots i.on { background: var(--on); }
.botoes, #ctl { display: flex; gap: 6px; }
#ctl { position: fixed; right: 12px; bottom: 12px; padding: 6px; border-radius: var(--r-ctl); z-index: 3; }
button { font: inherit; font-size: 14px; color: var(--text); background: var(--raise); border: 1px solid var(--hair-2); border-radius: var(--r-ctl); min-width: 36px; height: 36px; padding: 0 10px; cursor: pointer; }
button:hover { background: var(--raise-2); }
button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
button:disabled { opacity: .4; cursor: default; }
button[hidden] { display: none; }
/* #vp na frente: o <style> do SVG vem depois no documento e venceria com a mesma especificidade. */
#vp .no, #vp .aresta, #vp .portas [data-aresta] { transition: opacity .3s var(--ease); }
#vp .no.dim, #vp .aresta.dim, #vp .portas [data-aresta].dim { opacity: .2; }
#vp .aresta.dim .flow { opacity: 0; }
#vp .no.hl .card { stroke: var(--c); stroke-opacity: 1; stroke-width: 2.5; }
#vp .aresta.hl .trace { stroke-opacity: 1; }
#vp .aresta.hl .flow { opacity: .95; animation: fluxo 1.1s linear infinite; }
/* No passo a passo os tokens SMIL e a chegada animada somem; ao sair, voltam (a cadeia nunca para). */
html.passo-a-passo #vp .token, html.passo-a-passo #vp .chegada { display: none; }
#vp .no.pulsa .card { animation: pulsa 1.5s var(--ease) infinite; }
@keyframes pulsa { 0%, 100% { stroke: var(--c); stroke-width: 2.5; stroke-opacity: 1; } 50% { stroke-width: 5; stroke-opacity: .35; } }
#barra #b-rota { color: var(--text-2); font-size: 13px; }
@keyframes fluxo { to { stroke-dashoffset: -24; } }
.pulso { fill: var(--c, var(--text)); }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
  .pulso { display: none; }
}`;

// JSON seguro dentro de <script>: "<" vira \\u003c (fecha a porta para </script e <!--) e os separadores
// de linha U+2028/U+2029 são escapados.
function jsonSeguro(v) {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function emitirHtml(diagrama, layout, svg) {
  const porIdNo = new Map(layout.nos.map((n) => [n.id, n]));
  const porIdAresta = new Map(layout.arestas.map((a) => [a.id, a]));
  const nos = {};
  for (const n of diagrama.nos) {
    const g = porIdNo.get(n.id);
    if (!g) throw new Error(`emitirHtml: nó "${n.id}" ausente no layout`);
    nos[n.id] = { nome: n.nome };
  }
  const arestas = {};
  for (const a of diagrama.arestas) {
    const g = porIdAresta.get(a.id);
    if (!g) throw new Error(`emitirHtml: aresta "${a.id}" ausente no layout`);
    arestas[a.id] = { de: a.de, para: a.para, ...(a.resposta ? { resposta: a.resposta } : {}) };
  }
  const dados = { titulo: diagrama.titulo, flows: diagrama.flows, nos, arestas };

  // Uma só passada sobre o template: o texto inserido (inclusive "$&" ou um marcador escrito pelo usuário)
  // nunca é reinterpretado.
  const subst = {
    __TITULO__: esc(String(diagrama.titulo)),
    '/*__TOKENS__*/': lerAsset('tokens.css'),
    '/*__CSS__*/': CSS,
    '<!--__SVG__-->': svg,
    '/*__DADOS__*/': jsonSeguro(dados),
    // Regras puras (destaques.mjs, testadas em node) antes do stepper; "export" sai para o script clássico.
    '/*__STEPPER__*/': lerAsset('destaques.mjs').replace(/^export /gm, '').trim() + '\n' + lerAsset('stepper.js').trim(),
  };
  const template = lerAsset('template.html');
  for (const marca of Object.keys(subst))
    if (!template.includes(marca)) throw new Error(`emitirHtml: marcador ${marca} ausente no template`);
  const re = /__TITULO__|\/\*__(?:TOKENS|CSS|DADOS|STEPPER)__\*\/|<!--__SVG__-->/g;
  const html = template.replace(re, (m) => subst[m]);
  return html;
}
