// 同步：兩支手機（管理員、成員）+ 真後端。離線記帳、被伺服器拒絕、同時改同一筆、同步進行中又編輯、憑證撤銷、大量資料分頁。
import { API, KEY, startWorker, serve, pw, reporter } from './lib.mjs';
await startWorker(); const web = await serve(), { chromium } = await pw(), { ok, finish } = reporter(), APP = web.base + '/index.html';
const api = async (m, p, body, token, key) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(key ? { 'x-setup-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const tid = 'tS' + Date.now().toString(36);
const mk = await api('POST', '/api/trips', { settings: { id: tid, name: '同步測試', adminId: 'm1', members: [{ id: 'm1', name: 'Smile', avatar: '🐬' }, { id: 'm2', name: 'Jiani', avatar: '🌻' }], funds: [{ id: 'f1', name: '公款', avatar: '🍔' }], rates: { EUR: 36.41, TWD: 1 } } }, null, KEY);
let AT = mk.token; const b = await chromium.launch(), errs = [];
const mkPage = async name => { const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 900 } }); await ctx.addInitScript(u => { window.LEDGER_API = u; window.__toasts = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList?.contains('toast') && window.__toasts.push(n.innerText)))).observe(document, { childList: true, subtree: true }); }, API); const p = await ctx.newPage(); p.on('pageerror', e => !/waiting/.test(e.message) && (errs.push(`[${name}] ${e.message}`))); await p.goto(APP); await p.waitForTimeout(500); return p; };
const go = async (p, pg) => { await p.click(`[data-go="${pg}"]`); await p.waitForTimeout(250); };
const text = p => p.evaluate(() => document.body.innerText);
const trigger = p => p.evaluate(() => window.dispatchEvent(new Event('online')));
const serverEntries = async () => (await api('GET', `/api/trips/${tid}/sync?since=0`, null, AT)).entries ?? [];
const idbEntries = p => p.evaluate(tid => new Promise(res => { const r = indexedDB.open('ledger', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('entries:' + tid); q.onsuccess = () => res(q.result ?? []); }; }), tid);
// 同步可能剛好有一趟在跑（App 會略過重疊的同步，下一趟再送），所以「等到條件成立」比固定等待可靠
const until = async (p, pred, get = serverEntries) => { for (let i = 0; i < 16; i++) { await trigger(p); await p.waitForTimeout(450); const es = await get(p); if (pred(es)) return es; } return get(p); };
const closeSheets = p => p.evaluate(() => document.querySelectorAll('.scrim,.layer').forEach(e => e.remove()));
const record = async (p, desc, amt) => { await go(p, 'log'); await p.fill('#d', desc); await p.fill('#m', amt); await p.click('#go'); await p.waitForTimeout(250); };
const editDesc = async (p, from, to) => { await go(p, 'ledger'); await p.click(`.item:has-text("${from}")`); await p.waitForTimeout(300); await p.fill('#ed', to); await p.click('#eok'); await p.waitForTimeout(300); };
const find = (es, d) => es.find(e => e.desc === d);

// ---- 兩支手機就位：管理員用恢復碼找回、成員用邀請碼加入 ----
const A = await mkPage('管理員'); for (let i = 0; i < 5; i++) await A.click('#logo'); await A.fill('#rt', tid); await A.fill('#rk', mk.recoveryCode); await A.click('#rgo2'); await A.waitForTimeout(1200); await closeSheets(A);
const readTok = p => p.evaluate(tid => new Promise(res => { const r = indexedDB.open('ledger', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('dev'); q.onsuccess = () => res(q.result?.cloud?.[tid]?.token); }; }), tid);
for (let i = 0; i < 10; i++) { AT = (await readTok(A)) || AT; if (AT !== mk.token) break; await A.waitForTimeout(200); }
let inv = await api('POST', `/api/trips/${tid}/invites`, { memberId: 'm2' }, AT);
const B = await mkPage('成員'); await B.fill('#wc', inv.code); await B.click('#wgo'); await B.waitForTimeout(1500);
ok('0-1 兩支手機都已就位（管理員、成員）', (await text(B)).includes('這支手機是 Jiani') && (await text(A)).includes('管理員'));

// ===== 1. 離線也能記帳，連線後自動補送 =====
{ await B.context().setOffline(true); await record(B, '離線午餐', '5'); await trigger(B); await B.waitForTimeout(500);
  ok('1-1 離線時紀錄存在手機裡，伺服器還沒有', !find(await serverEntries(), '離線午餐') && !!find(await idbEntries(B), '離線午餐'));
  await go(B, 'set'); const st = await text(B); ok('1-2 設定頁顯示離線與待送筆數', /離線中/.test(st) && /1 筆待送|待送/.test(st), st.match(/雲端[\s\S]{0,60}/)?.[0]);
  await B.context().setOffline(false); const es = await until(B, es => !!find(es, '離線午餐')); ok('1-3 恢復網路後自動補送到伺服器', !!find(es, '離線午餐')); }

// ===== 2. 管理員改過的紀錄，成員離線時改了同一筆 → 被伺服器拒絕，改用管理員的版本 =====
{ await record(B, '共用帳', '10'); await until(B, es => !!find(es, '共用帳')); await until(A, es => !!find(es, '共用帳'), idbEntries);
  await B.context().setOffline(true); await editDesc(A, '共用帳', '管理員改的'); await until(A, es => !!find(es, '管理員改的'));
  await editDesc(B, '共用帳', '成員改的'); ok('2-1 成員離線時改的版本先存在手機', !!find(await idbEntries(B), '成員改的') && !find(await serverEntries(), '成員改的'));
  await B.context().setOffline(false); await B.evaluate(() => { window.__toasts.length = 0; });
  const loc = await until(B, es => !!find(es, '管理員改的') && !find(es, '成員改的'), idbEntries); ok('2-2 成員的手機改用管理員的版本（成員的修改被退回）', !!find(loc, '管理員改的') && !find(loc, '成員改的'));
  ok('2-3 伺服器上保持管理員的版本', !!find(await serverEntries(), '管理員改的') && !find(await serverEntries(), '成員改的'));
  const toasts = await B.evaluate(() => window.__toasts); ok('2-4 有跳出說明原因的提醒（管理員改過這筆）', toasts.some(t => /管理員改過這筆/.test(t)), JSON.stringify(toasts)); }

// ===== 3. 兩支手機都離線、各改同一筆：不管誰先同步，最後都是管理員的版本 =====
for (const [n, order] of [[1, 'BA'], [2, 'AB']]) {
  const d0 = `並行${n}`; await record(B, d0, '3'); await until(B, es => !!find(es, d0)); await until(A, es => !!find(es, d0), idbEntries);
  await A.context().setOffline(true); await B.context().setOffline(true); await editDesc(A, d0, `A版${n}`); await editDesc(B, d0, `B版${n}`);
  for (const who of order) { const P = who === 'A' ? A : B; await P.context().setOffline(false); await until(P, es => !!(find(es, `A版${n}`) || find(es, `B版${n}`)), serverEntries); }
  await until(B, es => !!find(es, `A版${n}`), idbEntries); await until(A, es => !!find(es, `A版${n}`), idbEntries);
  const es = await serverEntries(); ok(`3-${n} ${order === 'BA' ? '成員先同步、管理員後同步' : '管理員先同步、成員後同步'}：最後伺服器是管理員的版本`, !!find(es, `A版${n}`) && !find(es, `B版${n}`), es.filter(e => /並行|[AB]版/.test(e.desc)).map(e => e.desc).join());
  ok(`3-${n}b 兩支手機的內容都和伺服器一致`, !!find(await idbEntries(A), `A版${n}`) && !!find(await idbEntries(B), `A版${n}`) && !find(await idbEntries(B), `B版${n}`)); }

// ===== 4. 同步進行到一半時又編輯：編輯不會被伺服器回傳的舊版本蓋掉 =====
{ await record(B, '飛行中', '7'); await B.route('**/push', async r => { await new Promise(res => setTimeout(res, 2200)); try { await r.continue(); } catch {} }); // 每個送出的請求都延遲 2.2 秒（解除攔截時還在等的請求會被放行，所以要容忍） await trigger(B); await B.waitForTimeout(500);
  await editDesc(B, '飛行中', '飛行中改過'); ok('4-1 編輯當下，同步還在進行', !!find(await idbEntries(B), '飛行中改過'));
  await B.waitForTimeout(2500); ok('4-2 同步結束後，手機上仍是剛編輯的版本（沒有被舊版蓋掉）', !!find(await idbEntries(B), '飛行中改過') && !find(await idbEntries(B), '飛行中'));
  await B.unroute('**/push', { behavior: 'ignoreErrors' }); const es = await until(B, es => !!find(es, '飛行中改過')); ok('4-3 下一輪同步就把編輯送上伺服器', !!find(es, '飛行中改過') && !find(es, '飛行中')); }

// ===== 5. 憑證被撤銷：顯示「憑證失效」 =====
{ const r = await api('POST', `/api/trips/${tid}/revoke`, { memberId: 'm2' }, AT); ok('5-1 管理員撤銷成員的憑證', r.ok === true, JSON.stringify(r));
  await trigger(B); await B.waitForTimeout(1200); await go(B, 'set'); const st = await text(B); ok('5-2 成員的設定頁顯示「憑證失效」', /憑證失效/.test(st), st.match(/雲端[\s\S]{0,60}/)?.[0]); }

// ===== 6. 重新邀請 + 大量資料：新手機加入後，1200 多筆分頁收齊 =====
{ for (let k = 0; k < 3; k++) { const entries = Array.from({ length: 400 }, (_, i) => ({ id: `bulk${k}-${i}`, type: 'expense', desc: `批量${k}-${i}`, minor: 100, cur: 'EUR', rate: '36410000', twdMicro: '36410000', payer: 'm1', shares: ['m1'], wt: {}, method: 'cash', cat: 'food', date: '2026-02-01', author: 'm1', ts: 1 + i, lock: null, notes: '', deleted: false })); const r = await api('POST', `/api/trips/${tid}/push`, { entries }, AT); if (r.accepted?.length !== 400) { ok('6-0 批次灌入資料', false, JSON.stringify(r).slice(0, 200)); } }
  const total = (await serverEntries()).length; ok('6-1 伺服器上共有 1200 多筆', total >= 1200, total);
  inv = await api('POST', `/api/trips/${tid}/invites`, { memberId: 'm2' }, AT); const C = await mkPage('新手機'); await C.fill('#wc', inv.code); await C.click('#wgo'); await C.waitForTimeout(1500);
  const got = await until(C, es => es.length >= total, idbEntries); ok('6-2 新手機分頁把全部紀錄收齊（舊版會漏）', got.length >= total && new Set(got.map(e => e.id)).size === got.length, `${got.length}/${total}`);
  await go(C, 'ledger'); ok('6-3 一千多筆的歷史頁照常顯示', (await text(C)).includes('FOUND')); }
ok('0-2 整個過程沒有頁面錯誤', errs.length === 0, errs.join(' | ')); await b.close(); web.close(); finish('同步測試');
