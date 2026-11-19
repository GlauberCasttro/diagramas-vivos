import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { carregarFontes } from '../scripts/lib/texto.mjs';
import { layoutFluxo } from '../scripts/lib/layout-fluxo.mjs';
import { verificarGeometria } from '../scripts/lib/geometria.mjs';
import { rotearLibavoid } from '../scripts/lib/rota-libavoid.mjs';

const fontes = await carregarFontes(fileURLToPath(new URL('../assets/fonts/', import.meta.url)));
const ler = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const naBorda = (p, n, tol = 1) =>
  p[0] >= n.x - tol && p[0] <= n.x + n.w + tol && p[1] >= n.y - tol && p[1] <= n.y + n.h + tol &&
  (Math.abs(p[0] - n.x) <= tol || Math.abs(p[0] - n.x - n.w) <= tol ||
    Math.abs(p[1] - n.y) <= tol || Math.abs(p[1] - n.y - n.h) <= tol);

for (const fx of ['minimo.json', 'retorno.json', 'laco.json'])
  for (const direcao of ['RIGHT', 'DOWN'])
    test(`${fx} ${direcao}: nós/zonas intactos, ortogonal, bordas de→para, geometria limpa`, async () => {
      const d = ler(fx);
      const base = await layoutFluxo(d, fontes, { direcao });
      const L = await rotearLibavoid(structuredClone(base), d);
      assert.deepEqual(L.nos, base.nos);
      assert.deepEqual(L.zonas, base.zonas);
      assert.equal(L.arestas.length, base.arestas.length);
      const N = new Map(L.nos.map((n) => [n.id, n]));
      for (const a of d.arestas) {
        const la = L.arestas.find((x) => x.id === a.id);
        const lb = base.arestas.find((x) => x.id === a.id);
        if (a.de === a.para) assert.deepEqual(la.pontos, lb.pontos, 'laço mantém pontos do ELK');
        assert.ok(naBorda(la.pontos[0], N.get(a.de)), `${a.id}: início fora da borda de ${a.de}`);
        assert.ok(naBorda(la.pontos.at(-1), N.get(a.para)), `${a.id}: fim fora da borda de ${a.para}`);
        for (let i = 1; i < la.pontos.length; i++) {
          const [x0, y0] = la.pontos[i - 1], [x1, y1] = la.pontos[i];
          assert.ok(Math.abs(x0 - x1) < 0.5 || Math.abs(y0 - y1) < 0.5, `${a.id} segmento ${i} diagonal`);
        }
        if (lb.rotulo) {
          assert.deepEqual(la.rotulo.linhas, lb.rotulo.linhas);
          assert.equal(la.rotulo.w, lb.rotulo.w);
          assert.equal(la.rotulo.h, lb.rotulo.h);
        }
      }
      assert.deepEqual(verificarGeometria(L), []);
    });
