// O exemplo de diagram.json do SKILL.md gera 1624x735 (número citado na doc): se o gerador mudar, a doc avisa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GERAR = fileURLToPath(new URL('../scripts/gerar.mjs', import.meta.url));
const SKILL = fileURLToPath(new URL('../SKILL.md', import.meta.url));

test('exemplo do SKILL.md gera viewBox 1624x735 com exit 0', () => {
  const md = readFileSync(SKILL, 'utf8');
  const m = md.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(m, 'bloco json não encontrado no SKILL.md');
  const dir = mkdtempSync(join(tmpdir(), 'dv-skill-ex-'));
  const entrada = join(dir, 'diagram.json');
  writeFileSync(entrada, m[1]);
  const r = spawnSync(process.execPath, [GERAR, entrada, '--saida', dir, '--nome', '01-exemplo'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const svg = readFileSync(join(dir, '01-exemplo.svg'), 'utf8');
  assert.match(svg, /viewBox="0 0 1624 735"/);
});
