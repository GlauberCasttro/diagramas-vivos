import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { carregarFontes } from '../scripts/lib/texto.mjs';
import { layoutFluxo } from '../scripts/lib/layout-fluxo.mjs';
import { emitirSvg } from '../scripts/lib/svg.mjs';
import { emitirHtml } from '../scripts/lib/html.mjs';
import { CHROME, sondarChrome } from './sonda-chrome.mjs';

const fontes = await carregarFontes(fileURLToPath(new URL('../assets/fonts/', import.meta.url)));
const ler = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const stepper = readFileSync(new URL('../assets/stepper.js', import.meta.url), 'utf8');

async function gerar(d) {
  const L = await layoutFluxo(d, fontes);
  const svg = emitirSvg(d, L, fontes);
  return { svg, html: emitirHtml(d, L, svg) };
}

// Extrai o JSON embutido em <script type="application/json" id="dados">.
function dadosDe(html) {
  const m = html.match(/<script type="application\/json" id="dados">([\s\S]*?)<\/script>/);
  assert.ok(m, 'bloco de dados');
  return JSON.parse(m[1]);
}

for (const nome of ['minimo.json', 'retorno.json', 'laco.json']) {
  test(`${nome}: HTML autocontido com SVG, flows e stepper`, async () => {
    const d = ler(nome);
    const { svg, html } = await gerar(d);
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes(svg), 'SVG inteiro embutido');
    const dados = dadosDe(html);
    assert.deepEqual(dados.flows, d.flows);
    assert.ok(html.includes(stepper.trim()), 'stepper embutido');
    assert.ok(html.includes('function destaques('), 'regras do passo embutidas');
    assert.ok(html.includes('function passoDoHash('), 'regra do hash embutida');
    assert.ok(!/^export /m.test(html), 'sem export no script clássico');
    assert.ok(!/\/\*__[A-Z]+__\*\/|<!--__SVG__-->/.test(html), 'marcador não substituído');
    const semNs = html.replace(' xmlns="http://www.w3.org/2000/svg"', '');
    assert.ok(!semNs.includes('http://'), 'http://');
    assert.ok(!semNs.includes('https://'), 'https://');
    assert.ok(Buffer.byteLength(html) < 300 * 1024, `${Buffer.byteLength(html)} bytes`);
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /diagramas-vivos-tema/);
    assert.match(html, /Portions derived from floorplan \(MIT\) \(c\) 2026 Hayden Smith/);
  });
}

test('JSON embutido escapa </script e sobrevive a $& no texto', async () => {
  const d = ler('minimo.json');
  d.flows[0].passos[0].nota = 'fim </script><script>alert(1)</script> $& $1';
  d.titulo = 'Título com </script>';
  const { html } = await gerar(d);
  const ini = html.indexOf('<script type="application/json" id="dados">');
  const bloco = html.slice(ini, html.indexOf('</script>', ini));
  assert.ok(!/<\/script/i.test(bloco.slice(1)), 'sem </script dentro do JSON');
  const dados = dadosDe(html);
  assert.equal(dados.flows[0].passos[0].nota, d.flows[0].passos[0].nota);
  assert.equal(dados.titulo, d.titulo);
});

test('dados trazem nomes dos nós e resposta das arestas para a barra (câmera não usa geometria)', async () => {
  const d = ler('agente.json');
  const L = await layoutFluxo(d, fontes);
  const dados = dadosDe(emitirHtml(d, L, emitirSvg(d, L, fontes)));
  for (const n of d.nos) assert.equal(dados.nos[n.id].nome, n.nome);
  for (const a of d.arestas) {
    const g = dados.arestas[a.id];
    assert.ok(g && g.de === a.de && g.para === a.para, a.id);
    assert.equal(g.resposta, a.resposta);
  }
});

test('câmera fixa, tocar 1500 ms, barra com ida "→" e volta "⇠ · resposta", tokens ocultos no passo a passo', async () => {
  const { html } = await gerar(ler('agente.json'));
  assert.match(stepper, /1500/);
  assert.ok(html.includes('${nome(a.de)} ⇠ ${nome(a.para)} · ${a.resposta'), 'volta: B ⇠ A · resposta');
  assert.ok(html.includes('${nome(a.de)} → ${nome(a.para)}'), 'ida: A → B');
  assert.ok(html.includes('id="b-rota"'), 'linha A → B na barra');
  assert.doesNotMatch(stepper, /enquadrarPasso|3000/);
  assert.match(html, /\.passo-a-passo [^{]*\.token[^{]*\{[^}]*display: none/);
  assert.match(html, /\.portas \[data-aresta\]\.dim/);
});

// Passo a passo: o SMIL do SVG continua rodando por baixo e um <set> ativo vence `opacity` do CSS; por isso o
// .flow das arestas fora do passo some por display (que o SMIL não anima) e as legendas ficam fixas (!important).
test('modo passo: .flow inativo some por display e legendas fixas (regras CSS)', async () => {
  const { html } = await gerar(ler('agente.json'));
  assert.match(html, /html\.passo-a-passo #vp \.aresta:not\(\.hl\) \.flow \{ display: none; \}/);
  assert.match(html, /html\.passo-a-passo #vp \.cen \{ opacity: 1 !important; \}/);
  assert.doesNotMatch(html, /\.aresta\.dim \.flow \{ opacity: 0; \}/);
});

test('modo passo no Chrome: com o SMIL tocando, só o .flow do passo aparece; câmera fixa entre passos', { skip: !CHROME && 'Chrome ausente', timeout: 90000 }, async () => {
  const { html } = await gerar(ler('agente.json'));
  const sonda = `<pre id="sonda"></pre><script>
addEventListener('load', async () => {
  const espera = () => new Promise((r) => setTimeout(r, 100));
  const s = document.querySelector('#vp svg'); const out = {};
  const ver = (rot) => {
    const flows = [...document.querySelectorAll('g.aresta')].map((g) => {
      const f = g.querySelector('.flow'); const cs = getComputedStyle(f);
      return { id: g.dataset.id, hl: g.classList.contains('hl'), visivel: cs.display !== 'none' && cs.opacity !== '0' };
    });
    out[rot] = { flows, cen: [...document.querySelectorAll('.cen')].map((t) => getComputedStyle(t).opacity),
      token: getComputedStyle(document.querySelector('circle.token')).display, vp: document.getElementById('vp').style.transform };
  };
  s.pauseAnimations();
  for (const t of [1.3, 3.0]) { s.setCurrentTime(t); await espera(); ver('passo1@' + t); }
  dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  await espera(); ver('passo3');
  dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  s.setCurrentTime(1.3); await espera(); ver('repouso@1.3');
  document.getElementById('sonda').textContent = JSON.stringify(out);
});
</script>`;
  const out = sondarChrome(html.replace('</body>', `${sonda}</body>`), { hash: '#passo=1' });
  for (const rot of ['passo1@1.3', 'passo1@3', 'passo3']) {
    const o = out[rot];
    for (const f of o.flows) assert.equal(f.visivel, f.hl, `${rot} ${f.id}: visível=${f.visivel} hl=${f.hl}`);
    assert.deepEqual(o.cen, ['1', '1'], `${rot} legendas fixas`);
    assert.equal(o.token, 'none', `${rot} token SMIL oculto`);
  }
  assert.deepEqual(out['passo1@3'].flows.filter((f) => f.hl).map((f) => f.id), ['pede']);
  assert.deepEqual(out.passo3.flows.filter((f) => f.hl).map((f) => f.id), ['chama~volta']);
  assert.equal(out.passo3.vp, out['passo1@1.3'].vp, 'câmera não se move entre os passos 1 e 3');
  // fora do passo a passo o SMIL volta a mandar: token visível e legenda do flow 1 forte, a do 2 em repouso
  const r = out['repouso@1.3'];
  assert.equal(r.token, 'inline');
  assert.deepEqual(r.cen, ['1', '0.8']);
  assert.deepEqual(r.flows.filter((f) => f.visivel).map((f) => f.id).sort(), ['chama', 'pede']);
});
