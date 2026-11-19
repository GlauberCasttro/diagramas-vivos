import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { symlinkSync, mkdtempSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slug, avaliar } from '../scripts/gerar.mjs';

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
  const j = JSON.parse(r.stdout);
  assert.equal(r.status, j.violacoes.length ? 2 : 0, r.stderr);
  assert.equal(j.roteador, 'libavoid');
});

test('orçamento estourado: exit 2, arquivos escritos, violação orcamento', () => {
  const d = tmp();
  const r = spawnSync('node', [GERAR, MINIMO, '--saida', d], {
    encoding: 'utf8',
    env: { ...process.env, DIAGRAMAS_VIVOS_LIMITE_SVG: '100', DIAGRAMAS_VIVOS_LIMITE_HTML: '200' },
  });
  assert.equal(r.status, 2);
  const j = JSON.parse(r.stdout);
  assert.equal(readdirSync(d).length, 3);
  const o = j.violacoes.find((v) => v.arquivo === 'svg');
  assert.equal(o.tipo, 'orcamento');
  assert.equal(o.limite, 100);
  assert.equal(o.bytes, j.bytes.svg);
  assert.ok(j.violacoes.some((v) => v.arquivo === 'html' && v.limite === 200));
});

test('avaliar: layout com violação de geometria gera violações; limpo não', () => {
  const ok = { largura: 400, altura: 300, zonas: [], nos: [{ id: 'a', x: 100, y: 100, w: 100, h: 50 }], arestas: [] };
  assert.deepEqual(avaliar(ok, { svg: 1, html: 1 }), []);
  const ruim = {
    ...ok,
    arestas: [{ id: 'e', pontos: [[0, 125], [400, 125]] }],
  };
  assert.ok(avaliar(ruim, { svg: 1, html: 1 }).length > 0);
});

test('--nome com separador ou .. : exit 1 e nada escrito', () => {
  for (const n of ['../x', 'a/b', 'a\\b']) {
    const d = tmp();
    const r = rodar([MINIMO, '--saida', d, '--nome', n]);
    assert.equal(r.status, 1, n);
    assert.ok(JSON.parse(r.stdout).erro);
    assert.deepEqual(readdirSync(d), []);
  }
});

test('numeração ignora arquivos que não são saídas', () => {
  const d = tmp();
  writeFileSync(join(d, '99-notas.txt'), 'x');
  rodar([MINIMO, '--saida', d]);
  assert.ok(readdirSync(d).includes('01-minimo.svg'));
});

test('slug: acentos, travessão, 60 chars sem hífen final', () => {
  assert.equal(slug('Açaí — Fluxo São João'), 'acai-fluxo-sao-joao');
  const s = slug(`${'a'.repeat(59)} — fim`);
  assert.equal(s, 'a'.repeat(59));
  assert.ok(slug('x'.repeat(80)).length <= 60);
});

test('CLI roda quando chamada por symlink', () => {
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  const link = join(tmp(), 'skill');
  symlinkSync(raiz, link);
  const d = tmp();
  const r = spawnSync('node', [join(link, 'scripts', 'gerar.mjs'), MINIMO, '--saida', d], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).arquivos.svg);
  assert.equal(readdirSync(d).length, 3);
});

test('--direcao: padrão RIGHT; DOWN muda o layout e é informada; inválida dá exit 1', () => {
  const vb = (p) => /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(readFileSync(p, 'utf8')).slice(1).map(Number);
  const d = tmp();
  const r1 = rodar([MINIMO, '--saida', d, '--nome', '01-padrao']);
  const r2 = rodar([MINIMO, '--saida', d, '--nome', '02-down', '--direcao', 'DOWN']);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(JSON.parse(r1.stdout).direcao, 'RIGHT');
  assert.equal(JSON.parse(r2.stdout).direcao, 'DOWN');
  const [w1, h1] = vb(JSON.parse(r1.stdout).arquivos.svg);
  const [w2, h2] = vb(JSON.parse(r2.stdout).arquivos.svg);
  assert.ok(w2 / h2 < w1 / h1, `DOWN deveria ser mais estreito que o padrão (RIGHT): ${w1}x${h1} vs ${w2}x${h2}`);
  const d2 = tmp();
  const r3 = rodar([MINIMO, '--saida', d2, '--direcao', 'LEFT']);
  assert.equal(r3.status, 1);
  assert.deepEqual(readdirSync(d2), []);
});

test('arquivo .svg começa com a declaração XML UTF-8; o HTML embute o SVG sem ela', () => {
  const d = tmp();
  assert.equal(rodar([MINIMO, '--saida', d, '--nome', '01-minimo']).status, 0);
  const svg = readFileSync(join(d, '01-minimo.svg'), 'utf8');
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg'));
  assert.equal(readFileSync(join(d, '01-minimo.html'), 'utf8').includes('<?xml'), false);
});
