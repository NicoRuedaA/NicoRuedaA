// Shared helpers for every figure: theme tokens, language, motion, visibility.

const root = document.documentElement;
const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

export const reducedMotion = () => mqReduce.matches;
export const lang = () => (root.getAttribute('data-lang') === 'en' ? 'en' : 'es');
export const t = (es, en) => (lang() === 'en' ? en : es);

/** 'light' | 'dark' — the theme actually applied right now. */
export function theme() {
  const forced = root.getAttribute('data-theme');
  if (forced === 'light' || forced === 'dark') return forced;
  return mqDark.matches ? 'dark' : 'light';
}

/** Read the CSS tokens so canvases draw with the same palette as the page. */
export function tokens() {
  const cs = getComputedStyle(root);
  const g = (n) => cs.getPropertyValue(n).trim();
  return {
    paper: g('--paper'), sheet: g('--sheet'), sheet2: g('--sheet-2'),
    rule: g('--rule'), rule2: g('--rule-2'),
    ink: g('--ink'), ink2: g('--ink-2'), ink3: g('--ink-3'),
    ally: g('--ally'), rival: g('--rival'), marker: g('--marker'), markerInk: g('--marker-ink'),
    ok: g('--ok'), hand: g('--hand'),
    dark: theme() === 'dark',
  };
}

const themeSubs = new Set();
const langSubs = new Set();
export const onTheme = (fn) => { themeSubs.add(fn); return () => themeSubs.delete(fn); };
export const onLang = (fn) => { langSubs.add(fn); return () => langSubs.delete(fn); };
const emitTheme = () => themeSubs.forEach((fn) => { try { fn(theme()); } catch (e) { console.error(e); } });
const emitLang = () => langSubs.forEach((fn) => { try { fn(lang()); } catch (e) { console.error(e); } });
mqDark.addEventListener?.('change', emitTheme);
new MutationObserver((recs) => {
  for (const r of recs) {
    if (r.attributeName === 'data-theme') emitTheme();
    if (r.attributeName === 'data-lang') emitLang();
  }
}).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-lang'] });

/** Format a number for the active language (181.000 / 181,000). */
export function fmt(n, opts) {
  return new Intl.NumberFormat(lang() === 'en' ? 'en-GB' : 'es-ES', opts).format(n);
}

/**
 * A canvas that follows its CSS box, capped at DPR 2.
 * Returns { ctx, w, h, dpr, resize } and calls onResize after each change.
 */
export function fitCanvas(canvas, onResize) {
  const ctx = canvas.getContext('2d');
  const state = { ctx, w: 0, h: 0, dpr: 1 };
  let ready = false;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === state.w && h === state.h && dpr === state.dpr) return;
    state.w = w; state.h = h; state.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ready && onResize) onResize(state);
  };
  state.resize = resize;
  resize();
  ready = true;
  new ResizeObserver(resize).observe(canvas);
  return state;
}

/** Run a rAF loop only while the element is on screen and the tab is visible. */
export function visibleLoop(el, frame) {
  let onScreen = false, raf = 0, last = 0;
  const tick = (now) => {
    raf = 0;
    if (!onScreen || document.hidden) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const keep = frame(dt, now);
    if (keep !== false) raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && onScreen && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; start(); }, { threshold: 0.01 }).observe(el);
  document.addEventListener('visibilitychange', start);
  return { kick: start };
}

/** Load a classic script once (used for voxel.js, which exposes window.Voxel). */
const scriptCache = new Map();
export function loadScript(src) {
  if (!scriptCache.has(src)) {
    scriptCache.set(src, new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    }));
  }
  return scriptCache.get(src);
}

/** Set text in both languages inside an element that has [lang] children, or plain text. */
export function setBi(el, es, en) {
  el.textContent = '';
  const a = document.createElement('span'); a.lang = 'es'; a.textContent = es;
  const b = document.createElement('span'); b.lang = 'en'; b.textContent = en;
  el.append(a, b);
}

export function mixHex(a, b, k) {
  const p = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}
