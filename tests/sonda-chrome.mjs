// Sonda no Chrome headless para os testes de SMIL e do passo a passo: grava o HTML num diretório
// temporário, roda --dump-dom e devolve o JSON que a página escreveu em <pre id="sonda">.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const CHROME = [process.env.DIAGRAMAS_VIVOS_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find((c) => c && existsSync(c));
export function sondarChrome(html, { nome = 'sonda.html', hash = '', orcamento = 4000, flags = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dv-smil-'));
  const arq = join(dir, nome);
  writeFileSync(arq, html);
  let r;
  try {
    r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${join(dir, 'perfil')}`,
    `--virtual-time-budget=${orcamento}`, ...flags, '--dump-dom', `file://${arq}${hash}`], { encoding: 'utf8', timeout: 60000 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const m = /<pre id="sonda">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
  assert.ok(m, `sem saída da sonda: ${r.stderr?.slice(0, 300)}`);
  return JSON.parse(m[1]);
}

