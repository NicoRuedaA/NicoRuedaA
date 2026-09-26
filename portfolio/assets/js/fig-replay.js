// FIG. 2 — replay of a real AI-vs-AI match recorded from Nico's Rust/WASM
// match engine (seed 20026). The data file holds the leaders' sampled
// positions (every 30 ticks), the lanes and the buildings.
// Motor theme: live trails that persist and fade. Boceto theme: the full ink record.
import { tokens, onTheme, onLang, reducedMotion, fitCanvas, visibleLoop, t, fmt } from './core.js';

const SPEED = 300; // ticks per second of wall time (10× real time)
const LAST = 9000;

export async function mount(fig) {
  const stage = fig.querySelector('.plate__stage');
  const canvas = stage.querySelector('canvas');
  const readout = fig.querySelector('[data-readout]');
  const scrub = fig.querySelector('[data-scrub]');
  const playBtn = fig.querySelector('[data-play]');

  const data = await (await fetch('assets/data/match-20026.json')).json();
  const [bx0, by0, bx1, by1] = data.bounds;
  const lives = data.lives.map((l) => ({ ...l, ally: l.team === 'blue' }));
  // movement per sample tick, to fast-forward the idle stretches
  const moving = new Map();
  for (const l of lives) {
    for (let i = 1; i < l.pts.length; i++) {
      const [tk, x, y] = l.pts[i], [, px, py] = l.pts[i - 1];
      if (Math.abs(x - px) + Math.abs(y - py) > 2) moving.set(tk, true);
    }
  }

  let tok = tokens();
  let tick = reducedMotion() ? LAST : 0;
  let playing = !reducedMotion();
  let staticLayer = null;
  const view = fitCanvas(canvas, () => { staticLayer = null; draw(); });

  function xf() {
    const { w, h } = view;
    const s = Math.min(w / (bx1 - bx0), h / (by1 - by0));
    const ox = (w - (bx1 - bx0) * s) / 2 - bx0 * s;
    const oy = (h - (by1 - by0) * s) / 2 - by0 * s;
    return { s, X: (x) => ox + x * s, Y: (y) => oy + y * s };
  }

  function buildStatic() {
    const { w, h, dpr } = view;
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { s, X, Y } = xf();
    // grid, like the plate's graph paper
    g.strokeStyle = tok.rule2; g.lineWidth = 1;
    const step = 50 * s;
    for (let x = X(bx0) % step; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = Y(by0) % step; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // lanes as corridors
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const lane of data.lanes) {
      g.strokeStyle = tok.dark ? '#1b2029' : tok.rule;
      g.lineWidth = Math.max(6, 22 * s);
      g.beginPath();
      lane.points.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      g.stroke();
    }
    return c;
  }

  function drawBuilding(ctx, b, X, Y, down) {
    const x = X(b.x), y = Y(b.y);
    const r = b.cat === 'castle' ? 7 : b.cat.startsWith('turret') ? 3.5 : 4.5;
    const col = b.team === 'blue' ? tok.ally : b.team === 'red' ? tok.rival : tok.ink3;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = col;
    ctx.fillStyle = tok.dark ? 'rgba(10,12,16,.9)' : tok.sheet2;
    ctx.beginPath();
    if (b.team === 'red') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.1, y + r * 0.85); ctx.lineTo(x - r * 1.1, y + r * 0.85); ctx.closePath(); }
    else if (b.team === 'blue') { ctx.rect(x - r, y - r, r * 2, r * 2); }
    else { ctx.arc(x, y, r, 0, Math.PI * 2); }
    ctx.fill(); ctx.stroke();
    if (down) {
      ctx.strokeStyle = tok.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - r - 2, y - r - 2); ctx.lineTo(x + r + 2, y + r + 2); ctx.moveTo(x + r + 2, y - r - 2); ctx.lineTo(x - r - 2, y + r + 2); ctx.stroke();
    }
  }

  function draw() {
    const { ctx, w, h } = view;
    if (!w) return;
    if (!staticLayer) staticLayer = buildStatic();
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(staticLayer, 0, 0, w, h);
    const { X, Y } = xf();
    for (const b of data.buildings) drawBuilding(ctx, b, X, Y, b.until != null && tick >= b.until);

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const dark = tok.dark;
    for (const l of lives) {
      const pts = l.pts;
      if (!pts.length || pts[0][0] > tick) continue;
      const col = l.ally ? tok.ally : tok.rival;
      if (dark) {
        // phosphor persistence: old segments dim to a burn-in floor, the last seconds glow
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i < pts.length && pts[i][0] <= tick; i++) {
          const age = (tick - pts[i][0]) / 900; // 30 s of game time
          const a = Math.max(0.16, 1 - age);
          ctx.strokeStyle = col;
          ctx.globalAlpha = a * 0.22; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(X(pts[i - 1][1]), Y(pts[i - 1][2])); ctx.lineTo(X(pts[i][1]), Y(pts[i][2])); ctx.stroke();
          ctx.globalAlpha = a; ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = 1.35; ctx.globalAlpha = 0.9;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < pts.length && pts[i][0] <= tick; i++) {
          const x = X(pts[i][1]), y = Y(pts[i][2]);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        // minute marks, as a printed record would have
        ctx.fillStyle = col; ctx.font = '9px "Martian Mono", monospace';
        for (let i = 0; i < pts.length && pts[i][0] <= tick; i++) {
          if (pts[i][0] % 1800 === 0) {
            const x = X(pts[i][1]), y = Y(pts[i][2]);
            ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillText(`${pts[i][0] / 1800}:00`, x + 4, y - 4);
          }
        }
      }
      // head or death mark
      let j = 0;
      while (j + 1 < pts.length && pts[j + 1][0] <= tick) j++;
      const cur = pts[j];
      const nx = pts[j + 1];
      let x = cur[1], y = cur[2];
      if (nx && nx[0] > tick) { const k = (tick - cur[0]) / (nx[0] - cur[0]); x += (nx[1] - x) * k; y += (nx[2] - y) * k; }
      const dead = pts[pts.length - 1][0] < LAST && tick >= pts[pts.length - 1][0];
      if (dead) {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        const px = X(x), py = Y(y);
        ctx.beginPath(); ctx.moveTo(px - 5, py - 5); ctx.lineTo(px + 5, py + 5); ctx.moveTo(px + 5, py - 5); ctx.lineTo(px - 5, py + 5); ctx.stroke();
      } else {
        ctx.fillStyle = dark ? '#fff' : tok.sheet2;
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(x), Y(y), dark ? 3.2 : 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (dark) { ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(X(x), Y(y), 9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      }
    }
    // readout
    const secs = Math.floor(tick / 30);
    const mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
    const ff = playing && !moving.get(Math.ceil(tick / 30) * 30) && tick < LAST;
    readout.textContent = `tick ${fmt(tick)} / ${fmt(LAST)} · ${mm}:${ss}` + (ff ? t(' · sin movimiento, avance rápido', ' · no movement, fast-forward') : '') + (tick >= LAST ? t(' · fin de la traza', ' · end of trace') : '');
    scrub.value = String(tick);
    scrub.setAttribute('aria-valuetext', t(`Tick ${tick} de ${LAST}, minuto ${mm}:${ss}`, `Tick ${tick} of ${LAST}, minute ${mm}:${ss}`));
  }

  function setPlaying(v) {
    playing = v;
    if (playing && tick >= LAST) tick = 0;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? t('Pausa', 'Pause') : tick >= LAST ? t('Repetir', 'Replay') : t('Reproducir', 'Play');
    loop.kick();
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  scrub.addEventListener('input', () => { tick = Number(scrub.value); if (playing) setPlaying(false); draw(); });
  stage.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tick = Math.min(LAST, tick + 300); draw(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); tick = Math.max(0, tick - 300); draw(); }
  });

  const loop = visibleLoop(stage, (dt) => {
    if (!playing) { draw(); return false; }
    const sampleTick = Math.ceil(tick / 30) * 30;
    const mult = moving.get(sampleTick) || tick === 0 ? 1 : 6;
    tick = Math.min(LAST, tick + dt * SPEED * mult);
    tick = Math.round(tick);
    if (tick >= LAST) { draw(); setPlaying(false); return false; }
    draw();
    return true;
  });

  onTheme(() => { tok = tokens(); staticLayer = null; draw(); });
  onLang(() => { setPlaying(playing); draw(); });
  setPlaying(playing);
  draw();
}
