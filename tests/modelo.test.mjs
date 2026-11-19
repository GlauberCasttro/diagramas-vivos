import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validar } from '../scripts/lib/modelo.mjs';

const base = () => JSON.parse(readFileSync(new URL('./fixtures/minimo.json', import.meta.url), 'utf8'));
const temErro = (d, trecho) => {
  const r = validar(d);
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => e.includes(trecho)), `esperava "${trecho}" em ${JSON.stringify(r.erros)}`);
};

test('mínimo é válido', () => {
  assert.deepEqual(validar(base()), { ok: true, erros: [] });
});
test('papel de nó inválido', () => {
  const d = base(); d.nos[0].papel = 'verde'; temErro(d, 'nos[a].papel');
});
test('aresta para inexistente', () => {
  const d = base(); d.arestas[0].para = 'z'; temErro(d, 'arestas[a-b].para: z');
});
test('flow com 1 passo', () => {
  const d = base(); d.flows[0].passos = [d.flows[0].passos[0]]; temErro(d, 'flows[f1]: mínimo 2 passos');
});
test('passo com ref inexistente', () => {
  const d = base(); d.flows[0].passos[1].ref = 'x'; temErro(d, 'flows[f1].passos[1].ref: x');
});
test('sem flows', () => {
  const d = base(); delete d.flows; temErro(d, 'flows: mínimo 1');
});
test('ids duplicados entre nós e arestas', () => {
  const d = base(); d.arestas[0].id = 'a'; temErro(d, 'id duplicado: a');
});
test('nivel inferido rejeitado no F0', () => {
  const d = base(); d.nos[0].nivel = 'inferido'; temErro(d, 'nos[a].nivel');
});
test('coleta todos os erros', () => {
  const d = base(); d.nos[0].papel = 'verde'; d.arestas[0].para = 'z';
  assert.ok(validar(d).erros.length >= 2);
});
test('nó papel externo é válido', () => {
  const d = base(); d.nos[0].papel = 'externo'; assert.equal(validar(d).ok, true);
});
test('aresta papel retorno é válido', () => {
  const d = base(); d.arestas[0].papel = 'retorno'; assert.equal(validar(d).ok, true);
});
test('aresta papel gate é inválido', () => {
  const d = base(); d.arestas[0].papel = 'gate'; temErro(d, 'arestas[a-b].papel');
});
