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
test('zona com id igual ao de um nó: id duplicado', () => {
  const d = base(); d.zonas = [{ id: 'a', nome: 'Zona A' }]; d.nos[0].zona = 'a'; d.nos[1].zona = 'a';
  temErro(d, 'id duplicado: a');
});
test('zona com id igual ao de uma aresta: id duplicado', () => {
  const d = base(); d.zonas = [{ id: 'a-b', nome: 'Zona' }]; d.nos[0].zona = 'a-b';
  temErro(d, 'id duplicado: a-b');
});
test('passo de flow não pode referenciar zona', () => {
  const d = base(); d.zonas = [{ id: 'z1', nome: 'Zona' }]; d.nos[0].zona = 'z1';
  d.flows[0].passos[1].ref = 'z1'; temErro(d, 'flows[f1].passos[1].ref: z1');
});
test('zona sem nós é erro de validação', () => {
  const d = base(); d.zonas = [{ id: 'z1', nome: 'Zona' }, { id: 'z2', nome: 'Vazia' }]; d.nos[0].zona = 'z1';
  temErro(d, 'zonas[z2]: sem nós');
});
test('zonas com nós são válidas', () => {
  const d = base(); d.zonas = [{ id: 'z1', nome: 'Zona' }]; d.nos[0].zona = 'z1';
  assert.equal(validar(d).ok, true);
});

test('resposta válida na aresta', () => {
  const d = base(); d.arestas[0].resposta = 'ok'; assert.equal(validar(d).ok, true);
});
test('resposta vazia ou longa demais é erro', () => {
  const d = base(); d.arestas[0].resposta = ''; temErro(d, 'arestas[a-b].resposta');
  d.arestas[0].resposta = 'x'.repeat(41); temErro(d, 'arestas[a-b].resposta');
  d.arestas[0].resposta = 'x'.repeat(40); assert.equal(validar(d).ok, true);
});
test('sentido volta em aresta sem resposta é erro', () => {
  const d = base(); d.flows[0].passos[0].ref = 'a-b'; d.flows[0].passos[0].sentido = 'volta';
  temErro(d, 'flows[f1].passos[0].sentido');
  d.arestas[0].resposta = 'ok'; assert.equal(validar(d).ok, true);
});
test('sentido em ref de nó é erro; sentido inválido é erro', () => {
  const d = base(); d.flows[0].passos[0].sentido = 'ida'; temErro(d, 'flows[f1].passos[0].sentido');
  const e = base(); e.flows[0].passos[0].ref = 'a-b'; e.flows[0].passos[0].sentido = 'x';
  temErro(e, 'flows[f1].passos[0].sentido');
});

test('icone, selo e tipo válidos', () => {
  const d = base();
  for (const icone of ['pessoa', 'servico', 'ferramenta', 'banco', 'gate', 'externo', 'fila', 'documento', 'agente']) {
    d.nos[0].icone = icone; assert.deepEqual(validar(d).erros, []);
  }
  d.nos[0].selo = 'MCP'; d.nos[1].selo = 'x'.repeat(12);
  for (const tipo of ['chamada', 'rpc', 'dados', 'evento', 'fila']) {
    d.arestas[0].tipo = tipo; assert.deepEqual(validar(d).erros, []);
  }
});
test('icone inválido é erro com o caminho', () => {
  const d = base(); d.nos[0].icone = 'robo'; temErro(d, 'nos[a].icone: robo');
});
test('selo vazio, longo demais ou não texto é erro', () => {
  const d = base(); d.nos[0].selo = 'x'.repeat(13); temErro(d, 'nos[a].selo');
  d.nos[0].selo = ''; temErro(d, 'nos[a].selo');
  d.nos[0].selo = 3; temErro(d, 'nos[a].selo');
});
test('tipo de aresta inválido é erro com o caminho', () => {
  const d = base(); d.arestas[0].tipo = 'http'; temErro(d, 'arestas[a-b].tipo: http');
});
test('fixture requisicao é válida', () => {
  const d = JSON.parse(readFileSync(new URL('./fixtures/requisicao.json', import.meta.url), 'utf8'));
  assert.deepEqual(validar(d).erros, []);
  assert.equal(d.nos.length, 11);
  assert.equal(d.arestas.filter((a) => a.resposta).length, 4);
});
test('id com "~" é reservado (a volta vive no Layout como <id>~volta)', () => {
  const d = base(); d.arestas[0].id = 'a-b~volta'; temErro(d, 'reservado');
});
test('ids só com letras ASCII, dígitos, "_" e "-" (viram id no DOM do SVG)', () => {
  for (const ruim of ['a b', 'açao', 'a.b', 'a/b', 'a"b', 'a#b']) {
    const d = base(); d.nos[0].id = ruim; d.arestas[0].de = ruim; d.flows[0].passos[0].ref = ruim;
    temErro(d, `id ${ruim}: use só`);
  }
  const d = base(); d.arestas[0].id = 'a b'; d.flows[0].passos.forEach((p) => { if (p.ref === 'a-b') p.ref = 'a b'; });
  temErro(d, 'id a b: use só');
  const z = base(); z.zonas = [{ id: 'z 1', nome: 'Z' }]; temErro(z, 'id z 1: use só');
  const f = base(); f.flows[0].id = 'f 1'; temErro(f, 'id f 1: use só');
  const ok = base(); ok.nos[0].id = 'A_b-9'; ok.arestas[0].de = 'A_b-9'; ok.flows[0].passos.forEach((p) => { if (p.ref === 'a') p.ref = 'A_b-9'; });
  assert.deepEqual(validar(ok).erros, []);
});
test('sufixo "--volta" é reservado (id DOM da volta no SVG)', () => {
  const d = base(); d.arestas[0].id = 'x--volta'; d.flows[0].passos.forEach((p) => { if (p.ref === 'a-b') p.ref = 'x--volta'; });
  temErro(d, 'reservado');
});
