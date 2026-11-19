import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { carregarFontes, medir, quebrar, cobertura, ESTILO } from '../scripts/lib/texto.mjs';

const dir = fileURLToPath(new URL('../assets/fonts/', import.meta.url));
const fontes = await carregarFontes(dir);

test('medir: positivo e proporcional ao glifo', () => {
  assert.ok(medir(fontes, 'Build', ESTILO.nome) > 0);
  assert.ok(medir(fontes, 'WWWW', ESTILO.nome) > medir(fontes, 'iiii', ESTILO.nome));
});

test('medir: peso 700 mede mais que 400', () => {
  const t = 'Aprovação manual';
  const base = ESTILO.descricao;
  assert.ok(medir(fontes, t, { ...base, peso: 700 }) > medir(fontes, t, { ...base, peso: 400 }));
});

test('quebrar: corta em 2 linhas com reticências', () => {
  const l = quebrar(fontes, 'Verificação de integridade do pipeline de entrega contínua', ESTILO.nome, 180, 2);
  assert.equal(l.length, 2);
  for (const x of l) assert.ok(medir(fontes, x, ESTILO.nome) <= 180, x);
  assert.ok(l[1].endsWith('…'));
});

test('quebrar: texto curto fica em uma linha', () => {
  assert.deepEqual(quebrar(fontes, 'Build', ESTILO.nome, 180, 2), ['Build']);
});

test('cobertura: acentos e travessão ok; seta fora', () => {
  assert.deepEqual(cobertura(fontes, ['ação — ok']), []);
  assert.deepEqual(cobertura(fontes, ['sim → não']), ['→']);
});
