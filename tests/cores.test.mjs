import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contraste, PAPEIS, TIPOS, ICONES_COR, SUPERFICIE } from '../scripts/lib/cores.mjs';
import { PAPEIS_NO, TIPOS_ARESTA, ICONES } from '../scripts/lib/modelo.mjs';

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

// Rótulos das arestas são texto na cor do tipo sobre o fundo: AA (4.5). Ícones são gráfico sobre o card:
// 3:1 (WCAG 1.4.11).
for (const tema of ['escuro', 'claro']) {
  for (const tipo of TIPOS_ARESTA) {
    test(`contraste ${tema}/tipo ${tipo} >= 4.5 sobre o fundo`, () => {
      const c = TIPOS[tema][tipo];
      assert.match(c, /^#[0-9a-f]{6}$/);
      const r = contraste(c, PAPEIS[tema].fundo);
      assert.ok(r >= 4.5, `${c} vs ${PAPEIS[tema].fundo}: ${r}`);
    });
  }
  for (const icone of ICONES) {
    test(`contraste ${tema}/ícone ${icone} >= 3 sobre o card`, () => {
      const c = ICONES_COR[tema][icone];
      assert.match(c, /^#[0-9a-f]{6}$/);
      const r = contraste(c, SUPERFICIE[tema]);
      assert.ok(r >= 3, `${c} vs ${SUPERFICIE[tema]}: ${r}`);
    });
  }
}

test('referência: chamada e rpc com as cores de 02-agente.svg no claro', () => {
  assert.equal(TIPOS.claro.chamada, '#6a45d6');
  assert.equal(TIPOS.claro.rpc, '#4450cf');
  assert.equal(SUPERFICIE.claro, '#ffffff');
});

test('tokens.css: claro é o padrão (:root) e escuro em [data-theme="dark"], com os valores de cores.mjs', () => {
  const css = readFileSync(new URL('../assets/tokens.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /data-theme="light"/);
  const [claro, escuro] = css.split(':root[data-theme="dark"]');
  assert.ok(escuro, 'bloco escuro');
  assert.match(claro, /--bg: #f3f3f1;/);
  assert.match(escuro, /--bg: #0f0f0f;/);
  for (const papel of PAPEIS_NO) {
    assert.ok(escuro.includes(`--p-${papel}: ${PAPEIS.escuro[papel]};`), `escuro --p-${papel}`);
    assert.ok(claro.includes(`--p-${papel}: ${PAPEIS.claro[papel]};`), `claro --p-${papel}`);
  }
  for (const tipo of TIPOS_ARESTA) {
    assert.ok(escuro.includes(`--t-${tipo}: ${TIPOS.escuro[tipo]};`), `escuro --t-${tipo}`);
    assert.ok(claro.includes(`--t-${tipo}: ${TIPOS.claro[tipo]};`), `claro --t-${tipo}`);
  }
  for (const icone of ICONES) {
    assert.ok(escuro.includes(`--i-${icone}: ${ICONES_COR.escuro[icone]};`), `escuro --i-${icone}`);
    assert.ok(claro.includes(`--i-${icone}: ${ICONES_COR.claro[icone]};`), `claro --i-${icone}`);
  }
  assert.doesNotMatch(css, /--[kmn]-/);
  assert.match(css, /Portions derived from floorplan \(MIT\) \(c\) 2026 Hayden Smith/);
});
