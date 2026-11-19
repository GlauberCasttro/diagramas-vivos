/* Portions derived from floorplan (MIT) (c) 2026 Hayden Smith
   Origem: floorplan/assets/viewer.html (pan/zoom :1250-1347, centerOn :1411-1416, highlightFlow :1884-1905,
   teclado :2288-2304). Passo a passo guiado sem dependências: #passo=N (1-based, numeração global pelos
   flows em ordem) abre direto no passo N, sem transição. Câmera fixa (adendo 2): enquadra o diagrama
   inteiro ao abrir e nunca se move entre passos; zoom/pan só manuais. */
(() => {
  const D = JSON.parse(document.getElementById('dados').textContent);
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const palco = $('palco'), vp = $('vp'), svg = vp.querySelector('svg');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)');
  const semMovimento = () => reduz.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const VOLTA = '~volta'; // id da volta no Layout (data-id/data-aresta); o path é a-<id>--volta
  const elNo = new Map(), elAresta = new Map(), elPorta = new Map();
  svg.querySelectorAll('g.no[data-id]').forEach((g) => elNo.set(g.getAttribute('data-id'), g));
  svg.querySelectorAll('g.aresta[data-id]').forEach((g) => elAresta.set(g.getAttribute('data-id'), g));
  svg.querySelectorAll('.portas [data-aresta]').forEach((g) => elPorta.set(g.getAttribute('data-aresta'), g));
  const fx = document.createElementNS(svg.namespaceURI, 'g');
  fx.setAttribute('class', 'fx');
  svg.appendChild(fx);

  const passos = [];
  D.flows.forEach((f) => f.passos.forEach((p, i) => passos.push({ flow: f, i, ref: p.ref, nota: p.nota || '' })));
  const N = passos.length;
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const TOCAR_MS = 1500;
  let atual = 0; // 0 = repouso (os cenários SMIL do próprio SVG tocam)
  let t = { x: 0, y: 0, k: 1 };
  let manual = false; // usuário mexeu no zoom/pan: resize não reenquadra
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
  // Enquadra o diagrama inteiro. Chamado ao abrir, no "ver tudo" e no resize; nunca por troca de passo.
  function ajustar(animar) {
    manual = false;
    const a = areaLivre();
    setT(centrar({ x: 0, y: 0, w: W, h: H }, Math.min(a.w / W, a.h / H, 1)), animar);
  }
  function zoomPor(f, cx, cy) {
    manual = true;
    cx ??= innerWidth / 2; cy ??= innerHeight / 2;
    const k = clamp(t.k * f, 0.1, 4);
    setT({ k, x: cx - (cx - t.x) * (k / t.k), y: cy - (cy - t.y) * (k / t.k) }, false);
  }

  // ---------------- realce ----------------
  function limpar() {
    for (const g of elNo.values()) g.classList.remove('hl', 'dim', 'pulsa');
    for (const g of elAresta.values()) g.classList.remove('hl', 'dim');
    for (const g of elPorta.values()) g.classList.remove('hl', 'dim');
    fx.textContent = '';
  }
  // Token do passo: percorre a aresta ativa (na volta, o path <id>~volta, do "para" ao "de").
  function pulso(id) {
    fx.textContent = '';
    if (!id || semMovimento() || !elAresta.has(id)) return;
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
    anim.setAttribute('dur', `${TOCAR_MS / 1000}s`);
    dot.appendChild(anim);
    fx.appendChild(dot);
    anim.beginElement?.();
  }
  let tokenAtual = null; // aresta (id do Layout) que o token do passo percorre; null em passo de nó
  function realcar(p) {
    const { nos, arestas, sentido } = destaques(p.flow.passos, p.i, D.arestas); // assets/destaques.mjs
    const ativas = new Set([...arestas].map((id) => (sentido === 'volta' ? id + VOLTA : id)));
    for (const [id, g] of elNo) g.classList.add(nos.has(id) ? 'hl' : 'dim');
    for (const [id, g] of elAresta) g.classList.add(ativas.has(id) ? 'hl' : 'dim');
    for (const [id, g] of elPorta) g.classList.add(ativas.has(id) ? 'hl' : 'dim');
    if (sentido === null) { // passo que é nó: só o card pulsa
      tokenAtual = null;
      elNo.get(p.ref)?.classList.add('pulsa');
    } else tokenAtual = [...ativas][0];
    pulso(tokenAtual);
  }
  // Ida "A → B" (de → para). Volta: o salto vai do para (A) ao de (B) e a seta aponta para quem recebe:
  // "B ⇠ A · resposta" (ex.: "Planejador ⇠ Ferramentas · resultado"). Passo de nó: o nome do nó.
  function rota(p) {
    const nome = (id) => D.nos[id]?.nome ?? id;
    const a = D.arestas[p.ref];
    if (!a) return nome(p.ref);
    const passo = p.flow.passos[p.i];
    if (passo.sentido === 'volta') return `${nome(a.de)} ⇠ ${nome(a.para)} · ${a.resposta || ''}`;
    return `${nome(a.de)} → ${nome(a.para)}`;
  }

  // ---------------- barra ----------------
  const dots = $('b-dots');
  for (let j = 0; j < N; j++) dots.appendChild(document.createElement('i'));
  function atualizarBarra() {
    const p = passos[atual - 1];
    $('b-flow').textContent = p ? p.flow.titulo : D.flows[0].titulo;
    $('b-passo').textContent = p ? `Passo ${atual} de ${N}` : `${N} passos`;
    $('b-rota').textContent = p ? rota(p) : '';
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
    atualizarBarra();
    root.classList.toggle('passo-a-passo', atual > 0); // esconde os tokens SMIL enquanto há passo
    if (atual > 0) realcar(passos[atual - 1]);
    gravarHash();
    root.dataset.passo = String(atual); // sinal de pronto para captura (Task 8)
  }
  function parar() { clearInterval(timerTocar); timerTocar = 0; }
  function tocar() {
    if (semMovimento()) return;
    if (timerTocar) { parar(); atualizarBarra(); return; }
    if (atual >= N) ir(0, false);
    timerTocar = setInterval(() => ir(atual + 1, true), TOCAR_MS);
    ir(atual + 1, true);
  }
  const proximo = () => { parar(); ir(atual + 1, true); };
  const anterior = () => { parar(); if (atual > 1) ir(atual - 1, true); };
  const sair = () => { parar(); ir(0, true); };
  const passoAtualDoHash = () => passoDoHash(location.hash, N); // assets/destaques.mjs

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
  addEventListener('hashchange', () => { const n = passoAtualDoHash(); if (n !== atual) { parar(); ir(n, false); } });

  // ---------------- pan / zoom ----------------
  palco.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const pan = !ev.ctrlKey && ev.deltaMode === 0 && (Math.abs(ev.deltaX) > 0 || Math.abs(ev.deltaY) < 40);
    if (pan) { manual = true; setT({ ...t, x: t.x - ev.deltaX, y: t.y - ev.deltaY }, false); }
    else zoomPor(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018)), ev.clientX, ev.clientY);
  }, { passive: false });
  let arraste = null;
  palco.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    arraste = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, tx: t.x, ty: t.y };
    manual = true;
    palco.classList.add('arrastando');
  });
  addEventListener('pointermove', (ev) => {
    if (!arraste || ev.pointerId !== arraste.id) return;
    setT({ ...t, x: arraste.tx + ev.clientX - arraste.x, y: arraste.ty + ev.clientY - arraste.y }, false);
  });
  const fim = (ev) => { if (arraste && ev.pointerId === arraste.id) { arraste = null; palco.classList.remove('arrastando'); } };
  addEventListener('pointerup', fim);
  addEventListener('pointercancel', fim);
  addEventListener('resize', () => { if (!manual) ajustar(false); });

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
    else if (atual) pulso(tokenAtual);
    atualizarBarra();
  };
  if (reduz.addEventListener) reduz.addEventListener('change', mudouMovimento); else if (reduz.addListener) reduz.addListener(mudouMovimento);

  rotularTema();
  atualizarBarra(); // barra no repouso: a área livre (e a câmera) não depende do passo aberto pelo hash
  ajustar(false); // câmera: uma vez, ao abrir
  ir(passoAtualDoHash(), false);
})();
