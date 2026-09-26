import { theme, lang, onTheme, onLang, reducedMotion, fmt, t, setBi } from './core.js';
import { inkFrame, seedOf } from './pen.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};

/* ---------------- theme: Papel (light) / Tinta (dark) ---------------- */
function syncTheme() {
  const cur = theme();
  $$('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === cur)));
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', cur === 'dark' ? '#0f1326' : '#f6f6f2'));
}
$$('[data-set-theme]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.setTheme;
  root.setAttribute('data-theme', v);
  store.set('nr-theme', v);
}));
onTheme(syncTheme);
syncTheme();

/* ---------------- language ---------------- */
function syncLang() {
  const cur = lang();
  root.setAttribute('lang', cur);
  $$('[data-set-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setLang === cur)));
  $$('[data-num]').forEach((el) => {
    el.textContent = (el.dataset.approx ? '≈' : '') + fmt(Number(el.dataset.num));
  });
  // attributes can't hold two <span lang> children: the Spanish lives in the
  // attribute itself, the English in data-*-en; keep a copy of the Spanish
  const attrs = [['aria-label', 'ariaEn', 'ariaEs'], ['alt', 'altEn', 'altEs'], ['title', 'titleEn', 'titleEs']];
  $$('[data-aria-en], [data-alt-en], [data-title-en]').forEach((el) => {
    for (const [attr, en, es] of attrs) {
      if (el.dataset[en] == null) continue;
      if (el.dataset[es] == null) el.dataset[es] = el.getAttribute(attr) || '';
      el.setAttribute(attr, cur === 'en' ? el.dataset[en] : el.dataset[es]);
    }
  });
  document.title = 'Nico Rueda';
}
$$('[data-set-lang]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.setLang;
  root.setAttribute('data-lang', v);
  store.set('nr-lang', v);
}));
onLang(syncLang);
syncLang();

/* ---------------- index sheet (mobile menu) ---------------- */
const menu = $('#menu');
const openBtn = $('#menu-open');
const closeBtn = $('#menu-close');
const background = () => $$('body > :not(#menu):not(script)');
const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } };
function openMenu() {
  menu.hidden = false;
  document.body.style.overflow = 'hidden';
  openBtn.setAttribute('aria-expanded', 'true');
  background().forEach((el) => { el.inert = true; });
  document.addEventListener('keydown', onEsc);
  closeBtn.focus();
}
function closeMenu(focusBack = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  document.body.style.overflow = '';
  openBtn.setAttribute('aria-expanded', 'false');
  background().forEach((el) => { el.inert = false; }); // before focusing: inert elements can't take focus
  document.removeEventListener('keydown', onEsc);
  if (focusBack) openBtn.focus();
}
openBtn?.addEventListener('click', openMenu);
closeBtn?.addEventListener('click', () => closeMenu());
menu?.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(false); });
menu?.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const f = $$('a, button', menu).filter((x) => x.offsetParent !== null);
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
// the sheet only exists below the nav breakpoint (site.css: max-width 1020px)
window.matchMedia('(min-width: 1021px)').addEventListener?.('change', (e) => { if (e.matches) closeMenu(false); });

/* ---------------- active section in the nav ---------------- */
const navLinks = $$('.nav a');
const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
const seen = new Map();
const markNav = () => {
  let best = null;
  seen.forEach((on, id) => { if (on) best = id; });
  navLinks.forEach((a) => {
    if (a.getAttribute('href') === '#' + best) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
};
// A thin band across the middle of the viewport decides which section is "current".
const navIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
  markNav();
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => navIO.observe(s));

/* ---------------- copy buttons ---------------- */
$$('[data-copy]').forEach((b) => {
  // the label lives in its own span so the pen-drawn frame survives label swaps
  const label = document.createElement('span');
  label.className = 'copy__t';
  label.append(...b.childNodes);
  b.appendChild(label);
  const orig = label.innerHTML;
  let timer = 0;
  b.addEventListener('click', async () => {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      setBi(label, 'Copiado', 'Copied');
      b.classList.add('is-done');
    } catch (e) {
      // clipboard refused: select the text so the visitor can copy it by hand
      const target = b.previousElementSibling;
      if (target) {
        const r = document.createRange(); r.selectNodeContents(target);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      }
      setBi(label, 'Selecciónalo y copia', 'Select and copy');
    }
    timer = setTimeout(() => { label.innerHTML = orig; b.classList.remove('is-done'); }, 2400);
  });
});

/* ---------------- click-to-play videos (nothing downloads until asked) ---------------- */
const videos = new Set();
const vidIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const v = e.target.querySelector('video');
    if (!v) return;
    if (!e.isIntersecting && !v.paused) { v.pause(); e.target.dataset.resume = '1'; }
    else if (e.isIntersecting && e.target.dataset.resume) { delete e.target.dataset.resume; v.play().catch(() => {}); }
  });
});
$$('[data-video]').forEach((btn) => {
  const box = btn.closest('.vid');
  const glyph = btn.querySelector('[aria-hidden]');
  const labels = [...btn.querySelectorAll('[lang]')].map((el) => [el, el.textContent]);
  btn.setAttribute('aria-pressed', 'false');
  const show = (playing) => {
    box.classList.toggle('is-playing', playing);
    glyph.textContent = playing ? '❚❚' : '▶';
    btn.setAttribute('aria-pressed', String(playing));
  };
  const fail = () => {
    show(false);
    labels.forEach(([el]) => { el.textContent = el.lang === 'en' ? 'Could not play' : 'No se pudo reproducir'; });
  };
  vidIO.observe(box);
  btn.addEventListener('click', () => {
    let v = box.querySelector('video');
    if (!v) {
      v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('aria-hidden', 'true'); // the poster alt and the button already describe it
      v.addEventListener('error', fail, { once: true });
      v.addEventListener('click', () => btn.click());
      v.src = btn.dataset.video;
      box.appendChild(v);
      videos.add(v);
    }
    if (v.paused) {
      videos.forEach((o) => { if (o !== v && !o.paused) o.pause(); });
      $$('.vid.is-playing').forEach((b) => { if (b !== box) { b.classList.remove('is-playing'); const g = b.querySelector('.vid__play [aria-hidden]'); if (g) g.textContent = '▶'; b.querySelector('.vid__play')?.setAttribute('aria-pressed', 'false'); } });
      labels.forEach(([el, txt]) => { el.textContent = txt; });
      v.play().then(() => show(true)).catch(fail);
    } else {
      v.pause(); show(false);
    }
  });
});

/* ---------------- sprite strips (frog idle: 4 frames @ 400 ms, as in the game) ---------------- */
$$('[data-sprite]').forEach((el) => {
  const n = Number(el.dataset.sprite), ms = Number(el.dataset.ms || 150);
  let i = 0, timer = 0, steps = 0;
  const step = () => {
    i = (i + 1) % n; el.style.backgroundPosition = `${(i / (n - 1)) * 100}% 0`;
    if (++steps >= n * 8) { clearInterval(timer); timer = 0; } // plays 8 loops, then rests
  };
  const play = () => { if (!timer && !reducedMotion()) { steps = 0; timer = setInterval(step, ms); } };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) play(); else { clearInterval(timer); timer = 0; }
  }).observe(el);
  el.closest('.game__media')?.addEventListener('pointerenter', play);
});

/* ---------------- Mobalike: 100 / (100 + armor) ---------------- */
(function armorChart() {
  const box = $('[data-armor]');
  if (!box) return;
  const svg = box.querySelector('svg');
  const draw = () => {
    const W = 300, H = 110, pad = 18;
    const X = (a) => pad + (a / 300) * (W - pad * 2);
    const Y = (m) => H - pad - m * (H - pad * 2);
    let d = '';
    for (let a = 0; a <= 300; a += 5) d += (a ? 'L' : 'M') + X(a).toFixed(1) + ' ' + Y(100 / (100 + a)).toFixed(1);
    box.querySelector('code').textContent = t('daño = bruto × 100 / (100 + armadura)', 'damage = raw × 100 / (100 + armour)');
    svg.innerHTML = `
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad + 4}" y2="${H - pad}" stroke="var(--pencil)"/>
      <line x1="${pad}" y1="${pad - 4}" x2="${pad}" y2="${H - pad}" stroke="var(--pencil)"/>
      <path d="${d}" fill="none" stroke="var(--pen)" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="${X(100)}" y1="${Y(0.5)}" x2="${X(100)}" y2="${H - pad}" stroke="var(--red)" stroke-dasharray="3 3"/>
      <path d="M${X(100) - 4} ${Y(0.5) - 4}l8 8M${X(100) + 4} ${Y(0.5) - 4}l-8 8" stroke="var(--red)" stroke-width="1.6" stroke-linecap="round"/>
      <text x="${X(100) + 8}" y="${Y(0.5) - 6}" font-family="Martian Mono, monospace" font-size="12" fill="var(--ink-2)">${t('100 de armadura → 50 %', '100 armour → 50%')}</text>
      <text x="${pad}" y="${H - 3}" font-family="Martian Mono, monospace" font-size="11" fill="var(--ink-3)">0</text>
      <text x="${W - pad - 22}" y="${H - 3}" font-family="Martian Mono, monospace" font-size="11" fill="var(--ink-3)">300</text>
      <text x="${pad + 4}" y="${pad + 4}" font-family="Martian Mono, monospace" font-size="11" fill="var(--ink-3)">100 %</text>`;
  };
  draw(); onLang(draw);
})();

/* ---------------- MTG: clipping the collector market ---------------- */
(function mtg() {
  const box = $('[data-mtg]');
  if (!box) return;
  const data = {
    all: { mae: 3.65, r2: -0.23, price: 3.53 },
    clip: { mae: 1.11, r2: 0.22, price: 2.56 },
  };
  let cur = 'clip';
  const render = () => {
    const d = data[cur];
    const money = (v) => (lang() === 'en' ? '$' + v.toFixed(2) : v.toFixed(2).replace('.', ',') + ' $');
    box.querySelector('[data-mae]').style.width = (d.mae / 4) * 100 + '%';
    box.querySelector('[data-mae-v]').textContent = money(d.mae);
    // R² axis from −0.25 to +0.5; zero at 33.3 %
    const z = 1 / 3, span = 0.75;
    const r = box.querySelector('[data-r2]');
    const x = z + d.r2 / span;
    r.style.left = Math.min(x, z) * 100 + '%';
    r.style.width = Math.abs(d.r2 / span) * 100 + '%';
    r.style.setProperty('--pen', d.r2 < 0 ? 'var(--red)' : '');
    box.querySelector('[data-r2-v]').textContent = fmt(d.r2, { minimumFractionDigits: 2, signDisplay: 'exceptZero' });
    box.querySelector('[data-price]').textContent = money(d.price);
    box.querySelectorAll('[data-mtg-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mtgSet === cur)));
  };
  box.querySelectorAll('[data-mtg-set]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.mtgSet; render(); }));
  render(); onLang(render);
})();

/* ---------------- insult duel (new insults, Monkey Island rules) ---------------- */
(function duel() {
  const box = $('[data-duel]');
  if (!box) return;
  const P = [
    {
      es: ['¡Tu código tiene más warnings que líneas!', 'Por eso compilo con -Werror: ya solo me quedan errores.', 'Y tú más.'],
      en: ['Your code has more warnings than lines!', 'That’s why I build with -Werror: now it’s only errors.', 'So do you.'],
    },
    {
      es: ['¡He visto commits más limpios en un repo de becario!', 'Será porque el becario era yo y firmo con Conventional Commits.', '¡Rebase!'],
      en: ['I’ve seen cleaner commits in an intern’s repo!', 'Because the intern was me, and I sign with Conventional Commits.', 'Rebase!'],
    },
    {
      es: ['¡Tus partidas nunca salen igual dos veces!', 'Pásame la semilla y te la repito tick a tick.', 'Es una feature.'],
      en: ['Your matches never play out the same twice!', 'Give me the seed and I’ll replay it tick by tick.', 'It’s a feature.'],
    },
    {
      es: ['¡Luchas como un singleton: solo puedes con uno a la vez!', 'Y tú escalas como un bucle O(n²).', 'Refactorízame esto.'],
      en: ['You fight like a singleton: only one at a time!', 'And you scale like an O(n²) loop.', 'Refactor this.'],
    },
  ];
  const log = box.querySelector('[data-log]');
  const opts = box.querySelector('[data-opts]');
  const hp = box.querySelector('[data-hp]');
  let round = 0, won = 0, lives = 3;
  // every line is written in both languages; CSS shows the active one, so a
  // language switch never interrupts the duel
  const line = (cls, es, en) => {
    const p = document.createElement('p'); p.className = cls; setBi(p, es, en);
    log.appendChild(p); log.scrollTop = log.scrollHeight;
  };
  const bars = () => {
    hp.innerHTML = Array.from({ length: 3 }, (_, i) => `<i class="${i < lives ? '' : 'off'}"></i>`).join('');
    const sr = document.createElement('span'); sr.className = 'sr-only';
    setBi(sr, `${lives} de 3 vidas`, `${lives} of 3 lives`);
    hp.appendChild(sr);
  };
  const button = (es, en, onclick) => {
    const b = document.createElement('button'); b.type = 'button'; setBi(b, es, en); b.onclick = onclick;
    opts.appendChild(b);
  };
  function ask() {
    const hadFocus = opts.contains(document.activeElement);
    opts.textContent = '';
    if (lives === 0 || round >= P.length) {
      if (lives === 0) line('sys', `> El pirata huye con el orgullo intacto. Ganaste ${won} de ${P.length}.`, `> The pirate flees, pride intact. You won ${won} of ${P.length}.`);
      else line('sys', '> El pirata se rinde. Te ofrece un puesto en su tripulación.', '> The pirate gives up and offers you a spot on his crew.');
      button('Otra vez', 'Again', () => { log.textContent = ''; round = 0; won = 0; lives = 3; bars(); ask(); });
    } else {
      const q = P[round];
      line('pir', 'PIRATA> ' + q.es[0], 'PIRATE> ' + q.en[0]);
      const choices = [[q.es[1], q.en[1], true], [q.es[2], q.en[2], false]];
      if (round % 2) choices.reverse();
      choices.forEach(([es, en, ok]) => button(es, en, () => {
        line('you', 'TÚ> ' + es, 'YOU> ' + en);
        if (ok) { won++; line('sys', '> Touché.', '> Touché.'); }
        else { lives--; line('sys', '> El pirata se ríe. Pierdes una vida.', '> The pirate laughs. You lose a life.'); }
        bars(); round++; ask();
      }));
    }
    if (hadFocus) opts.querySelector('button')?.focus({ preventScroll: true });
  }
  bars(); ask();
})();

/* ---------------- hitbox mode ---------------- */
const hb = $('#hitbox');
hb?.addEventListener('click', () => {
  const on = !root.classList.contains('hitbox');
  root.classList.toggle('hitbox', on);
  hb.setAttribute('aria-pressed', String(on));
});

/* ---------------- page weight, measured, never hard-coded ---------------- */
function weight() {
  const el = $('[data-weight]');
  if (!el || !performance.getEntriesByType) return;
  const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
  let sent = 0, cached = 0;
  for (const e of entries) {
    if (e.transferSize > 0) sent += e.transferSize;
    else if (e.decodedBodySize > 0) cached += e.encodedBodySize || e.decodedBodySize;
  }
  if (!sent && !cached) { el.textContent = ''; return; }
  const kb = (b) => fmt(Math.round(b / 1024));
  setBi(el,
    `Esta visita ha transferido ${kb(sent)} KB hasta ahora${cached ? ` (y ${kb(cached)} KB desde la caché)` : ''}.`,
    `This visit has transferred ${kb(sent)} KB so far${cached ? ` (plus ${kb(cached)} KB from cache)` : ''}.`);
}
window.addEventListener('load', () => setTimeout(weight, 1500));
const wEl = $('[data-weight]');
if (wEl) new IntersectionObserver(([e]) => { if (e.isIntersecting) weight(); }).observe(wEl);

/* ---------------- below-the-fold art: fetch only when near ---------------- */
const nearIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-near'); nearIO.unobserve(e.target); } });
}, { rootMargin: '600px 0px' });
$$('.stage-sapo, .boss__art, .colo, .scan').forEach((el) => nearIO.observe(el));

/* ---------------- the pen: frames, underlines, sliders ---------------- */
// every figure stage and game screen gets its hand-drawn rectangle; it draws
// itself once, the first time it comes into view
// (the frame is clipped while hidden, so the observer watches its box, not the frame)
const drawIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const f = e.target.querySelector(':scope > .ink-frame');
    if (f && !e.target.matches('.u')) f.classList.add('is-drawn'); else e.target.classList.add('is-seen');
    drawIO.unobserve(e.target);
  });
}, { threshold: 0.2 });
$$('.plate__stage, .game__media').forEach((el, i) => {
  inkFrame(el, seedOf((el.closest('[id]')?.id || '') + i), el.matches('.game__media') ? 5 : 7, { w: 2 });
  drawIO.observe(el);
});
// buttons, toggles and framed screenshots get their own hand-drawn box
// the ideas drawn on the computer get a screen, like the screens in his storyboards
$$('.bk--screen .scan__img').forEach((el, i) => inkFrame(el, seedOf('screen' + i), 6, { w: 1.8 }));
$$('.btn, .tgl, .copy, .vid__play, .chip--state, .seg button, .shot, .mtg, .ci').forEach((el, i) => {
  const big = el.matches('.shot, .mtg, .ci');
  inkFrame(el, seedOf((el.textContent || '').trim().slice(0, 24) + i), big ? 6 : 3.5, { w: big ? 1.8 : el.matches('.btn:not(.btn--ghost)') ? 2 : 1.4 });
});
$$('.u').forEach((el) => drawIO.observe(el));
/* numbers written with his own digits (cut from the AVL-tree pages of the notebook) */
$$('[data-hw]').forEach((el) => {
  const txt = el.textContent.trim();
  if (!/^[\d.]+$/.test(txt)) return;
  const hw = document.createElement('span');
  hw.className = 'hw'; hw.setAttribute('aria-hidden', 'true');
  for (const ch of txt) { const i = document.createElement('i'); i.className = ch === '.' ? 'gd' : 'g' + ch; hw.appendChild(i); }
  const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = txt;
  el.textContent = ''; el.append(sr, hw);
});
root.classList.add('js-ok'); // the head script keeps .js only if we got this far
// sliders: the filled part of the track is a biro stroke
const fillRange = (el) => {
  const min = Number(el.min || 0), max = Number(el.max || 100);
  el.style.setProperty('--p', ((Number(el.value) - min) / (max - min)) * 100 + '%');
};
$$('input[type="range"]').forEach((el) => { fillRange(el); el.addEventListener('input', () => fillRange(el)); });

/* ---------------- figures ---------------- */
const figs = {
  voxel: () => import('./fig-voxel.js'),
  scout: () => import('./fig-scout.js'),
  replay: () => import('./fig-replay.js'),
  face: () => import('./fig-face.js'),
  hex: () => import('./fig-hex.js'),
  bytes: () => import('./fig-bytes.js'),
};
function mountFig(el) {
  const kind = el.dataset.fig;
  figs[kind]?.().then((m) => m.mount(el)).catch((err) => {
    console.error(err);
    const ro = el.querySelector('[data-readout]');
    if (ro) setBi(ro, 'No se pudo cargar esta figura.', 'This figure could not load.');
    el.querySelectorAll('button, input, select').forEach((x) => { x.disabled = true; });
  });
}
// DOM-only figures mount at once so the page doesn't grow under an anchor jump;
// the canvas ones wait until they come near the screen.
const EAGER = new Set(['scout', 'face', 'bytes']);
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mountFig(e.target); } });
}, { rootMargin: '600px 0px' });
$$('[data-fig]').forEach((el) => (EAGER.has(el.dataset.fig) ? mountFig(el) : io.observe(el)));
