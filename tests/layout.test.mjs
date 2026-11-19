import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validar } from '../scripts/lib/modelo.mjs';
import { carregarFontes } from '../scripts/lib/texto.mjs';
import { layoutFluxo } from '../scripts/lib/layout-fluxo.mjs';
import { verificarGeometria } from '../scripts/lib/geometria.mjs';

const fontes = await carregarFontes(fileURLToPath(new URL('../assets/fonts/', import.meta.url)));
const ler = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));

const sobrepoe = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const dentro = (p, L) => p[0] >= 0 && p[0] <= L.largura && p[1] >= 0 && p[1] <= L.altura;

function ortogonal(L) {
  for (const a of L.arestas)
    for (let i = 1; i < a.pontos.length; i++) {
      const [x0, y0] = a.pontos[i - 1];
      const [x1, y1] = a.pontos[i];
      assert.ok(Math.abs(x0 - x1) < 0.5 || Math.abs(y0 - y1) < 0.5, `${a.id} segmento ${i} diagonal`);
    }
}

test('fixtures validam', () => {
  assert.equal(validar(ler('minimo.json')).ok, true);
  assert.deepEqual(validar(ler('retorno.json')).erros, []);
});

test('minimo: 2 nós sem sobreposição, aresta dentro da área', async () => {
  const L = await layoutFluxo(ler('minimo.json'), fontes);
  assert.equal(L.nos.length, 2);
  assert.ok(!sobrepoe(L.nos[0], L.nos[1]));
  assert.equal(L.arestas.length, 1);
  assert.ok(L.arestas[0].pontos.length >= 2);
  for (const p of L.arestas[0].pontos) assert.ok(dentro(p, L), `${p} fora`);
  for (const n of L.nos) {
    assert.equal(n.w, 260);
    assert.ok(n.h >= 72);
    assert.ok(n.y >= L.cabecalho.y + L.cabecalho.altura, 'nó invade o cabeçalho');
    assert.ok(n.y + n.h <= L.legenda.y, 'nó invade a legenda');
  }
  assert.equal(L.legenda.y + L.legenda.altura, L.altura);
  ortogonal(L);
});

test('retorno: geometria limpa, retorno dobra, nós dentro das zonas', async () => {
  const d = ler('retorno.json');
  const L = await layoutFluxo(d, fontes);
  assert.deepEqual(verificarGeometria(L), []);
  const ret = L.arestas.find((a) => a.id === 'gate-build');
  assert.ok(ret.pontos.length >= 3, `retorno com ${ret.pontos.length} pontos`);
  assert.equal(L.zonas.length, 2);
  for (const n of d.nos) {
    const ln = L.nos.find((x) => x.id === n.id);
    const z = L.zonas.find((x) => x.id === n.zona);
    assert.ok(ln.x >= z.x && ln.y >= z.y && ln.x + ln.w <= z.x + z.w && ln.y + ln.h <= z.y + z.h, `${n.id} fora de ${z.id}`);
  }
  for (const a of L.arestas) for (const p of a.pontos) assert.ok(dentro(p, L), `${a.id} ${p} fora`);
  const rot = L.arestas.find((a) => a.id === 'gate-deploy').rotulo;
  assert.deepEqual(rot.linhas, ['aprovado']);
  ortogonal(L);
});

test('altura do card segue a fórmula', async () => {
  const L = await layoutFluxo(ler('retorno.json'), fontes);
  for (const n of L.nos) {
    const h = 20 + 22 * n.linhasNome.length + 19 * n.linhasDescricao.length + 20;
    assert.equal(n.h, Math.max(72, h));
    assert.ok(n.linhasNome.length <= 2 && n.linhasDescricao.length <= 3);
  }
});

test('direcao DOWN também é ortogonal', async () => {
  const L = await layoutFluxo(ler('retorno.json'), fontes, { direcao: 'DOWN' });
  assert.deepEqual(verificarGeometria(L), []);
  ortogonal(L);
});

const base = () => ({
  largura: 800, altura: 400, cabecalho: { y: 0, altura: 80 }, legenda: { y: 344, altura: 56 }, zonas: [],
  nos: [
    { id: 'a', x: 40, y: 100, w: 260, h: 72, linhasNome: ['A'], linhasDescricao: [] },
    { id: 'b', x: 500, y: 100, w: 260, h: 72, linhasNome: ['B'], linhasDescricao: [] },
  ],
  arestas: [],
});

test('verificarGeometria: diagonal', () => {
  const L = base();
  L.arestas.push({ id: 'x', pontos: [[300, 136], [500, 200]] });
  assert.ok(verificarGeometria(L).some((e) => e.tipo === 'diagonal' && e.aresta === 'x'));
});

test('verificarGeometria: atravessa nó', () => {
  const L = base();
  L.nos.push({ id: 'meio', x: 340, y: 100, w: 100, h: 72, linhasNome: ['M'], linhasDescricao: [] });
  L.arestas.push({ id: 'x', pontos: [[300, 136], [500, 136]] });
  assert.ok(verificarGeometria(L).some((e) => e.tipo === 'atravessa-no' && e.aresta === 'x' && e.alvo === 'meio'));
});

test('verificarGeometria: sobreposição e rótulo colidindo', () => {
  const L = base();
  L.arestas.push({ id: 'x', pontos: [[300, 136], [500, 136]] });
  L.arestas.push({ id: 'y', pontos: [[320, 136], [480, 136]], rotulo: { x: 60, y: 120, linhas: ['oi'] } });
  const e = verificarGeometria(L);
  assert.ok(e.some((v) => v.tipo === 'sobreposicao'));
  assert.ok(e.some((v) => v.tipo === 'rotulo-colide' && v.aresta === 'y' && v.alvo === 'a'));
});

test('verificarGeometria: layout limpo vazio', () => {
  const L = base();
  L.arestas.push({ id: 'x', pontos: [[300, 136], [500, 136]] });
  assert.deepEqual(verificarGeometria(L), []);
});
