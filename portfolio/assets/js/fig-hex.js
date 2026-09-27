// FIG. 5 — the terrain-cost BFS from DnDHexCombat/GraphSearch.cs (2024), ported
// to JS, running on the axial coordinates of tactical-prototype's Game.Core
// (2026). Costs and budget are DnD Hex Combat's: road 5, default 10,
// difficult 15, obstacle impassable, 20 movement points.
// One fix over the original: when a cheaper path to an already visited tile is
// found, the tile is queued again so its neighbours get the cheaper cost too.
// Movement is two clicks, as in the original: preview the path, click again to move.
import { tokens, onTheme, onLang, reducedMotion, fitCanvas, t } from './core.js';
import { pen, seedOf } from './pen.js';

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
  function corners(x, y, s, side) {
    const off = side ? 0 : -30;
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i + off);
      return [x + s * Math.cos(a), y + s * Math.sin(a)];
    });
  }
  function hexPath(ctx, x, y, s, side) {
    ctx.beginPath();
    corners(x, y, s, side).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  }

  // Drawn like the hex clusters in his notebook (03): one pencil stroke per
  // edge that runs a little past each corner, numbers written inside.
  function draw() {
    const { ctx, w, h } = view;
    if (!w || !result) return;
    ctx.clearRect(0, 0, w, h);
    const { s, side, cx, cy } = geom();
    const P = pen(ctx);
    const shown = new Set();
    const n = Math.ceil(result.order.length * revealT);
    for (let i = 0; i < n; i++) shown.add(result.order[i]);
    const path = preview ? pathTo(preview) : [];
    const labelPx = Math.max(10, Math.round(s * 0.34));
    const bounds = (x, y) => [x - s, y - s, s * 2, s * 2];

    // terrain first, under the grid
    for (const tl of tiles.values()) {
      const x = cx(tl), y = cy(tl), k = key(tl.q, tl.r);
      P.reseed(seedOf('t' + k));
      if (tl.type === 'obstacle') {
        P.hatch((c) => hexPath(c, x, y, s * 0.9, side), 3, { bounds: bounds(x, y), color: tok.ink, gap: 3.6, alpha: 0.85, w: 0.9 });
      } else if (tl.type === 'difficult') {
        P.hatch((c) => hexPath(c, x, y, s * 0.9, side), 1, { bounds: bounds(x, y), color: tok.pencil, gap: 4.5, alpha: 0.9, w: 0.9 });
      } else if (tl.type === 'road') {
        // a dashed track along the lower part of the cell, clear of the cost written in the middle
        const [ax, ay, bx, by] = side ? [x + s * 0.5, y - s * 0.4, x + s * 0.5, y + s * 0.4] : [x - s * 0.4, y + s * 0.5, x + s * 0.4, y + s * 0.5];
        P.line(ax, ay, bx, by, { color: tok.ink3, w: 1.5, dash: [3, 3], over: [0, 0] });
      }
    }
    // the grid: every edge once, in pencil
    const done = new Set();
    for (const tl of tiles.values()) {
      const cs = corners(cx(tl), cy(tl), s, side);
      for (let i = 0; i < 6; i++) {
        const a = cs[i], b = cs[(i + 1) % 6];
        const ek = [Math.round((a[0] + b[0]) * 2), Math.round((a[1] + b[1]) * 2)].join(',');
        if (done.has(ek)) continue;
        done.add(ek);
        P.reseed(seedOf('e' + ek));
        P.line(a[0], a[1], b[0], b[1], { color: tok.pencil, w: 1, over: [0.5 + P.r(), 0.5 + P.r() * 1.5], bow: 0.01 });
      }
    }
    // reachable tiles: an inner biro outline and the cost written inside
    for (const tl of tiles.values()) {
      const k = key(tl.q, tl.r);
      if (!shown.has(k)) continue;
      const x = cx(tl), y = cy(tl);
      P.reseed(seedOf('r' + k));
      P.poly(corners(x, y, s * 0.78, side), true, { color: tok.pen, w: 1.3, over: [0.3, 1.2] });
      if (s > 11 && !(tl.q === unit.q && tl.r === unit.r)) {
        ctx.font = `${labelPx}px "Martian Mono", monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = tok.pen;
        ctx.fillText(String(result.cost.get(k)), x, y + 1);
      }
    }
    // keyboard cursor: a garnet ring that doesn't quite close
    if (document.activeElement === stage) {
      const tl = tiles.get(cursor);
      P.reseed(seedOf('c' + cursor));
      P.ring(cx(tl), cy(tl), s * 0.72, { color: tok.red, w: 2 });
    }
    // path preview in garnet, ending in his open arrowhead
    if (path.length > 1) {
      const pts = path.map((k) => { const tl = tiles.get(k); return [cx(tl), cy(tl)]; });
      P.reseed(seedOf('p' + path.join('|')));
      P.path(pts, { color: tok.red, w: 2.4 });
      const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 2];
      P.head(x1, y1, Math.atan2(y1 - y0, x1 - x0), s * 0.42, { color: tok.red, w: 2.4 });
    }
    // the unit: a stick figure, as in his storyboards (05)
    const u = at(unit.q, unit.r);
    ctx.fillStyle = tok.paper;
    hexPath(ctx, cx(u), cy(u), s * 0.7, side); ctx.fill();
    P.reseed(20026);
    P.stick(cx(u), cy(u), s * 1.15, { color: tok.ink, w: 1.8 });
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
