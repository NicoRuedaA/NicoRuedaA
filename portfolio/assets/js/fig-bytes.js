// FIG. 6 — Viu Manacor's photo gate: an image is saved only if its first bytes
// carry a real JPEG or PNG signature (fetch_photos.py → SIGNATURES). Same rule, in JS.
import { onLang, t } from './core.js';

const SIGNATURES = [
  [[0xff, 0xd8, 0xff], 'jpg'],
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'png'],
];
const SAMPLES = {
  jpg: { name: 'cafe-sa-placa.jpg', bytes: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01] },
  png: { name: 'forn-logo.png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d] },
  svg: { name: 'botiga.jpg', bytes: [...new TextEncoder().encode('<svg xmlns="h')] },
};

export function mount(fig) {
  const hexEl = fig.querySelector('[data-hex]');
  const stamp = fig.querySelector('[data-stamp]');
  const why = fig.querySelector('[data-why]');
  const drop = fig.querySelector('[data-drop]');
  const file = fig.querySelector('[data-file]');
  const btns = [...fig.querySelectorAll('[data-sample]')];
  let last = null;

  function check(name, bytes) {
    last = { name, bytes };
    const hit = SIGNATURES.find(([sig]) => sig.every((b, i) => bytes[i] === b));
    const sigLen = hit ? hit[0].length : 0;
    hexEl.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'label'; head.style.marginBottom = '4px'; head.textContent = name;
    hexEl.appendChild(head);
    bytes.slice(0, 12).forEach((b, i) => {
      const s = document.createElement('span');
      s.textContent = b.toString(16).toUpperCase().padStart(2, '0');
      if (hit && i < sigLen) s.className = 'm';
      if (!hit && i < 3) s.className = 'x';
      hexEl.append(s, document.createTextNode(' '));
    });
    const ascii = bytes.slice(0, 12).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
    const a = document.createElement('div'); a.className = 'label'; a.style.marginTop = '4px'; a.textContent = ascii;
    hexEl.appendChild(a);
    stamp.hidden = false;
    stamp.className = 'stamp ' + (hit ? 'ok' : 'no');
    stamp.textContent = hit ? t('Guardada', 'Saved') : t('Rechazada', 'Rejected');
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (hit) {
      why.textContent = t(`Empieza por la firma de un ${hit[1].toUpperCase()}: se guarda como .${hit[1]}, diga lo que diga la extensión.`,
        `It starts with a ${hit[1].toUpperCase()} signature: saved as .${hit[1]}, whatever the extension says.`);
    } else {
      const isSvg = ascii.trim().startsWith('<svg') || ascii.trim().startsWith('<?xml');
      why.textContent = isSvg
        ? t(`Se llama .${ext}, pero dentro hay un SVG. Así se rompieron doce fotos en producción.`, `It is called .${ext}, but there is an SVG inside. That is how twelve photos broke in production.`)
        : t('No empieza por la firma de un JPEG ni de un PNG, así que no se guarda.', 'It does not start with a JPEG or PNG signature, so it is not saved.');
    }
  }

  btns.forEach((b) => b.addEventListener('click', () => {
    const s = SAMPLES[b.dataset.sample];
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    check(s.name, s.bytes);
  }));
  async function readFile(f) {
    if (!f) return;
    const buf = new Uint8Array(await f.slice(0, 16).arrayBuffer());
    btns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
    check(f.name.slice(0, 40), [...buf]);
  }
  file.addEventListener('change', () => readFile(file.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => readFile(e.dataTransfer.files[0]));
  onLang(() => last && check(last.name, last.bytes));

  // open on the case that caused the rule
  btns[2].setAttribute('aria-pressed', 'true');
  check(SAMPLES.svg.name, SAMPLES.svg.bytes);
}
