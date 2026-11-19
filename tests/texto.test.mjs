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

test('medir: larguras absolutas fixas (Inter 13px)', () => {
  const t = 'Aprovação manual';
  const e = { familia: 'sans', tamanho: 13 };
  assert.ok(Math.abs(medir(fontes, t, { ...e, peso: 400 }) - 114.5) <= 0.5);
  assert.ok(Math.abs(medir(fontes, t, { ...e, peso: 700 }) - 119.0) <= 0.5);
});

test('medir: mono independe do peso', () => {
  const e = { familia: 'mono', tamanho: 13 };
  assert.equal(medir(fontes, 'Aprovação', { ...e, peso: 100 }), medir(fontes, 'Aprovação', { ...e, peso: 900 }));
});

test('medir: peso fora do eixo é limitado a 100..900', () => {
  const e = { familia: 'sans', tamanho: 13 };
  const t = 'Aprovação manual';
  assert.equal(medir(fontes, t, { ...e, peso: -5 }), medir(fontes, t, { ...e, peso: 100 }));
  assert.equal(medir(fontes, t, { ...e, peso: 2000 }), medir(fontes, t, { ...e, peso: 900 }));
});

test('quebrar: descrição longa em 3 linhas', () => {
  const t = 'Executa a verificação completa de integridade dos artefatos gerados pelo pipeline de entrega contínua antes de liberar a publicação em produção para todos os clientes';
  const l = quebrar(fontes, t, ESTILO.descricao, 180, 3);
  assert.ok(l.length <= 3);
  for (const x of l) assert.ok(medir(fontes, x, ESTILO.descricao) <= 180, x);
  assert.ok(l[l.length - 1].endsWith('…'));
});
