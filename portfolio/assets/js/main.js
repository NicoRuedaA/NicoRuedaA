import { theme, lang, onTheme, onLang, reducedMotion, fmt, t } from './core.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};

/* ---------------- theme: Boceto (light) / Motor (dark) ---------------- */
function syncTheme() {
  const cur = theme();
  $$('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === cur)));
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  meta.forEach((m) => m.setAttribute('content', cur === 'dark' ? '#0a0c10' : '#e3e7ec'));
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
  // attributes that can't hold two <span lang> children
  $$('[data-aria-es]').forEach((el) => el.setAttribute('aria-label', cur === 'en' ? el.dataset.ariaEn : el.dataset.ariaEs));
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
function openMenu() {
  menu.hidden = false;
  document.body.style.overflow = 'hidden';
  closeBtn.focus();
}
function closeMenu(focusBack = true) {
  menu.hidden = true;
  document.body.style.overflow = '';
  if (focusBack) openBtn.focus();
}
openBtn?.addEventListener('click', openMenu);
closeBtn?.addEventListener('click', () => closeMenu());
menu?.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(false); });
menu?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
  if (e.key === 'Tab') {
    const f = $$('a, button', menu).filter((x) => x.offsetParent !== null);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

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
$$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  const text = b.dataset.copy;
  const done = () => {
    const prev = b.innerHTML;
    b.textContent = t('Copiado', 'Copied');
    setTimeout(() => { b.innerHTML = prev; }, 1600);
  };
  try { await navigator.clipboard.writeText(text); done(); }
  catch (e) {
    const link = b.previousElementSibling;
    if (link) {
      const r = document.createRange(); r.selectNodeContents(link);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    b.textContent = t('Selecciónalo y copia', 'Select and copy');
  }
}));

/* ---------------- click-to-play videos (nothing downloads until asked) ---------------- */
$$('[data-video]').forEach((btn) => btn.addEventListener('click', () => {
  const box = btn.closest('.vid');
  let v = box.querySelector('video');
  if (!v) {
    v = document.createElement('video');
    v.src = btn.dataset.video;
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('aria-label', btn.textContent.trim());
    box.appendChild(v);
  }
  if (v.paused) { v.play().catch(() => {}); box.classList.add('is-playing'); btn.querySelector('[aria-hidden]').textContent = '❚❚'; }
  else { v.pause(); box.classList.remove('is-playing'); btn.querySelector('[aria-hidden]').textContent = '▶'; }
}));

/* ---------------- sprite strips (frog idle: 4 frames @ 400 ms, as in the game) ---------------- */
$$('[data-sprite]').forEach((el) => {
  const n = Number(el.dataset.sprite), ms = Number(el.dataset.ms || 150);
  let i = 0, timer = 0;
  const step = () => { i = (i + 1) % n; el.style.backgroundPosition = `${(i / (n - 1)) * 100}% 0`; };
  new IntersectionObserver(([e]) => {
    clearInterval(timer);
    if (e.isIntersecting && !reducedMotion()) timer = setInterval(step, ms);
  }).observe(el);
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
    const code = box.querySelector('code');
    code.textContent = t('daño = bruto × 100 / (100 + armadura)', 'damage = raw × 100 / (100 + armour)');
    svg.innerHTML = `
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--rule)"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H - pad}" stroke="var(--rule)"/>
      <path d="${d}" fill="none" stroke="var(--ally)" stroke-width="2"/>
      <line x1="${X(100)}" y1="${Y(0.5)}" x2="${X(100)}" y2="${H - pad}" stroke="var(--marker)" stroke-dasharray="3 3"/>
      <circle cx="${X(100)}" cy="${Y(0.5)}" r="3.5" fill="var(--marker)"/>
      <text x="${X(100) + 6}" y="${Y(0.5) - 6}" font-family="Martian Mono, monospace" font-size="9" fill="var(--ink-2)">${t('100 de armadura → 50 %', '100 armour → 50%')}</text>
      <text x="${pad}" y="${H - 4}" font-family="Martian Mono, monospace" font-size="8" fill="var(--ink-3)">0</text>
      <text x="${W - pad - 16}" y="${H - 4}" font-family="Martian Mono, monospace" font-size="8" fill="var(--ink-3)">300</text>
      <text x="${pad + 4}" y="${pad + 2}" font-family="Martian Mono, monospace" font-size="8" fill="var(--ink-3)">100 %</text>`;
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
    r.style.background = d.r2 < 0 ? 'var(--rival)' : 'var(--ally)';
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
  const line = (cls, txt) => { const p = document.createElement('p'); p.className = cls; p.textContent = txt; log.appendChild(p); log.scrollTop = log.scrollHeight; };
  const bars = () => { hp.innerHTML = Array.from({ length: 3 }, (_, i) => `<i class="${i < lives ? '' : 'off'}"></i>`).join(''); };
  function ask() {
    opts.textContent = '';
    if (lives === 0 || round >= P.length) {
      line('sys', lives === 0 ? t(`> El pirata huye con el orgullo intacto. Ganaste ${won} de ${P.length}.`, `> The pirate flees, pride intact. You won ${won} of ${P.length}.`)
        : t('> El pirata se rinde. Te ofrece un puesto en su tripulación.', '> The pirate gives up and offers you a spot on his crew.'));
      const again = document.createElement('button'); again.type = 'button';
      again.textContent = t('Otra vez', 'Again');
      again.onclick = () => { log.textContent = ''; round = 0; won = 0; lives = 3; bars(); ask(); };
      opts.appendChild(again);
      return;
    }
    const q = P[round][lang()];
    line('pir', 'PIRATA> ' + q[0]);
    const choices = [q[1], q[2]].map((txt, i) => ({ txt, ok: i === 0 }));
    if ((round * 7) % 2) choices.reverse();
    choices.forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = c.txt;
      b.onclick = () => {
        line('you', t('TÚ> ', 'YOU> ') + c.txt);
        if (c.ok) { won++; line('sys', t('> Touché.', '> Touché.')); }
        else { lives--; line('sys', t('> El pirata se ríe. Pierdes una vida.', '> The pirate laughs. You lose a life.')); }
        bars(); round++; ask();
      };
      opts.appendChild(b);
    });
  }
  bars(); ask();
  onLang(() => { log.textContent = ''; round = 0; won = 0; lives = 3; bars(); ask(); });
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
  const bytes = entries.reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0);
  if (!bytes) { el.textContent = ''; return; }
  el.textContent = t(`Esta visita ha transferido ${fmt(Math.round(bytes / 1024))} KB hasta ahora.`, `This visit has transferred ${fmt(Math.round(bytes / 1024))} KB so far.`);
}
window.addEventListener('load', () => setTimeout(weight, 1500));
onLang(weight);

/* ---------------- figures: mounted only when they come near the screen ---------------- */
const figs = {
  voxel: () => import('./fig-voxel.js'),
  scout: () => import('./fig-scout.js'),
  replay: () => import('./fig-replay.js'),
  face: () => import('./fig-face.js'),
  hex: () => import('./fig-hex.js'),
  bytes: () => import('./fig-bytes.js'),
};
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const kind = e.target.dataset.fig;
    figs[kind]?.().then((m) => m.mount(e.target)).catch((err) => {
      console.error(err);
      const ro = e.target.querySelector('[data-readout]');
      if (ro) ro.textContent = t('No se pudo cargar esta figura.', 'This figure could not load.');
    });
  });
}, { rootMargin: '600px 0px' });
$$('[data-fig]').forEach((el) => io.observe(el));
