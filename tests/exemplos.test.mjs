// Os 3 fixtures da F0 (exemplos/<nome>/diagram.json, reescritos dos exemplos da skill diagramas-legais):
// cada um valida e gera com o roteador ELK sem violação de geometria e dentro do orçamento, nas duas
// direções. DOWN é a direção usada nas saídas versionadas (ver docs/f0-resultado.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validar } from '../scripts/lib/modelo.mjs';

const GERAR = fileURLToPath(new URL('../scripts/gerar.mjs', import.meta.url));
const EXEMPLOS = ['deploy', 'fluxo-card', 'skill'];
const caminho = (n) => fileURLToPath(new URL(`../exemplos/${n}/diagram.json`, import.meta.url));

for (const nome of EXEMPLOS) {
  test(`${nome}: modelo válido, com zonas, retorno e flow de vários passos`, () => {
    const d = JSON.parse(readFileSync(caminho(nome), 'utf8'));
    assert.deepEqual(validar(d).erros, []);
    assert.ok(d.zonas.length >= 3);
    assert.ok(d.arestas.some((a) => a.papel === 'retorno'));
    assert.equal(d.flows.length, 1);
    assert.ok(d.flows[0].passos.length >= 5);
  });

  for (const direcao of ['DOWN', 'RIGHT']) {
    test(`${nome} ${direcao}: gera com ELK sem violações e dentro do orçamento`, () => {
      const saida = mkdtempSync(join(tmpdir(), 'dv-ex-'));
      const r = spawnSync('node', [GERAR, caminho(nome), '--saida', saida, '--roteador', 'elk', '--direcao', direcao], {
        encoding: 'utf8',
      });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const j = JSON.parse(r.stdout);
      assert.deepEqual(j.violacoes, []);
      assert.equal(j.roteador, 'elk');
      assert.ok(j.bytes.svg < 150 * 1024, `SVG ${j.bytes.svg} B`);
      assert.ok(j.bytes.html < 300 * 1024, `HTML ${j.bytes.html} B`);
    });
  }
}
