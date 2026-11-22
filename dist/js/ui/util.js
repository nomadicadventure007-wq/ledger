import { toMinor } from '../core/money.js';
import { IMAGES } from '../core/model.js';
import { S, people } from '../state.js';

export const $ = s => document.querySelector(s), app = $('#app');
export const mn = (s, c) => { try { return Number(toMinor(s, c)); } catch { return 0; } };
export const warnReview = note => toast('⚠️ ' + note + '。先記下，管理員同意後才會計入', undefined, undefined, 6500);
export const who = id => { const p = people().find(x => x.id === id) || { name: '?', avatar: '❓' }; return { ...p, avatar: p.img ? html`<img class="av" src="${p.img}" alt="">` : p.avatar }; };
export const ic = (slot, emoji) => { const src = (slot.startsWith('cat-') && S.trip?.catImg?.[slot.slice(4)]) || IMAGES[slot]; return src ? html`<span class="ic"><img src="${src}" alt=""></span>` : html`<span class="ic">${emoji}</span>`; };
export const today = () => new Date().toLocaleDateString('sv');
import { html, raw, esc, setHtml } from '../core/html.js';
export { html, raw, esc, setHtml };
export const sheet = content => { const o = document.createElement('div'); o.className = 'scrim'; setHtml(o, html`<div class="sheet" role="dialog" aria-modal="true" tabindex="-1">${content}</div>`); document.body.append(o); o.onclick = e => { if (e.target === o) o.remove(); }; o.querySelector('.sheet').focus({ preventScroll: true }); return o; };
export const opts = (arr, sel) => html`${arr.map(([v, t]) => html`<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`)}`;
export const fmtT = t => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const standalone = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
export function copyBtn(o, sel, text) { o.querySelector(sel).onclick = async () => { try { await navigator.clipboard.writeText(text); toast('已複製 📋'); } catch { toast('請長按選取複製'); } }; }
export const okPath = t => /^(img\/|\.\/img\/|https:\/\/)[\w\-./%~+]+$/i.test(t);
export const shrinkPng = file => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const m = Math.min(96 / im.width, 96 / im.height), w = im.width * m, h = im.height * m; c.getContext('2d').drawImage(im, (96 - w) / 2, (96 - h) / 2, w, h); res(c.toDataURL('image/png')); }; im.src = URL.createObjectURL(file); });
export async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); try { document.execCommand('copy'); } catch {} a.remove(); } toast('已複製 📋'); }
export const shrink = file => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const m = Math.min(im.width, im.height); c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 96, 96); res(c.toDataURL('image/jpeg', .72)); }; im.src = URL.createObjectURL(file); });
export function toast(msg, undo, label = '復原', ms) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); setHtml(t, html`${msg}${undo ? html` <button>${label}</button>` : ''}`); document.body.append(t);
  if (undo) t.querySelector('button').onclick = () => { undo(); t.remove(); };
  setTimeout(() => t.remove(), ms ?? (undo ? 4000 : 1400));
}
