import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { carregarFontes } from '../scripts/lib/texto.mjs';
import { layoutFluxo } from '../scripts/lib/layout-fluxo.mjs';
import { emitirSvg } from '../scripts/lib/svg.mjs';
import { validar } from '../scripts/lib/modelo.mjs';

const fontes = await carregarFontes(fileURLToPath(new URL('../assets/fonts/', import.meta.url)));
const ler = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const conta = (s, sub) => s.split(sub).length - 1;

async function gerar(d, opcoes) {
  const L = await layoutFluxo(d, fontes);
  return emitirSvg(d, L, fontes, opcoes);
}

const legendaDe = (svg) => svg.slice(svg.indexOf('<g class="legenda"')).split('</g>\n')[0];

// arestas papel feliz referenciadas nos passos do primeiro flow
function caminhoFeliz(d) {
  const refs = new Set(d.flows[0].passos.map((p) => p.ref));
  return new Set(d.arestas.filter((a) => a.papel === 'feliz' && refs.has(a.id)).map((a) => a.id));
}

for (const nome of ['minimo.json', 'retorno.json', 'laco.json']) {
  test(`${nome}: SVG autocontido, contagens e caminho feliz`, async () => {
    const d = ler(nome);
    const svg = await gerar(d);
    assert.ok(svg.startsWith('<svg'));
    assert.match(svg, /@font-face/);
    assert.match(svg, /src:url\(data:font\/woff2;base64,/);
    assert.ok(!svg.includes('foreignObject'));
    assert.ok(!svg.includes('<script'));
    // A única URL permitida é o identificador de namespace do SVG (não é recurso carregado):
    // sem ele o arquivo .svg não renderiza como imagem.
    const semNs = svg.replace(' xmlns="http://www.w3.org/2000/svg"', '');
    assert.ok(!semNs.includes('http://'), 'http://');
    assert.ok(!semNs.includes('https://'), 'https://');
    assert.equal(conta(svg, 'class="no '), d.nos.length);
    assert.equal(conta(svg, 'class="aresta '), d.arestas.length);
    const corre = [...svg.matchAll(/<g class="aresta ([^"]*)" data-id="([^"]+)"/g)]
      .filter((m) => m[1].split(' ').includes('corre'))
      .map((m) => m[2]);
    assert.deepEqual(new Set(corre), caminhoFeliz(d));
    for (const a of d.arestas) {
      const bloco = svg.slice(svg.indexOf(`data-id="${a.id}"`)).split('</g>')[0];
      assert.match(bloco, /class="trace"/);
      assert.match(bloco, /class="flow"/);
      assert.match(bloco, /marker-end="url\(#seta-/);
    }
    assert.match(svg, /prefers-reduced-motion/);
    assert.ok(Buffer.byteLength(svg) < 150 * 1024, `${Buffer.byteLength(svg)} bytes`);
  });
}

test('minimo: caminho feliz corre; legenda cita "caminho feliz" e não "gate"', async () => {
  const d = ler('minimo.json');
  const svg = await gerar(d);
  assert.match(svg, /<g class="aresta papel-feliz corre" data-id="a-b"/);
  const legenda = legendaDe(svg);
  assert.match(legenda, /caminho feliz/);
  assert.doesNotMatch(legenda, /gate/i);
  assert.match(svg, /@keyframes fluxo/);
});

test('retorno: retorno tracejado, gate na legenda, cabeçalho e rodapé', async () => {
  const d = ler('retorno.json');
  const svg = await gerar(d);
  assert.match(svg, /<g class="aresta papel-retorno" data-id="gate-build"/);
  assert.match(svg, /\.aresta\.papel-retorno \.trace[^{]*\{[^}]*stroke-dasharray/);
  const legenda = legendaDe(svg);
  for (const t of ['gate', 'retorno', 'caminho feliz']) assert.match(legenda, new RegExp(t));
  assert.doesNotMatch(legenda, /falha|proposto|externo/);
  assert.match(svg, /class="titulo"[^>]*>Entrega com retorno</);
  assert.match(svg, /class="subtitulo"[^>]*>Falha na verificação volta para a construção</);
  assert.match(svg, /class="rodape"[^>]*>tipo 1 · fluxo</);
  assert.match(svg, />aprovado</);
});

test('nome de 60 caracteres: no máximo 2 tspan de nome no card', async () => {
  const d = ler('minimo.json');
  d.nos[0].nome = 'Serviço de orquestração de demandas com aprovação manual xyz'.slice(0, 60);
  assert.equal(d.nos[0].nome.length, 60);
  assert.ok(validar(d).ok);
  const svg = await gerar(d);
  const card = svg.slice(svg.indexOf('data-id="a"')).split('</g>')[0];
  const n = conta(card, '<tspan class="nome"');
  assert.ok(n >= 1 && n <= 2, `tspans: ${n}`);
});

test('escapa & < > " de todo texto do modelo', async () => {
  const d = ler('minimo.json');
  d.titulo = 'A & B <x> "y"';
  d.nos[0].nome = '<b>&"';
  d.nos[0].descricao = 'a < b & c > d';
  d.arestas[0].rotulo = 'se "ok" & <pronto>';
  const svg = await gerar(d);
  assert.ok(!svg.includes('<x>') && !svg.includes('<b>') && !svg.includes('<pronto>'));
  assert.match(svg, /A &amp; B &lt;x&gt; &quot;y&quot;/);
  assert.match(svg, /&lt;b&gt;&amp;&quot;/);
});

test('nivel proposto: contorno tracejado + selo; legenda cita proposto', async () => {
  const d = ler('minimo.json');
  d.nos[1].nivel = 'proposto';
  d.arestas[0].nivel = 'proposto';
  const svg = await gerar(d);
  assert.match(svg, /<g class="no papel-neutro proposto" data-id="b"/);
  assert.match(svg, /<g class="aresta papel-feliz corre proposto" data-id="a-b"/);
  assert.match(svg, /\.no\.proposto \.card[^{]*\{[^}]*stroke-dasharray/);
  const card = svg.slice(svg.indexOf('data-id="b"')).split('</g>\n')[0];
  assert.match(card, /class="selo"/);
  assert.match(card, />proposto</);
  assert.match(legendaDe(svg), /proposto/);
});

test('tema claro: fundo claro e data-theme; animar:false sem animação em repouso', async () => {
  const d = ler('minimo.json');
  const claro = await gerar(d, { tema: 'claro' });
  assert.match(claro, /^<svg[^>]*data-theme="light"/);
  assert.match(claro, /<rect class="fundo"[^>]*fill="#f3f3f1"/);
  const escuro = await gerar(d);
  assert.match(escuro, /<rect class="fundo"[^>]*fill="#0f0f0f"/);
  const parado = await gerar(d, { animar: false });
  assert.doesNotMatch(parado, /animation:\s*fluxo/);
  assert.equal(parado, await gerar(d, { animar: false }));
});

test('título largo alarga o canvas (texto não vaza)', async () => {
  const d = ler('minimo.json');
  d.titulo = 'Um título muito comprido que certamente passa da largura do conteúdo de dois cards lado a lado no diagrama mínimo';
  const L = await layoutFluxo(d, fontes);
  const svg = emitirSvg(d, L, fontes);
  const [, w] = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /);
  assert.ok(Number(w) > L.largura, `${w} > ${L.largura}`);
});

test('retorno é vermelho: .papel-retorno no mesmo grupo de .papel-falha (--p-gate)', async () => {
  const svg = await gerar(ler('retorno.json'));
  const regra = svg.match(/^([^{}\n]*\.papel-falha[^{}\n]*)\{\s*--c:\s*var\(--p-gate\);\s*\}/m);
  assert.ok(regra, 'regra de --c da falha');
  assert.ok(regra[1].split(',').map((s) => s.trim()).includes('.papel-retorno'), regra[1]);
  assert.doesNotMatch(svg, /\.papel-retorno[^{]*\{\s*--c:\s*var\(--p-neutro\)/);
});

test('id do modelo ausente no layout: erro que cita o id', async () => {
  const d = ler('retorno.json');
  const L = await layoutFluxo(d, fontes);
  const semNo = { ...L, nos: L.nos.filter((n) => n.id !== 'gate') };
  assert.throws(() => emitirSvg(d, semNo, fontes), /gate/);
  const semAresta = { ...L, arestas: L.arestas.filter((a) => a.id !== 'gate-build') };
  assert.throws(() => emitirSvg(d, semAresta, fontes), /gate-build/);
});

// Em DOWN as arestas entram na zona pela faixa do nome: o nome é desenhado por cima das arestas,
// com halo da cor do fundo, para nenhuma seta riscar o texto.
test('nome da zona vem depois das arestas e tem halo do fundo', async () => {
  const d = ler('retorno.json');
  const svg = await gerar(d);
  const iArestas = svg.indexOf('<g class="arestas">');
  const iNomes = svg.indexOf('<g class="nomes-zona">');
  const iNos = svg.indexOf('<g class="nos">');
  assert.ok(iArestas >= 0 && iNomes > iArestas && iNos > iNomes, 'ordem zonas → arestas → nomes-zona → nós');
  for (const z of d.zonas) assert.ok(svg.includes(`data-zona="${z.id}"`) && svg.includes(`>${z.nome}</text>`), z.id);
  const zonas = svg.slice(svg.indexOf('<g class="zonas">'), iArestas);
  assert.equal(conta(zonas, '<text'), 0, 'texto de zona fora do grupo de nomes');
  assert.match(svg, /\.nomes-zona text \{[^}]*paint-order: stroke[^}]*stroke: var\(--bg\)/);
});
