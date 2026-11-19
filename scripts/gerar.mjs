#!/usr/bin/env node
// CLI: valida -> fontes -> layout -> (libavoid) -> geometria + orçamentos -> escreve SVG, HTML e cópia do modelo.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validar } from './lib/modelo.mjs';
import { carregarFontes, cobertura } from './lib/texto.mjs';
import { layoutFluxo } from './lib/layout-fluxo.mjs';
import { rotearLibavoid } from './lib/rota-libavoid.mjs';
import { verificarGeometria } from './lib/geometria.mjs';
import { emitirSvg } from './lib/svg.mjs';
import { emitirHtml } from './lib/html.mjs';

const limite = (env, padrao) => {
  const n = Number(process.env[env]);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};
const DIR_FONTES = fileURLToPath(new URL('../assets/fonts/', import.meta.url));

function sair(obj, codigo) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
  process.exit(codigo);
}

function lerArgs(argv) {
  const a = { entrada: null, saida: null, roteador: 'elk', nome: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--saida') a.saida = argv[++i];
    else if (v === '--roteador') a.roteador = argv[++i];
    else if (v === '--nome') a.nome = argv[++i];
    else if (!v.startsWith('--') && !a.entrada) a.entrada = v;
    else sair({ erro: `argumento desconhecido: ${v}`, erros: [`argumento desconhecido: ${v}`] }, 1);
  }
  return a;
}

export function slug(t) {
  return String(t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

function proximoNumero(dir) {
  let max = 0;
  for (const f of readdirSync(dir)) {
    if (!/^\d{2,}-.*\.(svg|html|diagram\.json)$/.test(f)) continue;
    const m = /^(\d+)-/.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

// Violações finais: geometria + orçamentos de bytes. Exit 2 quando a lista não é vazia.
export function avaliar(layout, bytes, limites = {}) {
  const lsvg = limites.svg ?? limite('DIAGRAMAS_VIVOS_LIMITE_SVG', 150 * 1024);
  const lhtml = limites.html ?? limite('DIAGRAMAS_VIVOS_LIMITE_HTML', 300 * 1024);
  const v = verificarGeometria(layout);
  if (bytes.svg >= lsvg) v.push({ tipo: 'orcamento', arquivo: 'svg', bytes: bytes.svg, limite: lsvg });
  if (bytes.html >= lhtml) v.push({ tipo: 'orcamento', arquivo: 'html', bytes: bytes.html, limite: lhtml });
  return v;
}

function textos(d) {
  const t = [d.titulo, d.subtitulo];
  for (const z of d.zonas ?? []) t.push(z.nome);
  for (const n of d.nos ?? []) t.push(n.nome, n.descricao);
  for (const e of d.arestas ?? []) t.push(e.rotulo);
  for (const f of d.flows ?? []) {
    t.push(f.titulo);
    for (const p of f.passos ?? []) t.push(p.nota);
  }
  return t.filter((x) => typeof x === 'string');
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  if (!args.entrada || !args.saida) {
    const msg = 'uso: gerar.mjs <diagram.json> --saida <dir> [--roteador elk|libavoid] [--nome NN-slug]';
    sair({ erro: msg, erros: [msg] }, 1);
  }
  if (!['elk', 'libavoid'].includes(args.roteador)) {
    sair({ erro: 'roteador inválido', erros: [`roteador inválido: ${args.roteador}`] }, 1);
  }
  if (args.nome && /[\\/]|\.\./.test(args.nome)) {
    sair({ erro: '--nome inválido', erros: [`--nome não pode conter / \\ ou ..: ${args.nome}`] }, 1);
  }
  let diagrama;
  try {
    diagrama = JSON.parse(readFileSync(args.entrada, 'utf8'));
  } catch (e) {
    sair({ erro: 'não foi possível ler o modelo', erros: [String(e.message)] }, 1);
  }
  const v = validar(diagrama);
  if (!v.ok) sair({ erro: 'modelo inválido', erros: v.erros }, 1);

  const fontes = await carregarFontes(DIR_FONTES);
  let layout = await layoutFluxo(diagrama, fontes);
  if (args.roteador === 'libavoid') layout = await rotearLibavoid(layout, diagrama);

  const avisos = cobertura(fontes, textos(diagrama));
  const svg = emitirSvg(diagrama, layout, fontes);
  const html = emitirHtml(diagrama, layout, svg);
  const bytes = { svg: Buffer.byteLength(svg), html: Buffer.byteLength(html) };
  const violacoes = avaliar(layout, bytes);

  const dir = resolve(args.saida);
  mkdirSync(dir, { recursive: true });
  let base = args.nome;
  if (!base) {
    const n = proximoNumero(dir);
    base = `${n < 100 ? String(n).padStart(2, '0') : String(n)}-${slug(diagrama.titulo) || 'diagrama'}`;
  }
  const arquivos = {
    svg: join(dir, `${base}.svg`),
    html: join(dir, `${base}.html`),
    modelo: join(dir, `${base}.diagram.json`),
  };
  writeFileSync(arquivos.svg, svg);
  writeFileSync(arquivos.html, html);
  writeFileSync(arquivos.modelo, `${JSON.stringify(diagrama, null, 2)}\n`);
  sair({ arquivos, bytes, violacoes, avisos, roteador: args.roteador }, violacoes.length ? 2 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((e) => sair({ erro: 'falha interna', erros: [String(e?.stack ?? e)] }, 1));
