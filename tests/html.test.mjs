import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { carregarFontes } from '../scripts/lib/texto.mjs';
import { layoutFluxo } from '../scripts/lib/layout-fluxo.mjs';
import { emitirSvg } from '../scripts/lib/svg.mjs';
import { emitirHtml } from '../scripts/lib/html.mjs';

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

test('dados trazem geometria de nós e arestas para a câmera', async () => {
  const d = ler('retorno.json');
  const L = await layoutFluxo(d, fontes);
  const dados = dadosDe(emitirHtml(d, L, emitirSvg(d, L, fontes)));
  for (const n of d.nos) {
    const g = dados.nos[n.id];
    assert.ok(g && Number.isFinite(g.x) && g.w > 0 && g.h > 0, n.id);
  }
  for (const a of d.arestas) {
    const g = dados.arestas[a.id];
    assert.ok(g && g.de === a.de && g.para === a.para && g.caixa.w >= 0, a.id);
  }
});
