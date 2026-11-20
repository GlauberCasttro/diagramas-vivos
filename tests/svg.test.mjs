import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { carregarFontes } from '../scripts/lib/texto.mjs';
import { layoutFluxo } from '../scripts/lib/layout-fluxo.mjs';
import { emitirSvg, caminhoArredondado, CEN_REPOUSO } from '../scripts/lib/svg.mjs';
import { validar } from '../scripts/lib/modelo.mjs';
import { TIPOS, PAPEIS, contraste } from '../scripts/lib/cores.mjs';
import { CHROME, sondarChrome } from './sonda-chrome.mjs';

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
    // O <style> vai cru num documento XML: nenhum "<" ou "&" dentro dele (quebraria o parse do .svg).
    const estilo = svg.slice(svg.indexOf('<style>') + 7, svg.indexOf('</style>'));
    assert.ok(!/[<&]/.test(estilo), 'caractere de marcação dentro do <style>');
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
      // id estável do path: alvo do mpath da animação SMIL (Task 14)
      assert.match(bloco, new RegExp(`<path id="a-${a.id}" class="trace`));
      assert.match(bloco, /class="flow"/);
    }
    for (const n of d.nos) assert.match(svg, new RegExp(`<g id="n-${n.id}" class="no [^"]*" data-id="${n.id}"`));
    assert.match(svg, /prefers-reduced-motion/);
    assert.ok(Buffer.byteLength(svg) < 150 * 1024, `${Buffer.byteLength(svg)} bytes`);
  });
}

test('minimo: caminho feliz corre; legenda cita o tipo padrão "chamada" e não "gate"', async () => {
  const d = ler('minimo.json');
  const svg = await gerar(d);
  assert.match(svg, /<g class="aresta papel-feliz tipo-chamada corre" data-id="a-b"/);
  const legenda = legendaDe(svg);
  assert.match(legenda, />chamada</);
  assert.doesNotMatch(legenda, /gate|retorno|proposto|RPC/i);
  assert.match(svg, /@keyframes fluxo/);
});

test('retorno: retorno tracejado, gate na legenda, cabeçalho e rodapé', async () => {
  const d = ler('retorno.json');
  const svg = await gerar(d);
  assert.match(svg, /<g class="aresta papel-retorno tipo-chamada" data-id="gate-build"><path id="a-gate-build" class="trace ret"/);
  assert.match(svg, /\.ret[^{]*\{[^}]*stroke-dasharray/);
  const legenda = legendaDe(svg);
  for (const t of ['gate', 'retorno', 'chamada']) assert.match(legenda, new RegExp(`>${t}<`));
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

test('nivel proposto: contorno tracejado (card e aresta); legenda cita proposto', async () => {
  const d = ler('minimo.json');
  d.nos[1].nivel = 'proposto';
  d.arestas[0].nivel = 'proposto';
  const svg = await gerar(d);
  assert.match(svg, /<g id="n-b" class="no papel-neutro icone-servico proposto" data-id="b"/);
  assert.match(svg, /<g class="aresta papel-feliz tipo-chamada corre proposto" data-id="a-b"/);
  assert.match(svg, /\.no\.proposto \.card[^{]*\{[^}]*stroke-dasharray/);
  assert.match(svg, /\.aresta\.proposto \.trace[^{]*\{[^}]*stroke-dasharray/);
  assert.match(legendaDe(svg), />proposto</);
});

test('tema padrão é o claro da referência: fundo #f3f3f1 e grade de pontos de 24 px; escuro sob demanda', async () => {
  const d = ler('minimo.json');
  const claro = await gerar(d);
  assert.doesNotMatch(claro.split('\n')[0], /data-theme/);
  assert.match(claro, /<rect class="fundo"[^>]*fill="#f3f3f1"/);
  assert.match(claro, /<pattern id="grade" width="24" height="24" patternUnits="userSpaceOnUse">/);
  assert.match(claro, /<rect class="grade"[^>]*fill="url\(#grade\)"/);
  assert.equal(claro, await gerar(d, { tema: 'claro' }));
  const escuro = await gerar(d, { tema: 'escuro' });
  assert.match(escuro, /^<svg[^>]*data-theme="dark"/);
  assert.match(escuro, /<rect class="fundo"[^>]*fill="#0f0f0f"/);
  const parado = await gerar(d, { animar: false });
  assert.doesNotMatch(parado, /animation:\s*fluxo/);
  assert.equal(parado, await gerar(d, { animar: false }));
});

test('um ladrilho de ícone 30×30 com ícone em traço por nó; ícone padrão pelo papel; gate vermelho', async () => {
  const d = ler('retorno.json');
  const svg = await gerar(d);
  assert.equal(conta(svg, '<rect class="ladrilho" '), d.nos.length);
  assert.equal(conta(svg, '<path class="icone" '), d.nos.length);
  assert.match(svg, /<rect class="ladrilho" x="[\d.]+" y="[\d.]+" width="30" height="30" rx="10"\/>/);
  assert.match(svg, /<path class="icone" transform="translate\([\d.]+,[\d.]+\)" d="M/);
  // retorno.json tem um nó gate: ícone gate e cor do papel gate
  assert.match(svg, /<g id="n-gate" class="no papel-gate icone-gate" data-id="gate"/);
  assert.match(svg, /\.no\.papel-gate \{\s*--c: var\(--p-gate\);/);
  // ícone explícito vence o padrão do papel
  const m = ler('minimo.json');
  m.nos[0].icone = 'pessoa';
  m.nos[1].papel = 'memoria';
  const s2 = await gerar(m);
  assert.match(s2, /<g id="n-a" class="no papel-neutro icone-pessoa" data-id="a"/);
  assert.match(s2, /<g id="n-b" class="no papel-memoria icone-banco" data-id="b"/);
});

test('selo em pílula, escapado', async () => {
  const d = ler('minimo.json');
  d.nos[0].selo = 'M<&>"';
  assert.ok(validar(d).ok);
  const svg = await gerar(d);
  const card = svg.slice(svg.indexOf('data-id="a"')).split('</g>\n')[0];
  assert.match(card, /<g class="selo"><rect [^>]*height="21" rx="10.5"\/><text [^>]*>M&lt;&amp;&gt;&quot;<\/text><\/g>/);
  assert.equal(conta(svg, '<g class="selo">'), 1);
});

test('cor do traço = cor do tipo da aresta (CSS do tipo e tokens)', async () => {
  const d = ler('minimo.json');
  d.arestas[0].tipo = 'rpc';
  const svg = await gerar(d);
  assert.match(svg, /<g class="aresta papel-feliz tipo-rpc corre" data-id="a-b"/);
  assert.match(svg, /\.tipo-rpc \{\s*--c: var\(--t-rpc\);/);
  assert.ok(svg.includes(`--t-rpc: ${TIPOS.claro.rpc};`));
  assert.match(svg, /\.aresta \.trace \{[^}]*stroke: var\(--c\)/);
  // legenda só com os tipos usados
  const legenda = legendaDe(svg);
  assert.match(legenda, />RPC</);
  assert.doesNotMatch(legenda, />chamada<|>dados<|>evento<|>fila</);
});

test('requisicao: volta (data-id <id>~volta, path#a-<id>--volta) tracejada com chevron na chegada, portas nas pontas, orçamento', async () => {
  const d = ler('requisicao.json');
  const L = await layoutFluxo(d, fontes);
  const svg = emitirSvg(d, L, fontes);
  const comResposta = d.arestas.filter((a) => a.resposta);
  assert.ok(comResposta.length > 0);
  for (const a of comResposta) {
    const tipo = a.tipo || 'chamada';
    const re = `<g class="aresta volta papel-${a.papel} tipo-${tipo}" data-id="${a.id}~volta"><path id="a-${a.id}--volta" class="trace ret"`;
    assert.ok(svg.includes(re), re);
    assert.ok(svg.includes(`>${a.resposta}<`), a.resposta);
  }
  const papel = (id) => d.arestas.find((x) => x.id === id)?.papel;
  const ret = L.arestas.filter((a) => a.id.endsWith('~volta') || ['retorno', 'falha'].includes(papel(a.id)));
  assert.equal(conta(svg, '<path class="chevron" '), ret.length);
  const tiposUsados = new Set(d.arestas.map((a) => a.tipo || 'chamada')).size;
  assert.equal(conta(svg, '<circle class="port" '), 2 * L.arestas.length + 2 * tiposUsados);
  // portas e rótulos ficam por cima dos cards
  assert.ok(svg.indexOf('<g class="portas">') > svg.indexOf('<g class="nos">'));
  const legenda = legendaDe(svg);
  for (const t of ['chamada', 'RPC', 'dados', 'evento', 'fila', 'retorno', 'proposto', 'gate'])
    assert.match(legenda, new RegExp(`>${t}<`));
  assert.ok(Buffer.byteLength(svg) < 150 * 1024, `${Buffer.byteLength(svg)} bytes`);
});

test('título largo alarga o canvas (texto não vaza)', async () => {
  const d = ler('minimo.json');
  d.titulo = 'Um título muito comprido que certamente passa da largura do conteúdo de dois cards lado a lado no diagrama mínimo';
  const L = await layoutFluxo(d, fontes);
  const svg = emitirSvg(d, L, fontes);
  const [, w] = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /);
  assert.ok(Number(w) > L.largura, `${w} > ${L.largura}`);
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

// Spec §7.4: cantos arredondados nas arestas, como o roundedPath do floorplan (raio 10).
test('caminhoArredondado: reta sem curva; cotovelo vira Q com raio 10; raio limitado à metade do segmento', () => {
  assert.equal(caminhoArredondado([[0, 0], [100, 0]]), 'M0,0 L100,0');
  assert.equal(caminhoArredondado([[0, 0], [100, 0], [100, 50]]), 'M0,0 L90,0 Q100,0 100,10 L100,50');
  assert.equal(caminhoArredondado([[0, 0], [8, 0], [8, 50]]), 'M0,0 L4,0 Q8,0 8,4 L8,50');
  // pontos colineares não ganham curva
  assert.equal(caminhoArredondado([[0, 0], [50, 0], [100, 0]]), 'M0,0 L50,0 L100,0');
});

test('arestas com cotovelo saem com cantos arredondados no SVG; último trecho é reta (seta alinhada)', async () => {
  const d = ler('retorno.json');
  const L = await layoutFluxo(d, fontes);
  const svg = emitirSvg(d, L, fontes);
  const comCotovelo = L.arestas.filter((a) => a.pontos.length > 2);
  assert.ok(comCotovelo.length > 0);
  for (const a of comCotovelo) {
    const bloco = svg.slice(svg.indexOf(`<g class="aresta`, svg.indexOf(`data-id="${a.id}"`) - 60));
    const dTrace = /class="trace[^"]*" d="([^"]+)"/.exec(bloco)[1];
    assert.match(dTrace, /Q/, a.id);
    assert.match(dTrace, /L[\d.-]+,[\d.-]+$/, a.id);
  }
});

// ---------- Task 14: cenários vivos (SMIL, sem JS), adendo 2 itens 1–6 ----------
const passosDeAresta = (d) => d.flows.flatMap((f) => f.passos).filter((p) => d.arestas.some((a) => a.id === p.ref));
const motions = (svg) => [...svg.matchAll(/<animateMotion id="(m\d+)" dur="([\d.]+)s" begin="([^"]+)"[^>]*><mpath href="#([^"]+)"\/><\/animateMotion>/g)]
  .map((m) => ({ id: m[1], dur: +m[2], begin: m[3], href: m[4] }));

for (const nome of ['agente.json', 'minimo.json', 'retorno.json', 'laco.json', 'requisicao.json']) {
  test(`${nome}: um animateMotion por passo de aresta, mpath válido, cadeia em loop`, async () => {
    const d = ler(nome);
    const svg = await gerar(d);
    const ms = motions(svg);
    assert.equal(conta(svg, '<animateMotion'), passosDeAresta(d).length);
    assert.equal(ms.length, passosDeAresta(d).length);
    const idsPath = new Set([...svg.matchAll(/<path id="([^"]+)"/g)].map((m) => m[1]));
    for (const m of ms) {
      assert.ok(idsPath.has(m.href), `mpath #${m.href}`);
      assert.ok(m.dur >= 0.3, `${m.id} dur ${m.dur}`);
    }
    // ids do DOM nunca levam "~"
    for (const [, id] of svg.matchAll(/ id="([^"]+)"/g)) assert.match(id, /^[A-Za-z0-9_-]+$/, id);
    // cadeia: m1..mN em ordem; o primeiro começa em 0.5s e repete depois do último
    const cadeia = [...svg.matchAll(/ id="(m\d+)"[^>]* begin="([^"]+)"|<animate[^>]* id="(m\d+)"[^>]* begin="([^"]+)"/g)];
    const nums = [...svg.matchAll(/ id="m(\d+)"/g)].map((m) => +m[1]).sort((a, b) => a - b);
    const N = nums.length;
    assert.deepEqual(nums, Array.from({ length: N }, (_, i) => i + 1));
    assert.ok(cadeia.length >= 1);
    const primeiro = new RegExp(` id="m1"[^>]* begin="0\\.5s;m${N}\\.end\\+1\\.1s"`);
    assert.match(svg, primeiro);
    // uma linha de cenário por flow, no rodapé
    assert.equal(conta(svg, '<text class="cen"'), d.flows.length);
    d.flows.forEach((f, i) => assert.ok(svg.includes(`<tspan class="n">${i + 1}. ${f.titulo}</tspan>`), f.titulo));
    assert.ok(Buffer.byteLength(svg) < 150 * 1024);
  });
}

test('agente: ritmo, volta pela aresta --volta, chegada pisca, .flow só no cenário, rodapé', async () => {
  const d = ler('agente.json');
  const L = await layoutFluxo(d, fontes);
  const svg = emitirSvg(d, L, fontes);
  const ms = motions(svg);
  assert.deepEqual(ms.map((m) => m.href), ['a-pede', 'a-chama', 'a-chama--volta', 'a-lembra', 'a-pede', 'a-revisa']);
  assert.deepEqual(ms.map((m) => m.id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
  assert.equal(ms[0].begin, '0.5s;m6.end+1.1s');
  assert.equal(ms[1].begin, 'm1.end+0.25s');
  assert.equal(ms[4].begin, 'm4.end+1.1s'); // entre cenários
  // dur = max(0,3; comprimento/120 × 0,38)
  const comp = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const geo = new Map(L.arestas.map((a) => [a.id, a]));
  const esperado = Math.max(0.3, (comp(geo.get('chama').pontos) / 120) * 0.38);
  assert.ok(Math.abs(ms[1].dur - esperado) < 0.02, `${ms[1].dur} vs ${esperado}`);
  // token visível só durante o salto
  assert.match(svg, /<circle class="token" r="3\.4" opacity="0"><set attributeName="opacity" to="1" begin="m3\.begin" end="m3\.end"\/><animateMotion id="m3"/);
  assert.match(svg, /<g id="requisicao">/);
  // chegada: contorno do card pisca 0,7 s (ferramentas chega em m2; planejador em m1 e m3 e m5)
  const card = (id) => svg.slice(svg.indexOf(`<g id="n-${id}"`)).split('</g>\n')[0];
  assert.match(card('ferramentas'), /<rect class="chegada"[^>]*opacity="0"><animate attributeName="opacity" values="0;1;0" dur="0\.7s" begin="m2\.end"\/><\/rect>/);
  assert.match(card('planejador'), /begin="m1\.end;m3\.end;m5\.end"/);
  assert.match(card('usuario'), /begin="m1\.begin;m5\.begin"/);
  // .flow visível só enquanto o cenário toca
  const flowDe = (id) => svg.slice(svg.indexOf(`data-id="${id}"`)).split('</g>')[0];
  assert.match(flowDe('pede'), /<path class="flow" d="[^"]+" opacity="0"><set attributeName="opacity" to="\.95" begin="m1\.begin" end="m4\.end\+0\.5s"\/><set attributeName="opacity" to="\.95" begin="m5\.begin" end="m6\.end\+0\.5s"\/><\/path>/);
  assert.match(flowDe('chama~volta'), /begin="m3\.begin" end="m4\.end\+0\.5s"/);
  assert.doesNotMatch(flowDe('revisa'), /m1\.begin/);
  // rodapé: "N. Título: A → B → …", forte enquanto toca
  assert.match(svg, /<text class="cen"[^>]*opacity="\.8"><tspan class="n">1\. Pedido com uso de ferramenta<\/tspan><tspan>: Usuário → Planejador → Ferramentas → Planejador → Memória<\/tspan><set attributeName="opacity" to="1" begin="m1\.begin" end="m4\.end\+0\.5s"\/><\/text>/);
  assert.match(svg, /<tspan>: Usuário → Planejador → Revisor<\/tspan><set attributeName="opacity" to="1" begin="m5\.begin" end="m6\.end\+0\.5s"\/>/);
  // movimento reduzido: sem token e sem .flow
  assert.match(svg, /prefers-reduced-motion: reduce\)[^@]*\.token[^}]*display: none/);
  // rodapé cabe no canvas
  const [, , altura] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const ys = [...svg.matchAll(/<text class="cen" x="[\d.]+" y="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(Math.max(...ys) < +altura, `${ys} < ${altura}`);
});

test('passo que é nó só pisca o card e mantém a cadeia', async () => {
  const d = ler('minimo.json'); // passos: nó a, aresta a-b
  const svg = await gerar(d);
  const card = svg.slice(svg.indexOf('<g id="n-a"')).split('</g>\n')[0];
  assert.match(card, /<animate id="m1" attributeName="opacity" values="0;1;0" dur="0\.7s" begin="0\.5s;m2\.end\+1\.1s"\/>/);
  assert.match(svg, /<animateMotion id="m2" dur="[\d.]+s" begin="m1\.end\+0\.25s"/);
  assert.match(svg, /<tspan>: A → B<\/tspan>/);
});

test('animar:false não emite SMIL', async () => {
  const svg = await gerar(ler('agente.json'), { animar: false });
  assert.doesNotMatch(svg, /<animateMotion|<animate |<set |class="token"/);
});

// Legenda dos cenários em repouso (opacidade CEN_REPOUSO sobre o fundo): AA (>= 4,5:1) nos dois temas,
// com a cor composta de verdade (texto × opacidade + fundo × (1 − opacidade)).
test('linhas de cenário em repouso passam AA nos dois temas (cor composta)', async () => {
  const tokens = readFileSync(new URL('../assets/tokens.css', import.meta.url), 'utf8');
  const bloco = (sel) => tokens.slice(tokens.indexOf(sel)).split('}')[0];
  const cor = (b, nome) => new RegExp(`${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(b)[1];
  const mix = (f, b, a) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(f.slice(i, i + 2), 16) * a + parseInt(b.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
  const a = Number(CEN_REPOUSO);
  assert.ok(a > 0 && a <= 1);
  for (const [tema, sel] of [['claro', ':root {'], ['escuro', ':root[data-theme="dark"] {']]) {
    const b = bloco(sel);
    const fundo = cor(b, '--bg');
    assert.equal(fundo, PAPEIS[tema].fundo);
    for (const nome of ['--text-2', '--text']) {
      const c = contraste(mix(cor(b, nome), fundo, a), fundo);
      assert.ok(c >= 4.5, `${tema} ${nome}: ${c.toFixed(2)}:1`);
    }
  }
  const svg = await gerar(ler('agente.json'));
  assert.equal(conta(svg, `<text class="cen" x="32" y=`), 2);
  assert.equal(conta(svg, ` opacity="${CEN_REPOUSO}"><tspan class="n">`), 2);
});

// SMIL de verdade: Chrome headless, timeline pausada e posicionada (pauseAnimations/setCurrentTime).
test('SMIL no Chrome: em instantes diferentes o token está em arestas diferentes', { skip: !CHROME && 'Chrome ausente', timeout: 90000 }, async () => {
  const svg = await gerar(ler('agente.json'));
  const html = `<!doctype html><meta charset="utf-8"><body>${svg}<pre id="sonda"></pre><script>
addEventListener('load', async () => {
  const s = document.querySelector('svg'); s.pauseAnimations(); const out = {};
  for (const t of [0.7, 1.3, 2.9]) {
    s.setCurrentTime(t); await new Promise((r) => setTimeout(r, 100));
    const tok = [...document.querySelectorAll('circle.token')].filter((e) => getComputedStyle(e).opacity !== '0')
      .map((e) => { const r = e.getBoundingClientRect(); return { href: e.querySelector('mpath').getAttribute('href'), x: Math.round(r.x), y: Math.round(r.y) }; });
    out[t] = tok;
  }
  document.getElementById('sonda').textContent = JSON.stringify(out);
});
</script>`;
  const out = sondarChrome(html);
  assert.deepEqual(out['0.7'].map((t) => t.href), ['#a-pede']);
  assert.deepEqual(out['1.3'].map((t) => t.href), ['#a-chama']);
  assert.deepEqual(out['2.9'].map((t) => t.href), ['#a-lembra']);
  assert.notDeepEqual([out['0.7'][0].x, out['0.7'][0].y], [out['1.3'][0].x, out['1.3'][0].y]);
});

// ---------- F0.2: tudo em movimento ----------
// Em repouso toda aresta (ida e volta) mostra um tracejado fraco correndo devagar, na cor do tipo; o .flow
// forte do cenário (SMIL) continua por cima. Movimento reduzido: o tracejado de repouso some.
for (const nome of ['agente.json', 'minimo.json', 'retorno.json', 'laco.json', 'requisicao.json']) {
  test(`${nome}: toda aresta (inclusive volta) tem .flow-repouso abaixo do .flow`, async () => {
    const d = ler(nome);
    const L = await layoutFluxo(d, fontes);
    const svg = emitirSvg(d, L, fontes);
    const blocos = [...svg.matchAll(/<g class="aresta [^"]*" data-id="([^"]+)">([\s\S]*?)<\/g>\n/g)];
    assert.equal(blocos.length, L.arestas.length);
    if (nome === 'requisicao.json') assert.ok(blocos.some((b) => b[1].endsWith('~volta')), 'fixture tem volta');
    for (const [, id, corpo] of blocos) {
      const trace = /<path id="[^"]+" class="trace[^"]*" d="([^"]+)"/.exec(corpo);
      const rep = /<path class="flow-repouso" d="([^"]+)"\/>/.exec(corpo);
      assert.ok(rep, `${id}: sem .flow-repouso`);
      assert.equal(rep[1], trace[1], `${id}: mesmo traçado`);
      assert.ok(corpo.indexOf('flow-repouso') < corpo.indexOf('class="flow"'), `${id}: repouso abaixo do .flow`);
    }
    assert.ok(Buffer.byteLength(svg) < 150 * 1024, `${Buffer.byteLength(svg)} bytes`);
  });
}

test('.flow-repouso: cor do tipo, opacidade baixa, animação CSS contínua com --vel; reduced-motion desliga', async () => {
  const svg = await gerar(ler('requisicao.json'));
  const estilo = svg.slice(svg.indexOf('<style>') + 7, svg.indexOf('</style>'));
  const regra = (sel) => [...estilo.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => m[1].includes(sel)).map((m) => m[2]).join(';');
  const base = regra('.flow-repouso');
  assert.match(base, /stroke:\s*var\(--c\)/);
  const op = /(?:^|;)\s*opacity:\s*([\d.]+)/.exec(base);
  assert.ok(op && +op[1] >= 0.25 && +op[1] <= 0.45, `opacity ${op?.[1]}`);
  assert.match(base, /animation:\s*fluxo calc\([\d.]+s \/ var\(--vel, 1\)\) linear infinite/);
  // o .flow forte também acompanha a velocidade
  assert.match(estilo, /\.aresta \.flow \{ animation: fluxo calc\(1\.1s \/ var\(--vel, 1\)\) linear infinite; \}/);
  const reduz = estilo.slice(estilo.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduz, /\.flow-repouso[^{}]*\{[^}]*display: none/);
  // sem animação (animar:false), nada de repouso que corre
  assert.doesNotMatch(await gerar(ler('requisicao.json'), { animar: false }), /class="flow-repouso"/);
});
