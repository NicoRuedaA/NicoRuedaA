// FIG. 4 — Sports Face: the project's own face-model.js + renderer.js (GPL-2.0),
// imported unchanged. The page only wires an input to createProfile().
import { createProfile, ageProfile, formatFaceCode, getFaceValues, IDENTITY_VARS } from '../vendor/face-model.js';
import { renderFace } from '../vendor/renderer.js';
import { onLang, t } from './core.js';

const EN = {
  head: 'Head shape', skin: 'Skin tone', eyes: 'Eyes', brows: 'Brows', nose: 'Nose', mouth: 'Mouth',
  freckles: 'Freckles', eyeColor: 'Eye colour', earShape: 'Ears', jaw: 'Jaw', faceProportion: 'Proportion',
};

export function mount(fig) {
  const canvas = fig.querySelector('canvas');
  const input = fig.querySelector('#face-name');
  const codeEl = fig.querySelector('[data-code]');
  const bitsEl = fig.querySelector('[data-bits]');
  const legendEl = fig.querySelector('[data-bits-legend]');
  const say = fig.querySelector('[data-face-say]');
  const minus = fig.querySelector('[data-age="-5"]');
  const plus = fig.querySelector('[data-age="5"]');
  let age = 24;

  function render() {
    const name = (input.value || '').slice(0, 64) || 'Nico Rueda';
    // same identity and appearance draw; only the age moves (ageProfile keeps both bit words)
    const profile = ageProfile(createProfile({ seed: name, age: 24, presentation: 'neutral' }), age - 24);
    renderFace(canvas, profile, { showAge: false });
    codeEl.textContent = formatFaceCode(profile);
    const values = getFaceValues(profile);
    bitsEl.textContent = '';
    for (const v of IDENTITY_VARS) {
      const s = document.createElement('span');
      s.style.setProperty('--w', v.length);
      s.style.setProperty('--v', Math.round((values[v.key] / Math.max(1, v.validValues - 1)) * 85 + 10));
      s.title = `${t(v.label, EN[v.key] || v.key)}: ${values[v.key]}`;
      bitsEl.appendChild(s);
    }
    legendEl.textContent = t(
      `identityBits · 11 rasgos en 29 bits · edad ${profile.age} (cambia la apariencia, no la identidad)`,
      `identityBits · 11 traits in 29 bits · age ${profile.age} (changes appearance, not identity)`,
    );
    canvas.setAttribute('aria-label', t(`Retrato generado para «${name}», ${profile.age} años`, `Portrait generated for “${name}”, age ${profile.age}`));
    minus.disabled = age <= 16;
    plus.disabled = age >= 60;
    return profile;
  }

  let timer = 0;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 60); });
  fig.querySelectorAll('[data-age]').forEach((b) => b.addEventListener('click', () => {
    age = Math.max(16, Math.min(60, age + Number(b.dataset.age)));
    const profile = render();
    if (say) say.textContent = t(`Retrato actualizado: ${profile.age} años. La identidad no cambia.`, `Portrait updated: age ${profile.age}. The identity does not change.`);
  }));
  onLang(render);
  render();
}
