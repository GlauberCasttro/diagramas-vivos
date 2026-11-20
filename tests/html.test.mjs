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

// ---------- F0.2: barra de reprodução (pausar, velocidade, zoom) ----------
test('barra de reprodução: botões com aria-label, velocidade lembrada, atalhos e --vel', async () => {
  const { html } = await gerar(ler('requisicao.json'));
  for (const rot of ['Pausar', 'Velocidade', 'Aproximar', 'Afastar', 'Ajustar'])
    assert.match(html, new RegExp(`<button [^>]*aria-label="${rot}"`), rot);
  assert.match(stepper, /diagramas-vivos-vel/);
  assert.match(stepper, /pauseAnimations\(\)/);
  assert.match(stepper, /setCurrentTime\(/);
  assert.match(stepper, /requestAnimationFrame/);
  assert.match(stepper, /--vel/);
  assert.match(stepper, /TOCAR_MS \/ vel/);
  assert.match(stepper, /const VELS = \[0\.25, 0\.5, 0\.75, 1, 1\.5, 2\];/);
  for (const k of ["'['", "']'", "'0'"]) assert.ok(stepper.includes(k), `atalho ${k}`);
  // CSS da página: o .flow do passo e o pulso seguem a velocidade; pausado congela as animações CSS
  assert.match(html, /#vp \.aresta\.hl \.flow \{ opacity: \.95; animation: fluxo calc\(1\.1s \/ var\(--vel, 1\)\) linear infinite; \}/);
  assert.match(html, /html\.pausado #vp \*[^{]*\{[^}]*animation-play-state: paused/);
});

// Chrome: velocidade, pausa e zoom de verdade (timeline SMIL guiada por requestAnimationFrame).
test('reprodução no Chrome: 2× chega na 2ª aresta em ~metade do tempo; pausar congela; + e − mudam a escala', { skip: !CHROME && 'Chrome ausente', timeout: 90000 }, async (t) => {
  const { html } = await gerar(ler('agente.json'));
  const sonda = `<pre id="sonda"></pre><script>
addEventListener('load', async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const s = document.querySelector('#vp svg'); const out = {};
  const clicar = (rot) => document.querySelector('button[aria-label="' + rot + '"]').click();
  const noToken = () => [...document.querySelectorAll('circle.token')].filter((e) => getComputedStyle(e).opacity !== '0')
    .map((e) => e.querySelector('mpath').getAttribute('href'))[0] || null;
  // tempo (ms de relógio) até o token entrar na 2ª aresta (#a-chama), partindo do instante 0 da timeline
  async function ate2a() {
    s.setCurrentTime(0); const t0 = performance.now();
    while (noToken() !== '#a-chama') { if (performance.now() - t0 > 10000) return -1; await espera(10); }
    return performance.now() - t0;
  }
  const escala = () => +(/scale\\(([\\d.]+)\\)/.exec(document.getElementById('vp').style.transform) || [0, 0])[1];
  await espera(50);
  out.v1 = await ate2a();
  dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
  dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
  out.rotVel = document.querySelector('button[aria-label="Velocidade"]').textContent;
  out.v2 = await ate2a();
  out.varVel = getComputedStyle(document.documentElement).getPropertyValue('--vel').trim();
  try { out.memoria = localStorage.getItem('diagramas-vivos-vel'); } catch (e) {}
  for (let i = 0; i < 6; i++) dispatchEvent(new KeyboardEvent('keydown', { key: '[' })); // 2 → 0,25 (e para no mínimo)
  out.rotVel025 = document.querySelector('button[aria-label="Velocidade"]').textContent;
  out.v025 = await ate2a();
  out.varVel025 = getComputedStyle(document.documentElement).getPropertyValue('--vel').trim();
  out.durRepouso025 = getComputedStyle(document.querySelector('.flow-repouso')).animationDuration;
  clicar('Pausar');
  const p0 = s.getCurrentTime(); await espera(400); const p1 = s.getCurrentTime();
  out.pausa = { p0, p1, estado: getComputedStyle(document.querySelector('.flow-repouso')).animationPlayState,
    rot: document.getElementById('r-tocar').getAttribute('aria-label') };
  clicar('Retomar'); await espera(300); out.retoma = s.getCurrentTime() > p1;
  const k0 = escala(); clicar('Aproximar'); const k1 = escala(); clicar('Afastar'); clicar('Afastar'); const k2 = escala();
  dispatchEvent(new KeyboardEvent('keydown', { key: '0' })); const k3 = escala();
  document.getElementById('palco').dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: 400, clientY: 300, bubbles: true, cancelable: true }));
  const k4 = escala();
  out.zoom = { k0, k1, k2, k3, k4 };
  document.getElementById('sonda').textContent = JSON.stringify(out);
});
</script>`;
  // Sob --virtual-time-budget o Chrome headless quase não dispara requestAnimationFrame (2 quadros em 1 s);
  // o calço no <head> entrega quadros de 16 ms por setTimeout, que o tempo virtual avança de forma
  // determinística. O rAF de verdade é conferido no Chrome visível (report da F0.2).
  const calco = `<script>window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);</script>`;
  const pagina = html.replace('<head>', `<head>${calco}`).replace('</body>', `${sonda}</body>`);
  const out = sondarChrome(pagina, { orcamento: 20000 });
  assert.ok(out.v1 > 0 && out.v2 > 0 && out.v025 > 0, JSON.stringify(out));
  const r = out.v2 / out.v1;
  t.diagnostic(`1×: ${out.v1} ms, 2×: ${out.v2} ms (razão ${r.toFixed(3)}); zoom ${JSON.stringify(out.zoom)}`);
  assert.ok(r > 0.4 && r < 0.6, `2× / 1× = ${r.toFixed(2)} (${out.v1} ms vs ${out.v2} ms)`);
  assert.equal(out.rotVel, '2×');
  assert.equal(out.varVel, '2');
  assert.equal(out.memoria, '2');
  const r025 = out.v025 / out.v1;
  t.diagnostic(`0,25×: ${out.v025} ms (razão ${r025.toFixed(3)})`);
  assert.ok(r025 > 3.6 && r025 < 4.4, `0,25× / 1× = ${r025.toFixed(2)}`);
  assert.equal(out.rotVel025, '0,25×');
  assert.equal(out.varVel025, '0.25');
  assert.equal(out.durRepouso025, '9.6s', 'tracejado de repouso também desacelera (2,4 s / 0,25)');
  assert.equal(out.pausa.p1, out.pausa.p0, 'pausar congela getCurrentTime');
  assert.equal(out.pausa.estado, 'paused');
  assert.equal(out.pausa.rot, 'Retomar');
  assert.ok(out.retoma, 'retomar volta a avançar');
  const z = out.zoom;
  assert.ok(z.k1 > z.k0, `+ aumenta: ${z.k0} → ${z.k1}`);
  assert.ok(z.k2 < z.k1, `− diminui: ${z.k1} → ${z.k2}`);
  assert.equal(z.k3, z.k0, '0 reenquadra');
  assert.ok(z.k4 > z.k3, `roda aproxima: ${z.k3} → ${z.k4}`);
});
