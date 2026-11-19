import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GERAR = fileURLToPath(new URL('../scripts/gerar.mjs', import.meta.url));
const RENDER = fileURLToPath(new URL('../scripts/render_check.py', import.meta.url));
const MINIMO = fileURLToPath(new URL('./fixtures/minimo.json', import.meta.url));

const temChrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
  .some(existsSync) || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .some((c) => spawnSync('which', [c]).status === 0);

test('captura: 2 + 2 x passos PNGs não vazios; escuro e claro diferem', { skip: !temChrome && 'Chrome ausente', timeout: 240000 }, () => {
  const d = mkdtempSync(join(tmpdir(), 'dv-rc-'));
  const g = spawnSync('node', [GERAR, MINIMO, '--saida', d, '--nome', '01-minimo'], { encoding: 'utf8' });
  assert.equal(g.status, 0, g.stderr);
  const passos = JSON.parse(readFileSync(join(d, '01-minimo.diagram.json'), 'utf8')).flows
    .reduce((s, f) => s + f.passos.length, 0);
  const saida = join(d, 'cap');
  const r = spawnSync('python3', [RENDER, join(d, '01-minimo.html'), '--saida', saida], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const pngs = readdirSync(saida).filter((f) => f.endsWith('.png'));
  assert.equal(pngs.length, 2 + 2 * passos);
  for (const f of pngs) assert.ok(statSync(join(saida, f)).size > 0, f);
  assert.ok(pngs.includes('svg-escuro.png') && pngs.includes('passo-01-claro.png'));
  assert.notDeepEqual(readFileSync(join(saida, 'svg-escuro.png')), readFileSync(join(saida, 'svg-claro.png')));
  assert.notDeepEqual(readFileSync(join(saida, 'passo-01-escuro.png')), readFileSync(join(saida, 'passo-01-claro.png')));
  assert.notDeepEqual(readFileSync(join(saida, 'passo-01-escuro.png')), readFileSync(join(saida, 'passo-02-escuro.png')));
  assert.ok(r.stdout.includes('passo-02-claro.png'));
});

test('Chrome ausente: exit 1 com mensagem dos locais', () => {
  const r = spawnSync('python3', [RENDER, 'x.html'], { encoding: 'utf8', env: { PATH: '/nonexistent' } });
  if (temChrome && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) return; // caminho absoluto sempre acha
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Procurei em/);
});
