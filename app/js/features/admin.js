// 管理員功能的「接縫」。
// 這個公開的 App 裡完全沒有管理員專用的程式碼（成員管理、邀請碼、備份、CSV、結清、管理者說明…）。
// 它們放在後端，只有通過驗證的管理員才下載得到，下載後存在管理員自己的手機（離線也能用）。
// 成員的手機上，下面的 A 永遠是空的，所以那些畫面與按鈕根本不存在。
import { cloudApi } from '../core/cloud.js';
import { load, save } from '../core/store.js';
import { S } from '../state.js';
import { render } from '../ui/render.js';
import { sheet, toast, html } from '../ui/util.js';

export const ADMIN_API = 1; // 要和後端 worker/tools/build-admin.mjs 的 API 一致
export const A = {};        // 載入後由管理員功能包填入
const KEY = 'adminpkg', base = new URL('../../', import.meta.url).href; // base = App 的根網址（以 / 結尾）
let pkg = null;

export const adminReady = () => !!A.api;
// 這支手機有沒有「自己是管理員」的旅程（還沒加入前的空白旅程不算）
export const needsAdmin = () => !!S.db && S.db.trips.some(t => !t.ph && S.dev.ownerBy[t.id] === t.adminId);
// 放在畫面上的「位置」：還沒載入、或不是管理員，就是空的
export const slot = (name, ...args) => { try { return A[name]?.(...args) ?? ''; } catch (e) { console.error(e); return ''; } };
export function callAdmin(name, ...args) {
  if (A[name]) return A[name](...args);
  if (S.adm || needsAdmin()) unlockSheet(() => A[name]?.(...args));
}
export const openHelp = () => callAdmin('helpSheet', pkg?.files?.['help/admin.html']);

// 把功能包裡的每個 .js 轉成暫時網址再載入：指到 App 的 import 換成 App 的真實網址（和 App 共用同一份模組），指到彼此的換成暫時網址
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
// 向後端要功能包。auth = { key } 用建立金鑰、或 { token } 用管理員憑證。沒變就不重載。
async function fetchPkg(auth) {
  const r = await cloudApi('POST', '/api/admin-pkg', { v: pkg?.v }, auth.token, auth.key);
  if (r.error) return r; if (r.same) return { ok: true, same: true };
  if (r.api !== ADMIN_API) return { error: '管理功能和這個 App 版本不合，請把 App 關掉重開（或更新）' };
  try { await install(r); } catch (e) { return { error: '管理功能載入失敗：' + e.message }; }
  await save(KEY, r); return { ok: true };
}
export const unlock = async key => { const r = await fetchPkg({ key }); if (r.ok) startAdmin(); return r; };
// 用這支手機上、管理員身分的雲端憑證（有的話）安靜地更新
async function refresh() { const t = S.db.trips.find(t => !t.ph && S.dev.ownerBy[t.id] === t.adminId && S.dev.cloud[t.id]?.token); return t ? fetchPkg({ token: S.dev.cloud[t.id].token }) : { error: 'no-token' }; }
let started = false; const startAdmin = () => { if (!started) { started = true; A.onStart?.(); } };
// App 啟動時（畫面出來之前）呼叫：先用手機裡的快取，馬上可用；背景再看有沒有新版
export async function initAdmin() {
  if (!needsAdmin()) return; const ok = await fromCache(); if (ok) startAdmin();
  refresh().then(r => { if (r.ok && !r.same) { startAdmin(); render(); } else if (!ok && !r.ok && r.error !== '連不上伺服器') setTimeout(() => adminReady() || toast('🔒 管理功能還沒解鎖', () => unlockSheet(), '解鎖', 8000), 1200); }).catch(() => {});
}
// 解鎖面板：輸入建立金鑰（SETUP_KEY）。金鑰只用這一次，不會存在手機裡
export function unlockSheet(then) {
  const o = sheet(html`<h2>🔓 解鎖管理功能</h2><label>建立金鑰<input id="uk" type="password" autocomplete="off"></label><small>只有管理員需要。解鎖後，管理功能會存在這支手機，之後不用再輸入。</small><button class="save on" id="ugo">解鎖</button>`);
  const go = async () => { const key = o.querySelector('#uk').value; if (!key) return; o.querySelector('#ugo').disabled = true; const r = await unlock(key); if (r.error) { o.querySelector('#ugo').disabled = false; return toast('⚠️ ' + r.error); } o.remove(); toast('已解鎖 🔓'); if (then) then(); else render(); };
  o.querySelector('#ugo').onclick = go; o.querySelector('#uk').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
}
// 設定頁在「是管理員、但功能包還沒載入」時顯示的小卡
export const lockedCard = () => html`<div class="day">管理</div><button class="pay" data-a="unlock">🔓 解鎖管理功能</button>`;
