// FIG. 0 — Nico's hand-drawn frog head (2022) run through Voxelizer's real
// engine (voxel.js, 2026, MPL-2.0) inside the visitor's browser.
// voxel.js does the maths (quantize → distance-transform depth → occupancy →
// greedy mesh → AO). This file only projects and paints the quads it returns.
import { tokens, onTheme, onLang, reducedMotion, fitCanvas, visibleLoop, loadScript, fmt, t, mixHex } from './core.js';

const SRC_IMG = 'assets/data/sapo64.png';
const SRC_JS = 'assets/vendor/voxel.js';
const OPTS = (greedy) => ({
  depth: { layers: 14, profile: 'dt', mode: 'symmetric' },
  palette: { colors: 16 },
  mesh: { greedy, ao: false },
});

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('img ' + src));
    im.src = src;
  });
}

// voxelize() in a Web Worker so the page never freezes; main thread as fallback.
function makeRunner(V) {
  let worker = null;
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
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  } catch (e) { worker = null; }
  let seq = 0;
  const local = (pixels, greedy) => {
    const t0 = performance.now();
    const r = V.voxelize(pixels, OPTS(greedy));
    r.ms = performance.now() - t0;
    const list = greedy ? r.greedyFacesList : (r.naiveFacesList || r.greedyFacesList);
    V.annotateAO(list, r.grid, r.dims, 0.9);
    return r;
  };
  return (pixels, greedy) => new Promise((resolve) => {
    if (!worker) { resolve(local(pixels, greedy)); return; }
    const id = ++seq;
    const onMsg = (e) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', onMsg);
      if (e.data.ok) resolve(e.data.r); else resolve(local(pixels, greedy));
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', () => { worker = null; resolve(local(pixels, greedy)); }, { once: true });
    worker.postMessage({ id, pixels: { w: pixels.w, h: pixels.h, data: pixels.data }, greedy, opts: OPTS(greedy) });
  });
}

export async function mount(fig) {
  const stage = fig.querySelector('.plate__stage');
  const canvas = stage.querySelector('canvas');
  const readout = fig.querySelector('[data-readout]');
  const meshBtns = [...fig.querySelectorAll('[data-mesh]')];

  await loadScript(SRC_JS);
  const V = window.Voxel;
  const img = await loadImage(SRC_IMG);
  const off = document.createElement('canvas');
  off.width = img.naturalWidth; off.height = img.naturalHeight;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.drawImage(img, 0, 0);
  const id = octx.getImageData(0, 0, off.width, off.height);
  const pixels = { w: id.width, h: id.height, data: id.data };

  const run = makeRunner(V);
  const greedy = await run(pixels, true);
  const ms = greedy.ms;
  let naive = null; // computed on demand

  const [DX, DY, DZ] = greedy.dims;
  const palette = greedy.palette.map((c) => c.slice(0, 3));
  const state = {
    mode: 'greedy',
    yaw: -0.62, pitch: -0.3,
    extrude: reducedMotion() ? 1 : 0.02,
    introT: 0,
    userUntil: 0,
    vy: 0, vp: 0,
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

  async function ensureNaive() {
    if (naive) return;
    const r = await run(pixels, false);
    naive = { list: r.naiveFacesList || r.greedyFacesList };
  }

  meshBtns.forEach((b) => b.addEventListener('click', async () => {
    const want = b.dataset.mesh;
    meshBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (want === 'naive') await ensureNaive();
    state.mode = want;
    setReadout(); state.dirty = true; loop.kick();
  }));

  // ---------- projection + painting ----------
  let tok = tokens();
  const view = fitCanvas(canvas, () => { state.dirty = true; draw(); });
  const L = norm([0.45, -0.75, 0.55]); // travels from an upper-left-front light (grid y points up)
  function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }

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
    const rot = (x, y, z) => {
      // centre, squash depth (extrusion intro), yaw about Y, pitch about X
      x -= DX / 2; y -= DY / 2; z = (z - DZ / 2) * ez;
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      return [x1, -y2, z2]; // grid y points up, screen y points down
    };
    const rotN = (n) => {
      const [x, y, z] = n;
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    };
    const list = faces();
    const items = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const n = rotN(f.normal);
      if (n[2] > -0.001) continue; // back-facing (camera looks along +z)
      const p = f.corners.map((c) => rot(c[0], c[1], c[2]));
      const depth = (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4;
      items.push({ f, n, p, depth });
    }
    items.sort((a, b) => b.depth - a.depth);

    const paper = tok.paper;
    const dark = tok.dark;
    ctx.lineJoin = 'round';
    for (const it of items) {
      const { f, n, p } = it;
      const base = palette[f.color] || [128, 128, 128];
      const diff = Math.max(0, -(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]));
      const ao = f.ao ? (f.ao[0] + f.ao[1] + f.ao[2] + f.ao[3]) / 4 : 1;
      let k = (dark ? 0.62 : 0.62) + (dark ? 0.78 : 0.5) * diff;
      k *= 0.55 + 0.45 * ao;
      const r = Math.min(255, base[0] * k), g = Math.min(255, base[1] * k), b = Math.min(255, base[2] * k);
      ctx.beginPath();
      ctx.moveTo(ox + p[0][0] * S, oy + p[0][1] * S);
      for (let j = 1; j < 4; j++) ctx.lineTo(ox + p[j][0] * S, oy + p[j][1] * S);
      ctx.closePath();
      if (dark) {
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(92,200,255,0.22)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      } else {
        // Boceto: marker wash on paper, inked with the biro
        ctx.fillStyle = mixHex(`#${[r, g, b].map((v) => (v | 0).toString(16).padStart(2, '0')).join('')}`, paper, 0.12);
        ctx.fill();
        ctx.strokeStyle = tok.ally;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = tok.ink3;
    ctx.font = '10px "Martian Mono", monospace';
    ctx.fillText(`yaw ${Math.round((state.yaw * 180) / Math.PI)}°  ·  z ×${ez.toFixed(2)}`, 12, h - 12);
    state.dirty = false;
  }

  // ---------- interaction ----------
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch, t: performance.now() };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const nyaw = drag.yaw + (e.clientX - drag.x) * 0.012;
    const npitch = Math.max(-0.9, Math.min(0.7, drag.pitch - (e.clientY - drag.y) * 0.008));
    state.vy = nyaw - state.yaw; state.vp = npitch - state.pitch;
    state.yaw = nyaw; state.pitch = npitch;
    state.userUntil = performance.now() + 6000;
    state.dirty = true; loop.kick();
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
    state.dirty = true; loop.kick();
  });

  const loop = visibleLoop(stage, (dt, now) => {
    const rm = reducedMotion();
    if (!rm && state.extrude < 1) {
      state.introT += dt / 1.6;
      const u = Math.min(1, state.introT);
      state.extrude = 0.02 + 0.98 * (1 - Math.pow(1 - u, 3));
      state.yaw = -1.05 + 0.6 * (1 - Math.pow(1 - u, 2));
      state.dirty = true;
    } else if (!rm && !drag && now > state.userUntil) {
      // slow idle sway, like a model on a turntable
      state.yaw += dt * 0.24 * Math.cos(now / 2900);
      state.dirty = true;
    } else if (!drag && (Math.abs(state.vy) > 0.0005)) {
      state.yaw += state.vy; state.vy *= 0.9; state.dirty = true;
    }
    if (rm) state.extrude = 1;
    if (state.dirty) draw();
    return !rm || state.dirty || !!drag;
  });

  onTheme(() => { tok = tokens(); state.dirty = true; draw(); });
  onLang(setReadout);
  setReadout();
  fig.classList.add('is-live');
  draw();
  loop.kick();
}
