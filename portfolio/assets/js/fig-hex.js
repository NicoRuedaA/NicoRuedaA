// FIG. 5 — the terrain-cost BFS from DnDHexCombat/GraphSearch.cs (2024), ported
// to JS, running on the axial coordinates of tactical-prototype's Game.Core
// (2026). Costs and budget are DnD Hex Combat's: road 5, default 10,
// difficult 15, obstacle impassable, 20 movement points.
// One fix over the original: when a cheaper path to an already visited tile is
// found, the tile is queued again so its neighbours get the cheaper cost too.
// Movement is two clicks, as in the original: preview the path, click again to move.
import { tokens, onTheme, onLang, reducedMotion, fitCanvas, t } from './core.js';

const COST = { road: 5, default: 10, difficult: 15 };
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // Axial.cs neighbour order
const COLS = 11, ROWS = 7;
const NAMES = {
  es: { road: 'carretera', default: 'normal', difficult: 'difícil', obstacle: 'muro' },
  en: { road: 'road', default: 'default', difficult: 'rough', obstacle: 'wall' },
};
const key = (q, r) => q + ',' + r;

export function mount(fig) {
  const stage = fig.querySelector('.plate__stage');
  const canvas = stage.querySelector('canvas');
  const readout = fig.querySelector('[data-readout]');
  const budgetIn = fig.querySelector('[data-budget]');
  const brushBtns = [...fig.querySelectorAll('[data-brush]')];

  // board in odd-r offset rows, stored as axial
  const tiles = new Map();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const q = col - Math.floor(row / 2), r = row;
      tiles.set(key(q, r), { q, r, col, row, type: 'default' });
    }
  }
  const at = (q, r) => tiles.get(key(q, r));
  const setType = (col, row, type) => { const tl = at(col - Math.floor(row / 2), row); if (tl) tl.type = type; };
  // a road, a wood and a ridge with a gap: enough to make costs matter
  [[0, 3], [1, 3], [2, 3], [3, 3], [4, 2], [5, 2], [6, 2], [7, 3], [8, 3], [9, 3], [10, 3]].forEach(([c, r]) => setType(c, r, 'road'));
  [[6, 4], [7, 4], [6, 5], [7, 5], [8, 5], [8, 4], [3, 5], [4, 5], [2, 1], [3, 1]].forEach(([c, r]) => setType(c, r, 'difficult'));
  [[5, 0], [5, 1], [5, 4], [5, 5], [5, 6], [4, 4]].forEach(([c, r]) => setType(c, r, 'obstacle'));

  let unit = { q: 1 - Math.floor(3 / 2), r: 3 }; // column 1, row 3: on the road
  let budget = Number(budgetIn.value);
  let brush = 'path';
  let preview = null; // target tile key for the two-click move
  let cursor = key(unit.q, unit.r);
  let result = null; // { visited: Map<key, parentKey|null>, cost: Map<key, number>, order: [] }
  let revealT = 1;
  let tok = tokens();
  const view = fitCanvas(canvas, () => draw());

  // --- GraphSearch.BFSGetRange (2024), plus the re-queue fix ---
  function bfs(start, movementPoints) {
    const visited = new Map([[key(start.q, start.r), null]]);
    const cost = new Map([[key(start.q, start.r), 0]]);
    const queue = [start];
    const order = [];
    while (queue.length) {
      const cur = queue.shift();
      const ck = key(cur.q, cur.r);
      for (const [dq, dr] of DIRS) {
        const n = at(cur.q + dq, cur.r + dr);
        if (!n) continue;
        if (n.type === 'obstacle') continue;
        const nk = key(n.q, n.r);
        const newCost = cost.get(ck) + COST[n.type];
        if (newCost <= movementPoints) {
          if (!visited.has(nk)) {
            visited.set(nk, ck); cost.set(nk, newCost); queue.push(n); order.push(nk);
          } else if (cost.get(nk) > newCost) {
            cost.set(nk, newCost); visited.set(nk, ck);
            queue.push(n); // the fix: propagate the cheaper cost to the neighbours
          }
        }
      }
    }
    return { visited, cost, order };
  }
  function pathTo(k) {
    if (!result || !result.visited.has(k)) return [];
    const path = [k];
    let cur = k;
    while (result.visited.get(cur) != null) { cur = result.visited.get(cur); path.push(cur); }
    return path.reverse();
  }

  function recompute(animate) {
    result = bfs(unit, budget);
    revealT = animate && !reducedMotion() ? 0 : 1;
    if (preview && !result.visited.has(preview)) preview = null;
    tickReveal();
    say();
  }
  let raf = 0;
  function tickReveal() {
    cancelAnimationFrame(raf);
    let last = 0;
    const step = (now) => {
      revealT = Math.min(1, revealT + (last ? (now - last) / 700 : 0));
      last = now;
      draw();
      if (revealT < 1) raf = requestAnimationFrame(step);
    };
    if (revealT < 1) raf = requestAnimationFrame(step); else draw();
  }

  // Wide stage: pointy-top hexes in rows. Tall stage (phones): the same board
  // laid on its side (flat-top), so cells stay big enough to tap.
  function geom() {
    const { w, h } = view;
    const side = h > w * 1.05;
    const sq3 = Math.sqrt(3);
    const ux = (tl) => sq3 * (tl.q + tl.r / 2), uy = (tl) => 1.5 * tl.r;
    const X = (tl) => (side ? uy(tl) : ux(tl)), Y = (tl) => (side ? ux(tl) : uy(tl));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const tl of tiles.values()) {
      minX = Math.min(minX, X(tl)); maxX = Math.max(maxX, X(tl)); minY = Math.min(minY, Y(tl)); maxY = Math.max(maxY, Y(tl));
    }
    const padX = side ? 2 : sq3, padY = side ? sq3 : 2;
    const s = Math.min((w - 20) / (maxX - minX + padX), (h - 20) / (maxY - minY + padY));
    const ox = (w - (maxX - minX) * s) / 2 - minX * s;
    const oy = (h - (maxY - minY) * s) / 2 - minY * s;
    return { s, side, cx: (tl) => ox + s * X(tl), cy: (tl) => oy + s * Y(tl) };
  }
  function hexPath(ctx, x, y, s, side) {
    const off = side ? 0 : -30;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i + off);
      const px = x + s * Math.cos(a), py = y + s * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function draw() {
    const { ctx, w, h } = view;
    if (!w || !result) return;
    ctx.clearRect(0, 0, w, h);
    const { s, side, cx, cy } = geom();
    const dark = tok.dark;
    const shown = new Set();
    const n = Math.ceil(result.order.length * revealT);
    for (let i = 0; i < n; i++) shown.add(result.order[i]);
    const path = preview ? pathTo(preview) : [];
    const labelPx = Math.max(10, Math.round(s * 0.36));
    for (const tl of tiles.values()) {
      const x = cx(tl), y = cy(tl), k = key(tl.q, tl.r);
      hexPath(ctx, x, y, s * 0.96, side);
      let fill = dark ? '#12161d' : tok.sheet2;
      if (tl.type === 'road') fill = dark ? '#1d2430' : '#d7dce3';
      if (tl.type === 'difficult') fill = dark ? '#16241c' : '#cfd8cf';
      if (tl.type === 'obstacle') fill = dark ? '#4a5366' : tok.ink2;
      ctx.fillStyle = fill; ctx.fill();
      if (tl.type === 'difficult') { // hatch
        ctx.save(); hexPath(ctx, x, y, s * 0.96, side); ctx.clip();
        ctx.strokeStyle = dark ? 'rgba(74,222,128,.28)' : 'rgba(23,113,74,.35)'; ctx.lineWidth = 1;
        for (let d = -s; d < s; d += 5) { ctx.beginPath(); ctx.moveTo(x + d, y - s); ctx.lineTo(x + d + s, y + s); ctx.stroke(); }
        ctx.restore();
      }
      if (tl.type === 'road') { // dashed centre line
        ctx.strokeStyle = dark ? 'rgba(255,194,71,.35)' : 'rgba(138,90,0,.45)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - s * 0.55, y); ctx.lineTo(x + s * 0.55, y); ctx.stroke(); ctx.setLineDash([]);
      }
      if (shown.has(k)) {
        ctx.fillStyle = dark ? 'rgba(92,200,255,.16)' : 'rgba(36,55,160,.12)';
        hexPath(ctx, x, y, s * 0.96, side); ctx.fill();
      }
      if (tl.type === 'obstacle') { ctx.strokeStyle = dark ? tok.ink3 : tok.ink2; ctx.lineWidth = 1.4; }
      else { ctx.strokeStyle = shown.has(k) ? tok.ally : (dark ? '#262b35' : tok.rule); ctx.lineWidth = shown.has(k) ? 1.4 : 1; }
      hexPath(ctx, x, y, s * 0.96, side); ctx.stroke();
      if (shown.has(k) && s > 11) {
        ctx.fillStyle = tok.ink2; ctx.font = `${labelPx}px "Martian Mono", monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(result.cost.get(k)), x, y + s * 0.42);
      }
      if (k === cursor && document.activeElement === stage) {
        ctx.strokeStyle = tok.marker; ctx.lineWidth = 2.5; hexPath(ctx, x, y, s * 0.82, side); ctx.stroke();
      }
    }
    // path preview in marker, as in his sketch
    if (path.length > 1) {
      ctx.strokeStyle = tok.marker; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      path.forEach((k, i) => { const tl = tiles.get(k); i ? ctx.lineTo(cx(tl), cy(tl)) : ctx.moveTo(cx(tl), cy(tl)); });
      ctx.stroke();
      const last = tiles.get(path[path.length - 1]);
      ctx.beginPath(); ctx.arc(cx(last), cy(last), s * 0.28, 0, Math.PI * 2); ctx.stroke();
    }
    // the unit
    const u = at(unit.q, unit.r);
    ctx.fillStyle = tok.ally; ctx.strokeStyle = dark ? '#fff' : tok.sheet2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx(u), cy(u), s * 0.46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dark ? '#0a0c10' : '#fff';
    ctx.font = `600 ${Math.max(9, Math.round(s * 0.34))}px "Martian Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('d20', cx(u), cy(u) + 1);
  }

  const plural = (n, es1, esN, en1, enN) => t(`${n} ${n === 1 ? es1 : esN}`, `${n} ${n === 1 ? en1 : enN}`);
  function say() {
    const reach = result ? result.order.length : 0;
    if (preview) {
      const c = result.cost.get(preview);
      const steps = pathTo(preview).length - 1;
      readout.textContent = t('camino: ', 'path: ') + plural(steps, 'casilla', 'casillas', 'tile', 'tiles')
        + t(` · coste ${c} de ${budget} · clic o Enter otra vez para mover`, ` · cost ${c} of ${budget} · click or press Enter again to move`);
    } else {
      readout.textContent = plural(reach, 'casilla alcanzable', 'casillas alcanzables', 'tile reachable', 'tiles reachable') + t(` con ${budget} puntos`, ` with ${budget} points`);
    }
  }
  function sayCursor() {
    const tl = tiles.get(cursor);
    const c = result.cost.get(cursor);
    const name = NAMES[t('es', 'en')][tl.type];
    readout.textContent = t(
      `casilla ${tl.col + 1}·${tl.row + 1}: ${name}${tl.q === unit.q && tl.r === unit.r ? ' · aquí está la unidad' : c != null ? ` · coste ${c}` : ' · fuera de alcance'}`,
      `tile ${tl.col + 1}·${tl.row + 1}: ${name}${tl.q === unit.q && tl.r === unit.r ? ' · the unit is here' : c != null ? ` · cost ${c}` : ' · out of reach'}`,
    );
  }

  function tileAt(px, py) {
    const { s, cx, cy } = geom();
    let best = null, bd = Infinity;
    for (const tl of tiles.values()) {
      const d = Math.hypot(cx(tl) - px, cy(tl) - py);
      if (d < bd) { bd = d; best = tl; }
    }
    return bd <= s ? best : null;
  }

  function act(tl) {
    if (!tl) return;
    const k = key(tl.q, tl.r);
    cursor = k;
    if (brush === 'path') {
      if (!result.visited.has(k) || (tl.q === unit.q && tl.r === unit.r)) { preview = null; say(); draw(); return; }
      if (preview === k) { // second click on the same hex confirms (UnitManager.HandleTargetHexSelected)
        unit = { q: tl.q, r: tl.r }; preview = null; recompute(true);
      } else { preview = k; say(); draw(); }
    } else {
      if (tl.q === unit.q && tl.r === unit.r) return;
      tl.type = brush; preview = null; recompute(false);
    }
  }

  // Mouse acts on press (and drag-paints); touch and pen act on a tap, so a
  // swipe that starts on the board scrolls the page instead of painting it.
  const tileFrom = (e) => { const r = canvas.getBoundingClientRect(); return tileAt(e.clientX - r.left, e.clientY - r.top); };
  let painting = false, down = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      if (brush !== 'path') { painting = true; stage.setPointerCapture(e.pointerId); }
      act(tileFrom(e));
    } else {
      down = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const tl = tileFrom(e);
    if (tl && tl.type !== brush) act(tl);
  });
  stage.addEventListener('pointerup', (e) => {
    if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) act(tileFrom(e));
    down = null; painting = false;
  });
  stage.addEventListener('pointercancel', () => { down = null; painting = false; });
  stage.addEventListener('focus', draw);
  stage.addEventListener('blur', draw);
  stage.addEventListener('keydown', (e) => {
    const cur = tiles.get(cursor);
    let dc = 0, dr = 0;
    if (e.key === 'ArrowRight') dc = 1; else if (e.key === 'ArrowLeft') dc = -1;
    else if (e.key === 'ArrowDown') dr = 1; else if (e.key === 'ArrowUp') dr = -1;
    if (dc || dr) {
      e.preventDefault();
      if (geom().side) [dc, dr] = [dr, dc]; // the board is on its side: arrows follow what you see
      const col = Math.max(0, Math.min(COLS - 1, cur.col + dc));
      const row = Math.max(0, Math.min(ROWS - 1, cur.row + dr));
      const nxt = at(col - Math.floor(row / 2), row);
      if (nxt) { cursor = key(nxt.q, nxt.r); draw(); sayCursor(); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); act(cur);
    }
  });
  brushBtns.forEach((b) => b.addEventListener('click', () => {
    brush = b.dataset.brush;
    brushBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    preview = null; say(); draw();
  }));
  // live updates while dragging the slider, one announcement when it is released
  budgetIn.addEventListener('input', () => { readout.setAttribute('aria-live', 'off'); budget = Number(budgetIn.value); recompute(false); });
  budgetIn.addEventListener('change', () => { readout.setAttribute('aria-live', 'polite'); say(); });
  onTheme(() => { tok = tokens(); draw(); });
  onLang(say);
  recompute(true);
}
