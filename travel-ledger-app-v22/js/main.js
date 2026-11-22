import { replay } from './core/wallet.js';
import { load, save } from './core/store.js';
import { newTrip, uid } from './core/model.js';
import { A, callAdmin, initAdmin } from './features/admin.js';
import { fixDates } from './features/dates.js';
import { persist, syncNow } from './features/sync.js';
import { cleanupLeftover, switchTrip } from './features/trips.js';
import { DENY, S, counted, isAdmin, resetForm, quarantine, loadEntries } from './state.js';
import { act } from './ui/actions.js';
import { NAV, nav } from './ui/nav.js';
import { HF, hfLen, renderLedger } from './ui/pages/ledger.js';
import { dupToForm, renderLog } from './ui/pages/log.js';
import { renderSet } from './ui/pages/settings.js';
import { copyTransfers, renderSettle } from './ui/pages/settle.js';
import { renderWallet } from './ui/pages/wallet.js';
import { renderWelcome } from './ui/pages/welcome.js';
import { hooks, render } from './ui/render.js';
import { del, editSheet } from './ui/sheets/edit.js';
import { chkSheet } from './ui/sheets/money.js';
import { app, toast, html, setHtml } from './ui/util.js';
import { installErrorHandlers, showCrash } from './ui/errors.js';

const soon = n => html`<h1>${n}</h1><div class="empty">這一頁會在後續版本加入</div>`;
function renderPage() { document.body.classList.toggle('wel', !!S.trip.ph); if (S.trip.ph) return renderWelcome(); S.rp = replay(counted()); nav(); const v = { log: renderLog, ledger: renderLedger, wallet: renderWallet, settle: renderSettle, set: renderSet }[S.page]; if (v) v(); else setHtml(app, soon(NAV.find(n => n[0] === S.page)[1])); }
// 畫面出錯時改顯示說明卡（不整頁空白）；格式壞掉的紀錄先隔離，不讓它們參與計算與畫面
function renderNow() { try { const keep = quarantine(S.entries); if (keep !== S.entries) S.entries = keep; renderPage(); } catch (err) { showCrash(err); } }
hooks.render = renderNow; // 把真正的實作交給 ui/render.js 的接縫
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go],[data-a],[data-cat],[data-del],[data-edit],[data-pay],[data-sel],[data-pp],[data-cc],[data-trip],[data-chk],[data-bud],[data-wx],[data-hf],[data-inv],[data-rvk],[data-cptr],[data-dup],[data-mc]'); if (!b) return;
  if (b.dataset.go) { S.page = b.dataset.go; render(); } else if (b.dataset.a) act(b.dataset.a);
  else if (b.dataset.cat) { S.f.cat = b.dataset.cat; navigator.vibrate?.(10); renderLog(); } else if (b.dataset.mc) { S.myCat = S.myCat === b.dataset.mc ? null : b.dataset.mc; renderSettle(); } else if (b.dataset.cptr) copyTransfers(b.dataset.cptr); else if (b.dataset.dup) dupToForm(b.dataset.dup); else if (b.dataset.inv) callAdmin('inviteSheet', b.dataset.inv); else if (b.dataset.rvk) callAdmin('rvkSheet', b.dataset.rvk); else if (b.dataset.wx) { S.wx = S.wx === b.dataset.wx ? null : b.dataset.wx; renderWallet(); } else if (b.dataset.hf) { const h = S.hf, k = b.dataset.hf; if (k === 'reset') { HF.forEach(x => h[x] = 0); h.start = h.end = h.q = ''; } else h[k] = (h[k] + 1) % hfLen()[k]; renderLedger(); } else if (b.dataset.chk) chkSheet(b.dataset.chk); else if (b.dataset.bud !== undefined) callAdmin('budSheet'); else if (b.dataset.pp !== undefined) callAdmin('personSheet', ...b.dataset.pp.split('|')); else if (b.dataset.cc !== undefined) callAdmin('catSheet', b.dataset.cc); else if (b.dataset.trip) { b.dataset.trip === S.trip.id ? (isAdmin() ? callAdmin('tripSheet', b.dataset.trip) : toast(DENY)) : switchTrip(b.dataset.trip); } else if (b.dataset.pay) callAdmin('pay', ...b.dataset.pay.split('|')); else if (b.dataset.sel !== undefined) { S.sel = b.dataset.sel || null; render(); } else if (b.dataset.edit) editSheet(b.dataset.edit); else del(b.dataset.del);
});
document.addEventListener('change', e => { A.onChange?.(e.target); }); // 匯率、容許範圍、代誰操作：只有管理員功能包載入後才有人處理
// 按 Esc 關閉最上面的面板（鍵盤使用者）
// 全螢幕層（進階）用它自己的「取消」鈕收尾（還原畫面與捲動）；一般面板直接移除
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const top = [...document.querySelectorAll('.scrim,.layer')].at(-1); if (!top) return; if (top.classList.contains('layer')) top.querySelector('#lx')?.click(); else top.remove(); });
installErrorHandlers();
(async () => { try {
  let db = await load('db', null);
  if (!db) { const old = await load('trip', null); if (old) { db = { trips: [old], cur: old.id }; await save('entries:' + old.id, await load('entries', [])); } else { const t = newTrip(); t.ph = true; db = { trips: [t], cur: t.id }; } }
  S.db = db; S.trip = db.trips.find(t => t.id === db.cur) || db.trips[0]; S.entries = await loadEntries(S.trip.id);
  S.dev = await load('dev', null) || { id: 'd' + uid(), seq: 0 }; S.dev.meBy ||= {}; S.dev.sqBy ||= {}; S.dev.syncs ||= {}; if (typeof S.dev.me === 'string') { S.dev.meBy[S.trip.id] = S.dev.me; delete S.dev.me; }
  S.dev.ownerBy ||= {}; S.dev.cloud ||= {}; for (const t of S.db.trips) S.dev.ownerBy[t.id] ??= S.dev.meBy[t.id] ?? t.adminId;
  await initAdmin(); await cleanupLeftover(); fixDates(); resetForm(); render(); syncNow();
  addEventListener('online', () => syncNow()); document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow()); setInterval(() => document.visibilityState === 'visible' && syncNow(), 30000);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (!reg) return;
      const ask = w => toast('有新版本 ✨', () => w.postMessage('skip'), '更新', 60000);
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); }); });
    }).catch(() => {}); // 註冊失敗（無痕模式等）不影響使用，不要當成錯誤提醒
    let rl; const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !rl) { rl = 1; location.reload(); } });
  }
} catch (err) { showCrash(err); } })();
