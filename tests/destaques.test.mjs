import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { destaques, passoDoHash } from '../assets/destaques.mjs';

const ler = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const mapa = (d) => Object.fromEntries(d.arestas.map((a) => [a.id, { de: a.de, para: a.para }]));
const como = (r) => ({ nos: [...r.nos].sort(), arestas: [...r.arestas].sort() });
const passos = (...refs) => refs.map((ref) => ({ ref }));

const retorno = mapa(ler('retorno.json'));
const laco = mapa(ler('laco.json'));

test('primeiro passo (nó): só o nó', () => {
  assert.deepEqual(como(destaques(passos('pedido', 'build'), 0, retorno)), { nos: ['pedido'], arestas: [] });
});

test('nó depois de nó: arestas X -> nó', () => {
  assert.deepEqual(como(destaques(passos('pedido', 'build'), 1, retorno)), { nos: ['build'], arestas: ['pedido-build'] });
});

test('nó depois da aresta que chega nele: essa aresta', () => {
  assert.deepEqual(como(destaques(passos('pedido-build', 'build'), 1, retorno)), { nos: ['build'], arestas: ['pedido-build'] });
});

test('nó depois de aresta que não chega nele: só o nó', () => {
  assert.deepEqual(como(destaques(passos('pedido-build', 'testes'), 1, retorno)), { nos: ['testes'], arestas: [] });
});

test('ref aresta: aresta e pontas', () => {
  assert.deepEqual(como(destaques(passos('pedido', 'testes-gate'), 1, retorno)), { nos: ['gate', 'testes'], arestas: ['testes-gate'] });
});

test('laço: chegar ao nó por outra aresta não realça o laço', () => {
  assert.deepEqual(como(destaques(passos('pedido-tenta', 'tenta', 'tenta-fim'), 1, laco)), { nos: ['tenta'], arestas: ['pedido-tenta'] });
  assert.deepEqual(como(destaques(passos('pedido', 'tenta'), 1, laco)), { nos: ['tenta'], arestas: ['pedido-tenta'] });
  assert.deepEqual(como(destaques(passos('tenta', 'tenta'), 1, laco)), { nos: ['tenta'], arestas: [] });
});

test('laço: só entra quando o passo anterior É a aresta do laço', () => {
  assert.deepEqual(como(destaques(passos('tenta-tenta', 'tenta'), 1, laco)), { nos: ['tenta'], arestas: ['tenta-tenta'] });
  assert.deepEqual(como(destaques(passos('pedido', 'tenta-tenta'), 1, laco)), { nos: ['tenta'], arestas: ['tenta-tenta'] });
});

test('passoDoHash: 0, inválido e ausente são repouso; acima do total limita', () => {
  assert.equal(passoDoHash('#passo=0', 3), 0);
  assert.equal(passoDoHash('#passo=00', 3), 0);
  assert.equal(passoDoHash('', 3), 0);
  assert.equal(passoDoHash('#passo=x', 3), 0);
  assert.equal(passoDoHash('#passo=-1', 3), 0);
  assert.equal(passoDoHash('#passo=1', 3), 1);
  assert.equal(passoDoHash('#passo=3', 3), 3);
  assert.equal(passoDoHash('#passo=99', 3), 3);
});

test('sentido: ida por padrão e volta explícita em ref de aresta; null em nó', () => {
  const p = [{ ref: 'pedido-build' }, { ref: 'pedido-build', sentido: 'volta' }, { ref: 'build' }];
  assert.equal(destaques(p, 0, retorno).sentido, 'ida');
  const v = destaques(p, 1, retorno);
  assert.equal(v.sentido, 'volta');
  assert.deepEqual(como(v), { nos: ['build', 'pedido'], arestas: ['pedido-build'] });
  assert.equal(destaques(p, 2, retorno).sentido, null);
});

// Passo de nó logo depois de um passo de volta: a volta chega no "de" da aresta e o destaque é <id>~volta.
test('nó depois de volta: chega no "de" e destaca <id>~volta', () => {
  const p = [{ ref: 'pedido-build' }, { ref: 'pedido-build', sentido: 'volta' }, { ref: 'pedido' }];
  const r = destaques(p, 2, retorno);
  assert.equal(r.sentido, null);
  assert.deepEqual(como(r), { nos: ['pedido'], arestas: ['pedido-build~volta'] });
});

test('nó "para" depois de volta: não destaca a ida (a volta não chega nele)', () => {
  const p = [{ ref: 'pedido-build' }, { ref: 'pedido-build', sentido: 'volta' }, { ref: 'build' }];
  assert.deepEqual(como(destaques(p, 2, retorno)), { nos: ['build'], arestas: [] });
});

test('nó depois de ida explícita continua destacando a ida', () => {
  const p = [{ ref: 'pedido-build', sentido: 'ida' }, { ref: 'build' }];
  assert.deepEqual(como(destaques(p, 1, retorno)), { nos: ['build'], arestas: ['pedido-build'] });
});
