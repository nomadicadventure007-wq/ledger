import { cloudApi } from '../core/cloud.js';
import { load, save } from '../core/store.js';
import { S } from '../state.js';
import { render } from '../ui/render.js';
import { sheet, toast, html } from '../ui/util.js';

export const ADMIN_API = 1;
export const A = {};
const KEY = 'adminpkg', base = new URL('../../', import.meta.url).href;
let pkg = null;

export const adminReady = () => !!A.api;
export const needsAdmin = () => !!S.db && S.db.trips.some(t => !t.ph && S.dev.ownerBy[t.id] === t.adminId);
export const slot = (name, ...args) => { try { return A[name]?.(...args) ?? ''; } catch (e) { console.error(e); return ''; } };
export function callAdmin(name, ...args) {
  if (A[name]) return A[name](...args);
  if (S.adm || needsAdmin()) unlockSheet(() => A[name]?.(...args));
}
export const openHelp = () => callAdmin('helpSheet', pkg?.files?.['help/admin.html']);

const blobUrl = code => URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
export async function install(p, make = blobUrl, root = base) {
  if (p.api !== ADMIN_API) throw new Error('管理功能版本和 App 不合');
  const urls = {}, visit = (f, stack = []) => {
    if (urls[f]) return; if (stack.includes(f)) throw new Error('功能包有循環引用：' + f); if (!(f in p.files)) throw new Error('功能包缺檔案：' + f);
    for (const m of p.files[f].matchAll(/__ADM__\/([\w./-]+\.js)/g)) visit(m[1], [...stack, f]);
    urls[f] = make(p.files[f].replaceAll('__APP__/', root).replace(/__ADM__\/([\w./-]+\.js)/g, (_, d) => urls[d]));
  };
  visit('index.js');
  const mod = (await import(urls['index.js'])).default; if (mod?.api !== ADMIN_API) throw new Error('管理功能版本和 App 不合');
  for (const k of Object.keys(A)) delete A[k]; Object.assign(A, mod); pkg = p;
  for (const u of Object.values(urls)) try { URL.revokeObjectURL(u); } catch {}
}
async function fromCache() { const c = await load(KEY, null); if (!c?.files) return false; try { await install(c); return true; } catch (e) { console.warn('管理功能快取無法使用', e); return false; } }
async function fetchPkg(auth) {
  const r = await cloudApi('POST', '/api/admin-pkg', { v: pkg?.v }, auth.token, auth.key);
  if (r.error) return r; if (r.same) return { ok: true, same: true };
  if (r.api !== ADMIN_API) return { error: '管理功能和這個 App 版本不合，請把 App 關掉重開（或更新）' };
  try { await install(r); } catch (e) { return { error: '管理功能載入失敗：' + e.message }; }
  await save(KEY, r); return { ok: true };
}
export const unlock = async key => { const r = await fetchPkg({ key }); if (r.ok) startAdmin(); return r; };
async function refresh() { const t = S.db.trips.find(t => !t.ph && S.dev.ownerBy[t.id] === t.adminId && S.dev.cloud[t.id]?.token); return t ? fetchPkg({ token: S.dev.cloud[t.id].token }) : { error: 'no-token' }; }
let started = false; const startAdmin = () => { if (!started) { started = true; A.onStart?.(); } };
export async function initAdmin() {
  if (!needsAdmin()) { if (S.db.trips.some(t => !t.ph) && await load(KEY, null)) await save(KEY, null); return; }
  const ok = await fromCache(); if (ok) startAdmin();
  refresh().then(r => { if (r.ok && !r.same) { startAdmin(); render(); } else if (!ok && !r.ok && r.error !== '連不上伺服器') setTimeout(() => adminReady() || toast('🔒', () => unlockSheet(), '🔑', 8000), 1200); }).catch(() => {});
}
export function unlockSheet(then) {
  const o = sheet(html`<h2>🔑</h2><label><input id="uk" type="password" autocomplete="off" aria-label="🔑"></label><button class="save on" id="ugo">→</button>`);
  const go = async () => { const key = o.querySelector('#uk').value; if (!key) return; o.querySelector('#ugo').disabled = true; const r = await unlock(key); if (r.error) { o.querySelector('#ugo').disabled = false; return toast('⚠️ ' + r.error); } o.remove(); toast('✓'); if (then) then(); else render(); };
  o.querySelector('#ugo').onclick = go; o.querySelector('#uk').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
}
export const lockedCard = () => html`<button class="pay" data-a="unlock">🔑</button>`;
