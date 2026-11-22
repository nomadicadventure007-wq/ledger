class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = t => String(t).replace(/[&<>"']/g, c => ESC[c]);
export const raw = s => new Safe(String(s));
const piece = v => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(piece).join('') : esc(v));
export const html = (strs, ...vals) => new Safe(strs.reduce((o, s, i) => o + s + (i < vals.length ? piece(vals[i]) : ''), ''));
export const setHtml = (el, v) => { el.innerHTML = piece(v); return el; };
