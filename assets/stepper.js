/* Portions derived from floorplan (MIT) (c) 2026 Hayden Smith
   Origem: floorplan/assets/viewer.html (pan/zoom :1250-1347, centerOn :1411-1416, highlightFlow :1884-1905,
   teclado :2288-2304). Passo a passo guiado sem dependências: #passo=N (1-based, numeração global pelos
   flows em ordem) abre direto no passo N, sem transição. */
(() => {
  const D = JSON.parse(document.getElementById('dados').textContent);
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const palco = $('palco'), vp = $('vp'), svg = vp.querySelector('svg');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)');
  const semMovimento = () => reduz.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const elNo = new Map(), elAresta = new Map();
  svg.querySelectorAll('g.no[data-id]').forEach((g) => elNo.set(g.getAttribute('data-id'), g));
  svg.querySelectorAll('g.aresta[data-id]').forEach((g) => elAresta.set(g.getAttribute('data-id'), g));
  const fx = document.createElementNS(svg.namespaceURI, 'g');
  fx.setAttribute('class', 'fx');
  svg.appendChild(fx);

  const passos = [];
  D.flows.forEach((f) => f.passos.forEach((p, i) => passos.push({ flow: f, i, ref: p.ref, nota: p.nota || '' })));
  const N = passos.length;
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  let atual = 0; // 0 = repouso (só o caminho feliz do primeiro flow corre)
  let t = { x: 0, y: 0, k: 1 };
  let camera = null; // o que a câmera enquadra agora, para refazer no resize
  let timerAnim = 0, timerTocar = 0;

  // ---------------- câmera ----------------
  function aplicar() { vp.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.k})`; }
  function setT(n, animar) {
    t = n;
    clearTimeout(timerAnim);
    if (animar && !semMovimento()) {
      vp.classList.add('anim');
      timerAnim = setTimeout(() => vp.classList.remove('anim'), 520);
    } else vp.classList.remove('anim');
    aplicar();
  }
  function areaLivre() {
    const barra = $('barra').getBoundingClientRect();
    const y = barra.bottom + 12;
    return { x: 16, y, w: Math.max(120, innerWidth - 32), h: Math.max(120, innerHeight - y - 72) };
  }
  function centrar(c, k) {
    const a = areaLivre();
    return { k, x: a.x + a.w / 2 - (c.x + c.w / 2) * k, y: a.y + a.h / 2 - (c.y + c.h / 2) * k };
  }
  function ajustar(animar) {
    camera = null;
    const a = areaLivre();
    setT(centrar({ x: 0, y: 0, w: W, h: H }, Math.min(a.w / W, a.h / H, 1)), animar);
  }
  function enquadrarPasso(p, animar) {
    camera = p;
    const no = D.nos[p.ref];
    if (no) { setT(centrar(no, 1.4), animar); return; }
    const c = D.arestas[p.ref].caixa, folga = 80, a = areaLivre();
    const k = Math.min(a.w / (c.w + 2 * folga), a.h / (c.h + 2 * folga), 1.4);
    setT(centrar(c, k), animar);
  }
  function zoomPor(f, cx, cy) {
    cx ??= innerWidth / 2; cy ??= innerHeight / 2;
    const k = clamp(t.k * f, 0.1, 4);
    setT({ k, x: cx - (cx - t.x) * (k / t.k), y: cy - (cy - t.y) * (k / t.k) }, false);
  }

  // ---------------- realce ----------------
  function limpar() {
    for (const g of elNo.values()) g.classList.remove('hl', 'dim');
    for (const g of elAresta.values()) g.classList.remove('hl', 'dim');
    fx.textContent = '';
  }
  function pulso(id) {
    fx.textContent = '';
    if (!id || semMovimento()) return;
    const g = elAresta.get(id);
    const papel = [...g.classList].find((c) => c.startsWith('papel-')) || '';
    fx.setAttribute('class', `fx ${papel}`);
    const ns = svg.namespaceURI;
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('class', 'pulso');
    dot.setAttribute('r', '4.5');
    const anim = document.createElementNS(ns, 'animateMotion');
    for (const [k, v] of Object.entries({ dur: '1.5s', repeatCount: 'indefinite', begin: 'indefinite', calcMode: 'linear',
      path: g.querySelector('path.trace').getAttribute('d') })) anim.setAttribute(k, v);
    dot.appendChild(anim);
    fx.appendChild(dot);
    anim.beginElement?.();
  }
  function realcar(p) {
    const nos = new Set(), arestas = [];
    const a = D.arestas[p.ref];
    if (a) { arestas.push(p.ref); nos.add(a.de); nos.add(a.para); }
    else {
      nos.add(p.ref);
      // arestas que chegam ao nó vindas do nó do passo anterior (mesmo flow)
      const ant = p.i > 0 ? p.flow.passos[p.i - 1].ref : null;
      const deNo = ant == null ? null : D.arestas[ant] ? D.arestas[ant].para : ant;
      if (deNo != null)
        for (const [id, x] of Object.entries(D.arestas)) if (x.de === deNo && x.para === p.ref) arestas.push(id);
    }
    for (const [id, g] of elNo) g.classList.add(nos.has(id) ? 'hl' : 'dim');
    for (const [id, g] of elAresta) g.classList.add(arestas.includes(id) ? 'hl' : 'dim');
    pulso(arestas[0]);
  }

  // ---------------- barra ----------------
  const dots = $('b-dots');
  for (let j = 0; j < N; j++) dots.appendChild(document.createElement('i'));
  function atualizarBarra() {
    const p = passos[atual - 1];
    $('b-flow').textContent = p ? p.flow.titulo : D.flows[0].titulo;
    $('b-passo').textContent = p ? `Passo ${atual} de ${N}` : `${N} passos`;
    $('b-nota').textContent = p ? p.nota : 'Use → ou o botão próximo para começar.';
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j < atual));
    $('b-ant').disabled = atual <= 1;
    $('b-prox').disabled = atual >= N;
    $('b-sair').disabled = atual === 0;
    const b = $('b-tocar');
    b.hidden = semMovimento();
    b.textContent = timerTocar ? '\u275A\u275A' : '\u25B6';
    b.setAttribute('aria-label', timerTocar ? 'Pausar' : 'Tocar');
  }
  function gravarHash() {
    try {
      history.replaceState(null, '', atual ? `#passo=${atual}` : location.pathname + location.search);
    } catch (e) { /* file:// restrito: o hash só fica desatualizado */ }
  }

  // ---------------- navegação ----------------
  function ir(i, animar) {
    atual = clamp(i | 0, 0, N);
    limpar();
    if (atual >= N) parar();
    atualizarBarra(); // antes da câmera: a altura da barra define a área livre
    if (atual === 0) ajustar(animar);
    else { const p = passos[atual - 1]; realcar(p); enquadrarPasso(p, animar); }
    gravarHash();
    root.dataset.passo = String(atual); // sinal de pronto para captura (Task 8)
  }
  function parar() { clearInterval(timerTocar); timerTocar = 0; }
  function tocar() {
    if (semMovimento()) return;
    if (timerTocar) { parar(); atualizarBarra(); return; }
    if (atual >= N) ir(0, false);
    timerTocar = setInterval(() => ir(atual + 1, true), 3000);
    ir(atual + 1, true);
  }
  const proximo = () => { parar(); ir(atual + 1, true); };
  const anterior = () => { parar(); if (atual > 1) ir(atual - 1, true); };
  const sair = () => { parar(); ir(0, true); };
  const passoDoHash = () => { const m = /^#passo=(\d+)$/.exec(location.hash); return m ? clamp(+m[1], 1, N) : 0; };

  $('b-prox').onclick = proximo;
  $('b-ant').onclick = anterior;
  $('b-sair').onclick = sair;
  $('b-tocar').onclick = tocar;
  $('z-mais').onclick = () => zoomPor(1.25);
  $('z-menos').onclick = () => zoomPor(0.8);
  $('z-ajustar').onclick = () => ajustar(true);

  addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); proximo(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); anterior(); }
    else if (ev.key === 'Escape') sair();
    else if (ev.key === ' ') { ev.preventDefault(); tocar(); } // Espaço é sempre tocar/pausar (Enter ativa botões)
    else if (ev.key === '+' || ev.key === '=') zoomPor(1.2);
    else if (ev.key === '-') zoomPor(0.83);
  });
  addEventListener('hashchange', () => { const n = passoDoHash(); if (n !== atual) { parar(); ir(n, false); } });

  // ---------------- pan / zoom ----------------
  palco.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const pan = !ev.ctrlKey && ev.deltaMode === 0 && (Math.abs(ev.deltaX) > 0 || Math.abs(ev.deltaY) < 40);
    if (pan) setT({ ...t, x: t.x - ev.deltaX, y: t.y - ev.deltaY }, false);
    else zoomPor(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018)), ev.clientX, ev.clientY);
  }, { passive: false });
  let arraste = null;
  palco.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    arraste = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, tx: t.x, ty: t.y };
    palco.classList.add('arrastando');
  });
  addEventListener('pointermove', (ev) => {
    if (!arraste || ev.pointerId !== arraste.id) return;
    setT({ ...t, x: arraste.tx + ev.clientX - arraste.x, y: arraste.ty + ev.clientY - arraste.y }, false);
  });
  const fim = (ev) => { if (arraste && ev.pointerId === arraste.id) { arraste = null; palco.classList.remove('arrastando'); } };
  addEventListener('pointerup', fim);
  addEventListener('pointercancel', fim);
  addEventListener('resize', () => { if (camera) enquadrarPasso(camera, false); else ajustar(false); });

  // ---------------- tema e movimento ----------------
  const NOMES = { auto: 'auto', light: 'claro', dark: 'escuro' };
  const PROX = { auto: 'light', light: 'dark', dark: 'auto' };
  const tema = window.diagramasVivosTema;
  function rotularTema() {
    const c = tema ? tema.get() : 'auto';
    $('b-tema').textContent = `Tema: ${NOMES[c]}`;
  }
  $('b-tema').onclick = () => { if (tema) tema.set(PROX[tema.get()]); rotularTema(); };
  addEventListener('diagramas-vivos-tema', rotularTema);
  const mudouMovimento = () => {
    if (semMovimento()) { parar(); fx.textContent = ''; }
    else if (atual) pulso(svg.querySelector('g.aresta.hl')?.getAttribute('data-id'));
    atualizarBarra();
  };
  if (reduz.addEventListener) reduz.addEventListener('change', mudouMovimento); else if (reduz.addListener) reduz.addListener(mudouMovimento);

  rotularTema();
  ir(passoDoHash(), false);
})();
