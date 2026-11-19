import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GERAR = fileURLToPath(new URL('../scripts/gerar.mjs', import.meta.url));
const MINIMO = fileURLToPath(new URL('./fixtures/minimo.json', import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), 'dv-'));
const rodar = (args) => spawnSync('node', [GERAR, ...args], { encoding: 'utf8' });

test('minimo: exit 0, três arquivos 01-*, depois 02-*', () => {
  const d = tmp();
  const r = rodar([MINIMO, '--saida', d]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = JSON.parse(r.stdout);
  assert.deepEqual(readdirSync(d).sort(), ['01-minimo.diagram.json', '01-minimo.html', '01-minimo.svg']);
  assert.equal(j.arquivos.svg.endsWith('01-minimo.svg'), true);
  assert.deepEqual(j.violacoes, []);
  assert.ok(j.bytes.svg > 0 && j.bytes.html > 0);
  assert.equal(j.roteador, 'elk');
  const r2 = rodar([MINIMO, '--saida', d]);
  assert.equal(r2.status, 0);
  assert.ok(readdirSync(d).includes('02-minimo.svg'));
});

test('--nome sobrescreve', () => {
  const d = tmp();
  assert.equal(rodar([MINIMO, '--saida', d, '--nome', '07-teste']).status, 0);
  assert.equal(rodar([MINIMO, '--saida', d, '--nome', '07-teste']).status, 0);
  assert.deepEqual(readdirSync(d).sort(), ['07-teste.diagram.json', '07-teste.html', '07-teste.svg']);
});

test('modelo inválido: exit 1 e diretório vazio', () => {
  const d = tmp();
  const ruim = join(tmp(), 'ruim.json');
  writeFileSync(ruim, JSON.stringify({ versao: 1, titulo: 'x' }));
  const r = rodar([ruim, '--saida', d]);
  assert.equal(r.status, 1);
  const j = JSON.parse(r.stdout);
  assert.ok(j.erro && j.erros.length > 0);
  assert.deepEqual(readdirSync(d), []);
});

test('texto com → gera aviso', () => {
  const d = tmp();
  const m = JSON.parse(readFileSync(MINIMO, 'utf8'));
  m.nos[0].nome = 'A → B';
  const p = join(tmp(), 'seta.json');
  writeFileSync(p, JSON.stringify(m));
  const r = rodar([p, '--saida', d]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).avisos.includes('→'));
});

test('libavoid roda e informa o roteador', () => {
  const d = tmp();
  const r = rodar([MINIMO, '--saida', d, '--roteador', 'libavoid']);
  assert.ok([0, 2].includes(r.status), r.stderr);
  assert.equal(JSON.parse(r.stdout).roteador, 'libavoid');
});
