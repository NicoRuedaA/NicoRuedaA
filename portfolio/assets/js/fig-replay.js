// FIG. 2 — replay of a real AI-vs-AI match recorded from Nico's Rust/WASM
// match engine (seed 20026). The data file holds the leaders' sampled
// positions (every 30 ticks), the lanes and the buildings.
// Drawn like a page of his notebook: pencil lanes, biro squares for one team,
// garnet triangles for the other, × for what falls.
// Tinta theme: the trails fade as they age. Papel theme: the full ink record.
import { tokens, onTheme, onLang, reducedMotion, fitCanvas, visibleLoop, t, fmt } from './core.js';
import { pen, seedOf } from './pen.js';

const SPEED = 300; // ticks per second of wall time (10× real time)
const LAST = 9000;

export async function mount(fig) {
  const stage = fig.querySelector('.plate__stage');
  const canvas = stage.querySelector('canvas');
  const readout = fig.querySelector('[data-readout]');
  const scrub = fig.querySelector('[data-scrub]');
  const playBtn = fig.querySelector('[data-play]');

  const res = await fetch('assets/data/match-20026.json');
  if (!res.ok) throw new Error('match-20026.json ' + res.status);
  const data = await res.json();
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
    // lanes as a road drawn in pencil: a wide stroke with its middle rubbed out
    g.lineCap = 'round'; g.lineJoin = 'round';
    const lw = Math.max(8, 20 * s);
    for (const lane of data.lanes) {
      const trace = () => { g.beginPath(); lane.points.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); };
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = tok.pencil; g.lineWidth = lw; trace(); g.stroke();
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = lw - 2; trace(); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // the buildings' outlines never change: draw them once
    const P = pen(g);
    for (const b of data.buildings) building(P, b, X, Y);
    return c;
  }

  function size(b) { return b.cat === 'castle' ? 7 : b.cat.startsWith('turret') ? 3.6 : 4.8; }
  // his notation: □ for one side, △ for the other, ○ for the neutral camps
  function building(P, b, X, Y) {
    const x = X(b.x), y = Y(b.y), r = size(b);
    P.reseed(seedOf(b.id || `${b.x},${b.y}`));
    if (b.team === 'blue') {
      P.hatch((c) => c.rect(x - r, y - r, r * 2, r * 2), 2, { bounds: [x - r, y - r, r * 2, r * 2], color: tok.pen, gap: 3, alpha: 0.7, w: 0.7 });
      P.box(x - r, y - r, r * 2, r * 2, { color: tok.pen, w: 1.4, over: [0.5, 1.5] });
    } else if (b.team === 'red') {
      P.poly([[x, y - r * 1.2], [x + r * 1.15, y + r * 0.9], [x - r * 1.15, y + r * 0.9]], true, { color: tok.red, w: 1.4, over: [0.5, 1.5] });
    } else {
      P.ring(x, y, r, { color: tok.pencil, w: 1.1 });
    }
  }

  // One segment at a time. Dashed segments all point the same way and take
  // their dash phase from map position, so red lives that share a road share
  // one dash pattern and never merge into a solid line.
  function segments(pts, dashed, alphaAt) {
    const { ctx } = view;
    const { X, Y } = xf();
    ctx.save();
    ctx.lineCap = dashed ? 'butt' : 'round';
    if (dashed) ctx.setLineDash([5, 3]);
    for (let i = 1; i < pts.length && pts[i][0] <= tick; i++) {
      let ax = X(pts[i - 1][1]), ay = Y(pts[i - 1][2]), bx = X(pts[i][1]), by = Y(pts[i][2]);
      if (ax === bx && ay === by) continue;
      if (dashed) {
        if (bx < ax || (bx === ax && by < ay)) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
        const len = Math.hypot(bx - ax, by - ay);
        ctx.lineDashOffset = (((ax * (bx - ax) + ay * (by - ay)) / len) % 8 + 8) % 8;
      }
      if (alphaAt) ctx.globalAlpha = alphaAt(i);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    const { ctx, w, h } = view;
    if (!w) return;
    if (!staticLayer) staticLayer = buildStatic();
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(staticLayer, 0, 0, w, h);
    const { X, Y } = xf();
    const P = pen(ctx);
    for (const b of data.buildings) {
      if (b.until != null && tick >= b.until) {
        P.reseed(seedOf('x' + (b.id || `${b.x},${b.y}`)));
        P.cross(X(b.x), Y(b.y), size(b) + 2.5, { color: tok.ink, w: 1.5 });
      }
    }

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const dark = tok.dark;
    for (const l of lives) {
      const pts = l.pts;
      if (!pts.length || pts[0][0] > tick) continue;
      const col = l.ally ? tok.pen : tok.red;
      if (dark) {
        // Tinta: old segments fade to a faint floor, the last half-minute stays sharp
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        segments(pts, !l.ally, (i) => Math.max(0.18, 1 - (tick - pts[i][0]) / 900)); // 30 s of game time
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = 1.35; ctx.globalAlpha = 0.9;
        if (l.ally) {
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < pts.length && pts[i][0] <= tick; i++) {
            const x = X(pts[i][1]), y = Y(pts[i][2]);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else segments(pts, true);
        ctx.globalAlpha = 1;
        // minute marks, as a printed record would have
        ctx.fillStyle = col; ctx.font = '10px "Martian Mono", monospace';
        for (let i = 0; i < pts.length && pts[i][0] <= tick; i++) {
          if (pts[i][0] % 1800 === 0) {
            const x = X(pts[i][1]), y = Y(pts[i][2]);
            ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillText(`${pts[i][0] / 1800}'`, x + 4, y - 4);
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
      P.reseed(seedOf(l.id || String(l.pts[0][0])));
      if (dead) {
        P.cross(X(x), Y(y), 4.5, { color: col, w: 1.8 });
      } else {
        ctx.fillStyle = tok.paper;
        ctx.beginPath(); ctx.arc(X(x), Y(y), 3.6, 0, Math.PI * 2); ctx.fill();
        P.ring(X(x), Y(y), 3.8, { color: col, w: 1.8, closed: true });
      }
    }
    // readout
    const secs = Math.floor(tick / 30);
    const mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
    const ff = playing && !moving.get(Math.ceil(tick / 30) * 30) && tick < LAST;
    let end = '';
    if (tick >= LAST) {
      const down = (team) => data.buildings.filter((b) => b.team === team && b.until != null && b.until <= LAST).length;
      end = t(` · fin: ${down('blue')} edificios azules y ${down('red')} rojos caídos`, ` · end: ${down('blue')} blue and ${down('red')} red buildings down`);
    }
    readout.textContent = `tick ${fmt(tick)} / ${fmt(LAST)} · ${mm}:${ss}` + (ff ? t(' · sin movimiento, avance rápido', ' · no movement, fast-forward') : '') + end;
    scrub.value = String(tick);
    scrub.style.setProperty('--p', (tick / LAST) * 100 + '%');
    scrub.setAttribute('aria-valuetext', t(`Tick ${tick} de ${LAST}, minuto ${mm}:${ss}`, `Tick ${tick} of ${LAST}, minute ${mm}:${ss}`));
  }

  function setPlaying(v) {
    playing = v;
    if (playing && tick >= LAST) tick = 0;
    playBtn.textContent = playing ? t('Pausa', 'Pause') : tick >= LAST ? t('Repetir', 'Replay') : t('Reproducir', 'Play');
    playBtn.dataset.state = playing ? 'pause' : 'play';
    loop.kick();
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  scrub.addEventListener('input', () => { tick = Number(scrub.value); if (playing) setPlaying(false); draw(); });

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
