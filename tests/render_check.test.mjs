import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync, chmodSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GERAR = fileURLToPath(new URL('../scripts/gerar.mjs', import.meta.url));
const RENDER = fileURLToPath(new URL('../scripts/render_check.py', import.meta.url));
const MINIMO = fileURLToPath(new URL('./fixtures/minimo.json', import.meta.url));

const temChrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
  .some(existsSync) || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .some((c) => spawnSync('which', [c]).status === 0);

test('captura: 4 + 2 x passos PNGs não vazios; escuro e claro diferem', { skip: !temChrome && 'Chrome ausente', timeout: 240000 }, () => {
  const d = mkdtempSync(join(tmpdir(), 'dv-rc-'));
  const g = spawnSync('node', [GERAR, MINIMO, '--saida', d, '--nome', '01-minimo'], { encoding: 'utf8' });
  assert.equal(g.status, 0, g.stderr);
  const passos = JSON.parse(readFileSync(join(d, '01-minimo.diagram.json'), 'utf8')).flows
    .reduce((s, f) => s + f.passos.length, 0);
  const saida = join(d, 'cap');
  const r = spawnSync('python3', [RENDER, join(d, '01-minimo.html'), '--saida', saida], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const pngs = readdirSync(saida).filter((f) => f.endsWith('.png'));
  assert.equal(pngs.length, 4 + 2 * passos);
  for (const f of pngs) assert.ok(statSync(join(saida, f)).size > 0, f);
  assert.ok(pngs.includes('svg-escuro.png') && pngs.includes('passo-01-claro.png'));
  assert.ok(pngs.includes('repouso-escuro.png') && pngs.includes('repouso-claro.png'));
  assert.notDeepEqual(readFileSync(join(saida, 'repouso-escuro.png')), readFileSync(join(saida, 'repouso-claro.png')));
  assert.notDeepEqual(readFileSync(join(saida, 'svg-escuro.png')), readFileSync(join(saida, 'svg-claro.png')));
  assert.notDeepEqual(readFileSync(join(saida, 'passo-01-escuro.png')), readFileSync(join(saida, 'passo-01-claro.png')));
  assert.notDeepEqual(readFileSync(join(saida, 'passo-01-escuro.png')), readFileSync(join(saida, 'passo-02-escuro.png')));
  assert.ok(r.stdout.includes('passo-02-claro.png'));
});

const geraBase = () => {
  const d = mkdtempSync(join(tmpdir(), 'dv-rc-'));
  assert.equal(spawnSync('node', [GERAR, MINIMO, '--saida', d, '--nome', '01-minimo'], { encoding: 'utf8' }).status, 0);
  return d;
};

test('Chrome ausente (DIAGRAMAS_VIVOS_CHROME inexistente): exit 1 com mensagem', () => {
  const d = geraBase();
  const r = spawnSync('python3', [RENDER, join(d, '01-minimo.html')], { encoding: 'utf8', env: { ...process.env, DIAGRAMAS_VIVOS_CHROME: '/nao/existe/chrome' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Procurei em: \/nao\/existe\/chrome/);
});

test('captura que falha não aceita PNG antigo: exit 1 e PNG removido', () => {
  const d = geraBase();
  const saida = join(d, 'cap');
  mkdirSync(saida);
  writeFileSync(join(saida, 'svg-escuro.png'), 'antigo');
  const r = spawnSync('python3', [RENDER, join(d, '01-minimo.html'), '--saida', saida], { encoding: 'utf8', env: { ...process.env, DIAGRAMAS_VIVOS_CHROME: '/usr/bin/false' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /captura nao gerada/);
  assert.equal(existsSync(join(saida, 'svg-escuro.png')), false);
});

// Chrome falso: grava no PNG a URL que recebeu (último argumento). Roda sem Chrome real.
const chromeFalso = () => {
  const p = join(mkdtempSync(join(tmpdir(), 'dv-fake-')), 'chrome');
  writeFileSync(p, '#!/bin/sh\nfor a in "$@"; do case "$a" in --screenshot=*) out="${a#--screenshot=}";; esac; last="$a"; done\nprintf "%s" "$last" > "$out"\n');
  chmodSync(p, 0o755);
  return p;
};

test('captura o HTML em repouso (sem #passo) nos dois temas', () => {
  const d = geraBase();
  const saida = join(d, 'cap');
  const r = spawnSync('python3', [RENDER, join(d, '01-minimo.html'), '--saida', saida], { encoding: 'utf8', env: { ...process.env, DIAGRAMAS_VIVOS_CHROME: chromeFalso() } });
  assert.equal(r.status, 0, r.stderr);
  const pngs = readdirSync(saida).sort();
  assert.equal(pngs.length, 4 + 2 * 2);
  for (const tema of ['escuro', 'claro']) {
    const url = readFileSync(join(saida, `repouso-${tema}.png`), 'utf8');
    assert.match(url, /^file:.*01-minimo\.html$/, url);
  }
  assert.match(readFileSync(join(saida, 'passo-02-claro.png'), 'utf8'), /#passo=2$/);
});

test('apaga capturas antigas (passo-*, svg-*, repouso-*) antes de capturar; outros arquivos ficam', () => {
  const d = geraBase();
  const saida = join(d, 'cap');
  mkdirSync(saida);
  for (const f of ['passo-09-escuro.png', 'passo-09-claro.png', 'svg-velho.png', 'repouso-velho.png', 'outro.png', 'notas.txt'])
    writeFileSync(join(saida, f), 'antigo');
  const r = spawnSync('python3', [RENDER, join(d, '01-minimo.html'), '--saida', saida], { encoding: 'utf8', env: { ...process.env, DIAGRAMAS_VIVOS_CHROME: chromeFalso() } });
  assert.equal(r.status, 0, r.stderr);
  const arquivos = readdirSync(saida);
  for (const f of ['passo-09-escuro.png', 'passo-09-claro.png', 'svg-velho.png', 'repouso-velho.png']) assert.ok(!arquivos.includes(f), f);
  assert.ok(arquivos.includes('outro.png') && arquivos.includes('notas.txt'));
});

test('sem --saida: capturas vão para um diretório temporário fora do projeto, impresso no stdout', () => {
  const d = geraBase();
  const r = spawnSync('python3', [RENDER, join(d, '01-minimo.html')], { encoding: 'utf8', env: { ...process.env, DIAGRAMAS_VIVOS_CHROME: chromeFalso() } });
  assert.equal(r.status, 0, r.stderr);
  const linhas = r.stdout.trim().split('\n');
  assert.ok(linhas.length > 0);
  const esperado = join(realpathSync(tmpdir()), 'diagramas-vivos-capturas', '01-minimo');
  for (const l of linhas) assert.ok(realpathSyncSafe(l).startsWith(esperado), l);
  assert.equal(readdirSync(d).some((f) => f.endsWith('-capturas')), false);
});
const realpathSyncSafe = (p) => { try { return realpathSync(p); } catch { return p; } };
