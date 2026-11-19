import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contraste, PAPEIS } from '../scripts/lib/cores.mjs';
import { PAPEIS_NO } from '../scripts/lib/modelo.mjs';

test('contraste: valores de referência WCAG', () => {
  assert.equal(Math.round(contraste('#000000', '#ffffff') * 100) / 100, 21);
  assert.equal(contraste('#777777', '#777777'), 1);
  assert.equal(contraste('#fff', '#000'), contraste('#000000', '#FFFFFF'));
});

test('papéis: fundos fixos e escuro conforme os tokens do floorplan', () => {
  assert.equal(PAPEIS.escuro.fundo, '#0f0f0f');
  assert.equal(PAPEIS.claro.fundo, '#f3f3f1');
  assert.deepEqual(
    { ...PAPEIS.escuro },
    { fundo: '#0f0f0f', feliz: '#6fd7a8', gate: '#f28b8b', memoria: '#7aa7ff', neutro: '#b4b4b4', externo: '#e3a6f0' },
  );
});

for (const tema of ['escuro', 'claro']) {
  for (const papel of PAPEIS_NO) {
    test(`contraste ${tema}/${papel} >= 4.5`, () => {
      const c = PAPEIS[tema][papel];
      assert.match(c, /^#[0-9a-f]{6}$/);
      const r = contraste(c, PAPEIS[tema].fundo);
      assert.ok(r >= 4.5, `${c} vs ${PAPEIS[tema].fundo}: ${r}`);
    });
  }
}

test('tokens.css declara os papéis com os mesmos valores de cores.mjs', () => {
  const css = readFileSync(new URL('../assets/tokens.css', import.meta.url), 'utf8');
  const [escuro, claro] = css.split(':root[data-theme="light"]');
  for (const papel of PAPEIS_NO) {
    assert.ok(escuro.includes(`--p-${papel}: ${PAPEIS.escuro[papel]};`), `escuro --p-${papel}`);
    assert.ok(claro.includes(`--p-${papel}: ${PAPEIS.claro[papel]};`), `claro --p-${papel}`);
  }
  assert.doesNotMatch(css, /--[kmn]-/);
  assert.match(css, /Portions derived from floorplan \(MIT\) \(c\) 2026 Hayden Smith/);
});
