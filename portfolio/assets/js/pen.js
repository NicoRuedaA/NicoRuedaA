// The notebook pen: how the figures are drawn.
// Measured from Nico's pages: one confident stroke per side, a slight bow,
// corners that cross because each side runs a little past the next, and
// hatching at about 60° for tone. Seeded, so a redraw is the same drawing.

/** mulberry32: small, fast and deterministic. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a seed (FNV-1a). */
export function seedOf(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/**
 * A pen bound to a 2D context. Every call takes an options object:
 *   w      stroke width (px)            color  stroke colour
 *   over   [start, end] overshoot (px)  bow    max bow as a share of the length
 *   alpha  opacity                      dash   line dash array
 */
export function pen(ctx, seed = 1) {
  let rnd = rng(seed);
  const r = () => rnd();
  const jit = (a) => (r() * 2 - 1) * a;
  /** Restart the random stream: call with an id per shape so a shape never "boils" between frames. */
  const reseed = (s) => { rnd = rng(s); };

  /** The geometry of one hand stroke from A to B (data endpoints stay exact). */
  function stroke(x0, y0, x1, y1, o = {}) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const [os0, os1] = o.over ?? [1 + r() * 2, 2 + r() * 3];
    const bow = Math.min(o.bowMax ?? 1.2, len * (o.bow ?? 0.006)) * (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5);
    const sx = x0 - ux * os0, sy = y0 - uy * os0;
    const ex = x1 + ux * os1, ey = y1 + uy * os1;
    const mx = (sx + ex) / 2 - uy * bow, my = (sy + ey) / 2 + ux * bow;
    return { sx, sy, mx, my, ex, ey };
  }

  function line(x0, y0, x1, y1, o = {}) {
    const s = stroke(x0, y0, x1, y1, o);
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.strokeStyle = o.color || '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    const w = o.w ?? 1.5;
    // pen landing: the first stretch is a touch thinner
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.quadraticCurveTo(s.mx, s.my, s.ex, s.ey); ctx.stroke();
    if (o.pencil) {
      // graphite: a second, lighter pass slightly off the first
      ctx.globalAlpha *= 0.45;
      ctx.lineWidth = w * 0.8;
      const n = 0.5;
      ctx.beginPath(); ctx.moveTo(s.sx + n, s.sy - n); ctx.quadraticCurveTo(s.mx + n, s.my + n, s.ex - n, s.ey + n); ctx.stroke();
    }
    ctx.restore();
  }

  /** A closed or open polyline where every segment is its own stroke (so corners cross). */
  function poly(pts, closed, o = {}) {
    const n = pts.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      line(a[0], a[1], b[0], b[1], o);
    }
  }

  /** One continuous stroke through points (paths, traces): smooth, no overshoot at joints. */
  function path(pts, o = {}) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.strokeStyle = o.color || '#000';
    ctx.lineWidth = o.w ?? 1.5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + jit(o.wobble ?? 0), pts[i][1] + jit(o.wobble ?? 0));
    ctx.stroke();
    ctx.restore();
  }

  function box(x, y, w, h, o = {}) {
    poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, o);
  }

  /** An X, like his crossed-out marks and the dead units. */
  function cross(x, y, s, o = {}) {
    line(x - s, y - s, x + s, y + s, { over: [0, 1], ...o });
    line(x + s, y - s, x - s, y + s, { over: [0, 1], ...o });
  }

  /** A circle that does not quite close (his heads and "O" buttons). */
  function ring(x, y, rad, o = {}) {
    const a0 = r() * Math.PI * 2;
    const gap = o.closed ? -0.25 : 0.18 + r() * 0.2;
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.strokeStyle = o.color || '#000';
    ctx.lineWidth = o.w ?? 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (Math.PI * 2 - gap) * (i / steps);
      const rr = rad * (1 + (o.squash ?? 0.04) * Math.sin(a * 2 + a0));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Hatch the current path's area: straight parallel strokes at `angle`,
   * `gap` apart, clipped to the path. level 1 = single, 2 = cross, 3 = dense cross.
   */
  function hatch(build, level, o = {}) {
    if (!level) return;
    ctx.save();
    ctx.beginPath(); build(ctx); ctx.clip();
    const b = o.bounds; // [x, y, w, h]
    const gap = (o.gap ?? 5) * (level >= 3 ? 0.7 : 1);
    const angles = level >= 2 ? [o.angle ?? -60, (o.angle ?? -60) + 90] : [o.angle ?? -60];
    ctx.strokeStyle = o.color || '#000';
    ctx.globalAlpha *= o.alpha ?? 0.8;
    ctx.lineWidth = o.w ?? 0.8;
    ctx.lineCap = 'butt';
    const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
    const R = Math.hypot(b[2], b[3]) / 2 + gap;
    for (const deg of angles) {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      // anchor the phase to the canvas, not the shape, so neighbouring shapes line up
      const phase = ((cx * nx + cy * ny) % gap + gap) % gap;
      ctx.beginPath();
      for (let d = -R - phase; d <= R; d += gap) {
        const px = cx + nx * d, py = cy + ny * d;
        const j = o.jitter ?? 0.25;
        ctx.moveTo(px - ux * R + jit(j), py - uy * R + jit(j));
        ctx.lineTo(px + ux * R + jit(j), py + uy * R + jit(j));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A stick figure, like the units in his storyboards (05): head, body, arms, legs. */
  function stick(x, y, h, o = {}) {
    const hr = h * 0.17;
    ring(x, y - h / 2 + hr, hr, { ...o, closed: true, squash: 0.08 });
    const neck = y - h / 2 + hr * 2, hip = y + h * 0.12;
    line(x, neck, x, hip, { ...o, over: [0, 0.5] });
    line(x - h * 0.24, neck + h * 0.16, x + h * 0.24, neck + h * 0.12, { ...o, over: [0.5, 0.5] });
    line(x, hip, x - h * 0.2, y + h / 2, { ...o, over: [0, 0.5] });
    line(x, hip, x + h * 0.2, y + h / 2, { ...o, over: [0, 0.5] });
  }

  /** An open arrowhead «>» at (x, y) pointing along angle a. */
  function head(x, y, a, size, o = {}) {
    const b = 0.5;
    line(x - Math.cos(a - b) * size, y - Math.sin(a - b) * size, x, y, { over: [0, 0.5], ...o });
    line(x - Math.cos(a + b) * size, y - Math.sin(a + b) * size, x, y, { over: [0, 0.5], ...o });
  }

  return { line, poly, path, box, cross, ring, hatch, stick, head, reseed, r };
}

/**
 * The screen rectangle around a figure: four single strokes that run past
 * each other at the corners. An SVG overlay sized in CSS pixels, redrawn on
 * resize with the same seed, so it never changes shape.
 */
export function inkFrame(el, seed = 1, os = 6) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ink-frame');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const paths = [0, 1, 2, 3].map(() => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('pathLength', '1');
    svg.appendChild(p);
    return p;
  });
  el.appendChild(svg);
  let lw = 0, lh = 0;
  const draw = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h || (w === lw && h === lh)) return;
    lw = w; lh = h;
    const r = rng(seed);
    const j = (a) => (r() * 2 - 1) * a;
    const o = Math.min(os, 2 + Math.min(w, h) * 0.02);
    const run = () => o * (0.35 + r() * 0.75);
    const side = (x0, y0, x1, y1) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const bow = Math.min(1.4, len * 0.004) * (r() < 0.5 ? -1 : 1);
      const mx = (x0 + x1) / 2 - (dy / len) * bow, my = (y0 + y1) / 2 + (dx / len) * bow;
      return `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    };
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const t0 = j(0.9), t1 = j(0.9), r0 = j(0.9), r1 = j(0.9), b0 = j(0.9), b1 = j(0.9), l0 = j(0.9), l1 = j(0.9);
    paths[0].setAttribute('d', side(-run(), t0, w + run(), t1));
    paths[1].setAttribute('d', side(w + r0, -run(), w + r1, h + run()));
    paths[2].setAttribute('d', side(w + run(), h + b0, -run(), h + b1));
    paths[3].setAttribute('d', side(l0, h + run(), l1, -run()));
  };
  new ResizeObserver(draw).observe(el);
  draw();
  return svg;
}

/**
 * Canvas patterns for tone hatching (used where there are thousands of shapes,
 * like the voxel faces). Anchored to the canvas so the hatch stays put while
 * the shapes move under it, as if re-hatched on each frame.
 */
export function hatchPatterns(ctx, color, dpr = 1, gap = 5) {
  const make = (level) => {
    const s = Math.round(gap * 2 * dpr);
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const g = c.getContext('2d');
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, 0.8 * dpr);
    g.globalAlpha = 0.9;
    const lines = (flip) => {
      g.beginPath();
      for (let k = -2; k <= 2; k++) {
        // 45° lines tile cleanly; the pattern is rotated to ~60° below
        const o = k * (s / 2);
        if (flip) { g.moveTo(o, 0); g.lineTo(o + s, s); } else { g.moveTo(o, s); g.lineTo(o + s, 0); }
      }
      g.stroke();
    };
    lines(false);
    if (level >= 2) lines(true);
    const p = ctx.createPattern(c, 'repeat');
    const m = new DOMMatrix().scale(1 / dpr, 1 / dpr).rotate(-15);
    p.setTransform?.(level >= 3 ? m.scale(0.7, 0.7) : m);
    return p;
  };
  return [null, make(1), make(2), make(3)];
}
