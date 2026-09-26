// FIG. 1 — Manager of Legends' scouting knowledge, ported line by line from
// engine/mobamanager_core/src/scouting_knowledge.rs (Rust) to JavaScript.
import { onLang, t } from './core.js';

const UNSCOUTED_MARGIN = 18;

// starting_margin(judging_ability)
function startingMargin(a) {
  if (a >= 80) return 8;
  if (a >= 60) return 11;
  if (a >= 40) return 14;
  return UNSCOUTED_MARGIN;
}
// margin_floor(judging_potential)
function marginFloor(p) {
  if (p >= 85) return 0;
  if (p >= 70) return 2;
  if (p >= 50) return 4;
  return 7;
}
// margin_after(ability, potential, days): halves every fortnight, stops at the floor
function marginAfter(a, p, days) {
  const narrowed = Math.round(startingMargin(a) * Math.pow(0.5, days / 14));
  return Math.max(narrowed, marginFloor(p));
}
// record_day() only ever narrows, starting from UNSCOUTED_MARGIN
function marginFor(a, p, days) {
  if (days <= 0) return UNSCOUTED_MARGIN;
  let m = UNSCOUTED_MARGIN;
  for (let d = 1; d <= days; d++) m = Math.min(m, marginAfter(a, p, d));
  return m;
}
// offset(player_id, attribute, margin): FNV-1a 32-bit, stable displacement in [-m, +m]
function offset(playerId, attrId, margin) {
  if (margin === 0) return 0;
  let hash = 2166136261 >>> 0;
  const bytes = new TextEncoder().encode(playerId + attrId);
  for (const b of bytes) { hash ^= b; hash = Math.imul(hash, 16777619) >>> 0; }
  const span = margin * 2 + 1;
  return (hash % span) - margin;
}
// attribute_range(): the band always contains the real value
function attributeRange(playerId, attrId, real, margin) {
  if (margin === 0) return [real, real];
  const centre = real + offset(playerId, attrId, margin);
  const clamp = (v) => Math.min(99, Math.max(1, v));
  const low = clamp(centre - margin), high = clamp(centre + margin);
  return [Math.min(low, real), Math.max(high, real)];
}

// A fictional rival. Attribute ids are TrainableAttribute::as_id(); labels are the game's own ES/EN strings.
const PLAYER = 'vanta';
const ATTRS = [
  ['Mechanics', 'Mecánicas', 'Mechanics', 82],
  ['Laning', 'Laning', 'Laning', 74],
  ['Teamfighting', 'Teamfighting', 'Teamfighting', 88],
  ['MacroPlay', 'Macro', 'Macro', 61],
  ['Consistency', 'Consistencia', 'Consistency', 70],
  ['Shotcalling', 'Shotcalling', 'Shotcalling', 55],
  ['ChampionPool', 'Champion Pool', 'Champion Pool', 77],
  ['Discipline', 'Disciplina', 'Discipline', 66],
  ['MentalResilience', 'Resiliencia mental', 'Mental Resilience', 79],
];

export function mount(fig) {
  const box = fig.querySelector('[data-scout]');
  const rowsEl = box.querySelector('[data-rows]');
  const marginEl = box.querySelector('[data-margin]');
  const daysEl = box.querySelector('[data-days]');
  const daysIn = fig.querySelector('#scout-days');
  const qBtns = [...fig.querySelectorAll('[data-scout-q] [data-q]')];
  let q = (qBtns.find((b) => b.getAttribute('aria-pressed') === 'true') || qBtns[1]).dataset.q;
  const realBtn = fig.querySelector('#scout-real');

  const rows = ATTRS.map(([id, es, en, real]) => {
    const row = document.createElement('div');
    row.className = 'scout__row';
    row.innerHTML = `<span class="nm"></span><span class="scout__track"><span class="scout__band"></span><span class="scout__real"></span></span><span class="scout__val"></span>`;
    rowsEl.appendChild(row);
    return { id, es, en, real, row, nm: row.querySelector('.nm'), band: row.querySelector('.scout__band'), mark: row.querySelector('.scout__real'), val: row.querySelector('.scout__val') };
  });

  const pos = (v) => ((v - 1) / 98) * 100;

  function render() {
    const days = Number(daysIn.value);
    const [a, p] = q.split(',').map(Number);
    const showReal = box.classList.contains('show-real');
    const m = marginFor(a, p, days);
    marginEl.textContent = m === 0 ? t('exacto', 'exact') : '±' + m;
    daysEl.textContent = days;
    daysIn.setAttribute('aria-valuetext', t(`${days} días de ojeo, margen ±${m}`, `${days} scouting days, margin ±${m}`));
    for (const r of rows) {
      const [lo, hi] = attributeRange(PLAYER, r.id, r.real, m);
      r.nm.textContent = t(r.es, r.en);
      r.band.style.left = pos(lo) + '%';
      r.band.style.width = `max(3px, ${pos(hi) - pos(lo)}%)`;
      r.mark.style.left = pos(r.real) + '%';
      r.val.textContent = (lo === hi ? String(lo) : `${lo}–${hi}`) + (showReal && lo !== hi ? ` · ${r.real}` : '');
    }
  }
  daysIn.addEventListener('input', render);
  qBtns.forEach((b) => b.addEventListener('click', () => {
    q = b.dataset.q;
    qBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  realBtn.addEventListener('click', () => {
    const on = !box.classList.contains('show-real');
    box.classList.toggle('show-real', on);
    realBtn.setAttribute('aria-pressed', String(on));
    render();
  });
  onLang(render);
  render();
}
