// FIG. 0 — Nico's hand-drawn frog head (2022) run through Voxelizer's real
// engine (voxel.js, 2026, MPL-2.0) inside the visitor's browser.
// voxel.js does the maths (quantize → distance-transform depth → occupancy →
// greedy mesh → AO) in a Web Worker. This file only projects and paints the
// quads it returns.
import { tokens, onTheme, onLang, reducedMotion, fitCanvas, visibleLoop, loadScript, fmt, t } from './core.js';

const SRC_IMG = 'assets/data/sapo64.png';
const SRC_JS = 'assets/vendor/voxel.js';
const SWAY_MS = 12000; // the turntable idles, then rests (and starts again after an interaction)
const OPTS = (greedy) => ({
  depth: { layers: 14, profile: 'dt', mode: 'symmetric' },
  palette: { colors: 16 },
  mesh: { greedy, ao: false },
});

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous'; // keeps the canvas readable on sandboxed hosts
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('img ' + src));
    im.src = src;
  });
}

// voxelize() in a Web Worker so the page never freezes; the main thread only
// loads voxel.js itself if the worker can't be used.
function makeRunner() {
  let worker = null, blobUrl = null;
  try {
    const url = new URL(SRC_JS, document.baseURI).href;
    const src = `importScripts(${JSON.stringify(url)});
      onmessage = (e) => {
        const { id, pixels, greedy, opts } = e.data;
        try {
          const t0 = performance.now();
          const r = self.Voxel.voxelize(pixels, opts);
          const ms = performance.now() - t0;
          const list = greedy ? r.greedyFacesList : (r.naiveFacesList || r.greedyFacesList);
          self.Voxel.annotateAO(list, r.grid, r.dims, 0.9);
          postMessage({ id, ok: true, r: { ms, voxels: r.voxels, dims: r.dims, palette: r.palette, naiveCount: r.naiveCount,
            greedyFacesList: greedy ? list : null, naiveFacesList: greedy ? null : list } });
        } catch (err) { postMessage({ id, ok: false, error: String(err && err.message || err) }); }
      };`;
    blobUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    worker = new Worker(blobUrl);
  } catch (e) { worker = null; }
  const local = async (pixels, greedy) => {
    await loadScript(SRC_JS);
    const V = window.Voxel;
    const t0 = performance.now();
    const r = V.voxelize(pixels, OPTS(greedy));
    r.ms = performance.now() - t0;
    const list = greedy ? r.greedyFacesList : (r.naiveFacesList || r.greedyFacesList);
    V.annotateAO(list, r.grid, r.dims, 0.9);
    return r;
  };
  let seq = 0;
  const run = (pixels, greedy) => new Promise((resolve, reject) => {
    const fallback = () => local(pixels, greedy).then(resolve, reject);
    if (!worker) { fallback(); return; }
    const id = ++seq;
    const onMsg = (e) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      if (e.data.ok) resolve(e.data.r); else fallback();
    };
    const onErr = () => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      worker = null; fallback();
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    worker.postMessage({ id, pixels: { w: pixels.w, h: pixels.h, data: pixels.data }, greedy, opts: OPTS(greedy) });
  });
  run.done = () => { worker?.terminate(); worker = null; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  return run;
}

const hexRGB = (h) => {
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

export async function mount(fig) {
  const stage = fig.querySelector('.plate__stage');
  const canvas = stage.querySelector('canvas');
  const readout = fig.querySelector('[data-readout]');
  const meshBtns = [...fig.querySelectorAll('[data-mesh]')];

  const img = await loadImage(SRC_IMG);
  const off = document.createElement('canvas');
  off.width = img.naturalWidth; off.height = img.naturalHeight;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.drawImage(img, 0, 0);
  const id = octx.getImageData(0, 0, off.width, off.height);
  const pixels = { w: id.width, h: id.height, data: id.data };

  const run = makeRunner();
  const greedy = await run(pixels, true);
  const ms = greedy.ms;
  let naive = null, naiveP = null, wanted = 'greedy';

  const [DX, DY, DZ] = greedy.dims;
  const palette = greedy.palette.map((c) => c.slice(0, 3));
  const t0 = performance.now();
  const state = {
    mode: 'greedy',
    yaw: -0.62, pitch: -0.3,
    extrude: reducedMotion() ? 1 : 0.02,
    introT: 0,
    userUntil: 0,
    swayUntil: t0 + SWAY_MS,
    vy: 0,
    dirty: true,
  };

  const faces = () => (state.mode === 'greedy' ? greedy.greedyFacesList : naive.list);

  function setReadout() {
    const nv = greedy.naiveCount;
    const gv = greedy.greedyFacesList.length;
    const pct = Math.round((1 - gv / nv) * 100);
    const shown = state.mode === 'greedy' ? gv : nv;
    readout.textContent = t(
      `${fmt(greedy.voxels)} vóxeles · ${fmt(shown)} caras ${state.mode === 'greedy' ? `(greedy, −${pct} % de ${fmt(nv)})` : '(una por cara expuesta)'} · ${fmt(Math.round(ms))} ms en tu navegador`,
      `${fmt(greedy.voxels)} voxels · ${fmt(shown)} faces ${state.mode === 'greedy' ? `(greedy, −${pct}% of ${fmt(nv)})` : '(one per exposed face)'} · ${fmt(Math.round(ms))} ms in your browser`,
    );
  }

  const ensureNaive = () => (naiveP ||= run(pixels, false).then((r) => {
    naive = { list: r.naiveFacesList || r.greedyFacesList };
    run.done(); // both meshes are cached: the worker has nothing left to do
  }));

  meshBtns.forEach((b) => b.addEventListener('click', async () => {
    const want = (wanted = b.dataset.mesh);
    readout.setAttribute('aria-live', 'polite'); // announce only after the visitor asks
    meshBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (want === 'naive') { fig.setAttribute('aria-busy', 'true'); await ensureNaive(); fig.removeAttribute('aria-busy'); }
    if (wanted !== want) return; // a later click won
    state.mode = want;
    setReadout(); wake();
  }));

  // ---------- projection + painting ----------
  let tok, paperRGB, strokeCol;
  const readTokens = () => {
    tok = tokens();
    paperRGB = hexRGB(tok.paper);
    const a = hexRGB(tok.ally);
    strokeCol = tok.dark ? 'rgba(92,200,255,0.22)' : `rgba(${a[0]},${a[1]},${a[2]},0.55)`;
  };
  readTokens();
  const view = fitCanvas(canvas, () => { state.dirty = true; draw(); });
  const L = norm([0.45, -0.75, 0.55]); // travels from an upper-left-front light (grid y points up)
  function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
  let P = new Float32Array(0); // projected corners, reused between frames
  const items = [];

  function draw() {
    const { ctx, w, h } = view;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const ez = state.extrude;
    const R = 0.5 * Math.hypot(DX, DY, DZ);
    const S = (Math.min(w, h) * 0.46) / R;
    const ox = w / 2, oy = h / 2 + h * 0.02;
    const list = faces();
    if (P.length < list.length * 12) P = new Float32Array(list.length * 12);
    items.length = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const [nx0, ny0, nz0] = f.normal;
      const nx1 = nx0 * cy + nz0 * sy, nz1 = -nx0 * sy + nz0 * cy;
      const ny = ny0 * cp - nz1 * sp, nz = ny0 * sp + nz1 * cp;
      if (nz > -0.001) continue; // back-facing (camera looks along +z)
      let depth = 0;
      const o = i * 12;
      for (let j = 0; j < 4; j++) {
        const c = f.corners[j];
        const x = c[0] - DX / 2, y = c[1] - DY / 2, z = (c[2] - DZ / 2) * ez;
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        P[o + j * 3] = ox + x1 * S; P[o + j * 3 + 1] = oy - y2 * S; P[o + j * 3 + 2] = z2; // grid y up, screen y down
        depth += z2;
      }
      items.push({ i, f, n0: nx1, n1: ny, n2: nz, depth });
    }
    items.sort((a, b) => b.depth - a.depth);

    const dark = tok.dark;
    const [pr, pg, pb] = paperRGB;
    ctx.lineJoin = 'round';
    ctx.lineWidth = dark ? 0.6 : 0.7;
    ctx.strokeStyle = strokeCol;
    for (const it of items) {
      const { f, i } = it;
      const base = palette[f.color] || [128, 128, 128];
      const diff = Math.max(0, -(it.n0 * L[0] + it.n1 * L[1] + it.n2 * L[2]));
      const ao = f.ao ? (f.ao[0] + f.ao[1] + f.ao[2] + f.ao[3]) / 4 : 1;
      let k = 0.62 + (dark ? 0.78 : 0.5) * diff;
      k *= 0.55 + 0.45 * ao;
      let r = Math.min(255, base[0] * k), g = Math.min(255, base[1] * k), b = Math.min(255, base[2] * k);
      if (!dark) { r = r * 0.88 + pr * 0.12; g = g * 0.88 + pg * 0.12; b = b * 0.88 + pb * 0.12; } // marker wash on paper
      const o = i * 12;
      ctx.beginPath();
      ctx.moveTo(P[o], P[o + 1]);
      ctx.lineTo(P[o + 3], P[o + 4]);
      ctx.lineTo(P[o + 6], P[o + 7]);
      ctx.lineTo(P[o + 9], P[o + 10]);
      ctx.closePath();
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fill();
      ctx.stroke(); // Boceto: inked with the biro · Motor: faint wireframe
    }
    ctx.fillStyle = tok.ink3;
    ctx.font = '11px "Martian Mono", monospace';
    ctx.fillText(`yaw ${Math.round((state.yaw * 180) / Math.PI)}°  ·  z ×${ez.toFixed(2)}`, 12, h - 12);
    state.dirty = false;
  }

  // ---------- interaction ----------
  let loop = null;
  const wake = () => { state.dirty = true; state.swayUntil = performance.now() + SWAY_MS; loop?.kick(); };
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const nyaw = drag.yaw + (e.clientX - drag.x) * 0.012;
    const npitch = Math.max(-0.9, Math.min(0.7, drag.pitch - (e.clientY - drag.y) * 0.008));
    state.vy = nyaw - state.yaw;
    state.yaw = nyaw; state.pitch = npitch;
    state.userUntil = performance.now() + 6000;
    wake();
  });
  const end = () => { drag = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('keydown', (e) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return;
    e.preventDefault();
    if (k === 'ArrowLeft') state.yaw -= 0.15;
    if (k === 'ArrowRight') state.yaw += 0.15;
    if (k === 'ArrowUp') state.pitch = Math.max(-0.9, state.pitch - 0.1);
    if (k === 'ArrowDown') state.pitch = Math.min(0.7, state.pitch + 0.1);
    state.userUntil = performance.now() + 8000;
    wake();
  });

  loop = visibleLoop(stage, (dt, now) => {
    const rm = reducedMotion();
    let moving = false;
    if (!rm && state.extrude < 1) {
      state.introT += dt / 1.6;
      const u = Math.min(1, state.introT);
      state.extrude = 0.02 + 0.98 * (1 - Math.pow(1 - u, 3));
      state.yaw = -1.05 + 0.6 * (1 - Math.pow(1 - u, 2));
      state.dirty = true; moving = true;
    } else if (!rm && !drag && now > state.userUntil && now < state.swayUntil) {
      // slow idle sway, like a model on a turntable
      state.yaw += dt * 0.24 * Math.cos(now / 2900);
      state.dirty = true; moving = true;
    } else if (!drag && Math.abs(state.vy) > 0.0005) {
      state.yaw += state.vy; state.vy *= 0.9; state.dirty = true; moving = true;
    }
    if (rm) state.extrude = 1;
    if (state.dirty) draw();
    return moving || !!drag || (!rm && now < state.swayUntil);
  });

  onTheme(() => { readTokens(); state.dirty = true; draw(); });
  onLang(setReadout);
  setReadout();
  fig.classList.add('is-live');
  draw();
  loop.kick();
}
