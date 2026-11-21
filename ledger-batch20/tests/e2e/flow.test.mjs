// 端對端流程：管理員與成員各一支手機（真瀏覽器 + 真後端）。涵蓋：付款人限制、金額輸入、換匯打錯 → 待確認 → 管理員同意、
// 容許範圍設定、成員自己改回合理的值、現金鎖定、以及「把每個畫面的每種按鈕都點一遍」的巡覽。
import { API, KEY, startWorker, serve, pw } from './lib.mjs';
await startWorker(); const web = await serve(); const { chromium } = await pw();
const APP = web.base + '/index.html';
let bad = 0; const ok = (n, c, x = '') => { console.log(c ? '✓' : '✗', n, c ? '' : x); if (!c) bad++; };
const api = async (m, p, body, token, key) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(key ? { 'x-setup-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const touched = new Set(); const tid = 'tE' + Date.now().toString(36);
const mk = await api('POST', '/api/trips', { settings: { id: tid, name: 'E2E', adminId: 'm1', members: [{ id: 'm1', name: 'Smile', avatar: '🐬' }, { id: 'm2', name: 'Jiani', avatar: '🌻' }], funds: [{ id: 'f1', name: '公款', avatar: '🍔' }], rates: { EUR: 36.41, TWD: 1 } } }, null, KEY);
let AT = mk.token; const inv = await api('POST', `/api/trips/${tid}/invites`, { memberId: 'm2' }, AT);
const b = await chromium.launch();
const mkPage = async name => { const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 900 } }); await ctx.addInitScript(u => { window.LEDGER_API = u; }, API); const p = await ctx.newPage(); p.on('response', r => { if (r.status() >= 400 && !/favicon|icon-|ledger-cover/.test(r.url())) { console.log(`[${name}] HTTP ${r.status()} ${r.url()}`); bad++; } }); p.on('pageerror', e => !/waiting/.test(e.message) && (console.log(`[${name}] PAGEERROR`, e.message), bad++)); await p.goto(APP); await p.waitForTimeout(500); return p; };
const sync = async p => { await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(900); };
const go = async (p, page) => { await p.click(`[data-go="${page}"]`); await p.waitForTimeout(250); };
const text = p => p.evaluate(() => document.body.innerText);
// 同步可能剛好有一趟在跑（App 會略過重疊的同步，下一趟再送），所以「等到伺服器真的符合條件」比固定等待可靠
const until = async (p, pred) => { for (let i = 0; i < 14; i++) { await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(450); const es = await serverEntries(); if (pred(es)) return es; } return serverEntries(); };
const serverEntries = async () => (await api('GET', `/api/trips/${tid}/sync?since=0`, null, AT)).entries;

// ---- 管理員：點 5 次 logo → 用恢復碼找回 ----
const A = await mkPage('管理員'); for (let i = 0; i < 5; i++) await A.click('#logo');
await A.fill('#rt', tid); await A.fill('#rk', mk.recoveryCode); await A.click('#rgo2'); await A.waitForTimeout(1200);
ok('管理員已進入旅程', (await A.evaluate(() => !!document.querySelector('#nav button, nav button'))), await text(A));
// 管理員用恢復碼找回後，舊憑證會作廢；從管理員手機的資料庫讀出新憑證，讓測試腳本能直接問伺服器
const readTok = p => p.evaluate(tid => new Promise(res => { const r = indexedDB.open('ledger', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('dev'); q.onsuccess = () => res(q.result?.cloud?.[tid]?.token); }; }), tid);
for (let i = 0; i < 10 && !(AT = (await readTok(A)) || AT) ; i++) await A.waitForTimeout(200); AT = (await readTok(A)) || AT;
const closeSheets = p => p.evaluate(() => document.querySelectorAll('.scrim,.sheet,.layer').forEach(e => e.remove())); await closeSheets(A); 
// ---- 成員：輸入邀請碼 ----
const B = await mkPage('成員'); await B.fill('#wc', inv.code); await B.click('#wgo'); await B.waitForTimeout(1500);
ok('成員已加入旅程', (await text(B)).includes('這支手機是 Jiani'), await text(B)); await go(B, 'log'); await go(A, 'log');

// ---- 1. 付款人只能是自己或公款 ----
const seen = new Set(); for (let i = 0; i < 6; i++) { seen.add(await B.evaluate(() => document.querySelector('[data-a="payer"] b').innerText.trim())); await B.click('[data-a="payer"]'); await B.waitForTimeout(80); }
ok('成員的付款人只會輪流出現「自己」與「公款」', seen.size === 2 && [...seen].some(s => s.includes('Jiani')) && [...seen].some(s => s.includes('公款')) && ![...seen].some(s => s.includes('Smile')), [...seen].join('|'));
const sA = new Set(); for (let i = 0; i < 8; i++) { sA.add(await A.evaluate(() => document.querySelector('[data-a="payer"] b')?.innerText.trim())); await A.click('[data-a="payer"]'); await A.waitForTimeout(80); }
ok('管理員的付款人可以選所有人', sA.size === 3, [...sA].join('|'));

// ---- 2. 金額輸入：四捨五入、科學記號 ----
await B.fill('#d', '午餐'); await B.fill('#m', '12.345'); await B.click('#go'); await B.waitForTimeout(300);
await B.fill('#d', '大額'); await B.fill('#m', '1e3'); await B.click('#go'); await B.waitForTimeout(300);
ok('輸入 1e3 能正常記下（以前會沒反應）', (await B.evaluate(() => document.querySelector('.toast')?.innerText || '')).includes('已記下'), await B.evaluate(() => document.querySelector('.toast')?.innerText));
await B.fill('#d', '亂打'); await B.fill('#m', '-5'); await B.waitForTimeout(100); ok('負數的送出鈕不會亮', await B.evaluate(() => !document.querySelector('#go').classList.contains('on')));
await sync(B); let es = await serverEntries();
const e1 = es.find(e => e.desc === '午餐'), e2 = es.find(e => e.desc === '大額');
ok('12.345 歐元記成 12.35（四捨五入）', e1?.minor === 1235, JSON.stringify(e1?.minor)); ok('1e3 歐元記成 1000.00', e2?.minor === 100000, JSON.stringify(e2?.minor));
ok('一般紀錄沒有被標待確認', !e1?.review && !e2?.review);

// ---- 3. 換匯打錯（台幣多打一個 0）→ 即時提示 + 待確認 ----
await go(B, 'wallet'); const exBtn = await B.$('[data-a="ex"]'); ok('錢包頁有換匯鈕', !!exBtn);
await exBtn.click(); await B.waitForTimeout(300);
const owners = await B.evaluate(() => [...document.querySelectorAll('#xo option')].map(o => o.textContent.trim()));
ok('換匯的「誰換的」只有自己與公款', owners.length === 2 && !owners.some(x => x.includes('Smile')), owners.join('|'));
await B.fill('#xm', '100'); await B.fill('#xt', '36410'); await B.waitForTimeout(150);
const hint = await B.evaluate(() => document.querySelector('#xh').innerText); ok('換匯面板即時提示匯率差太多', /差 \+900/.test(hint) && /管理員確認/.test(hint), hint);
await B.click('#xok'); await B.waitForTimeout(400);
const tst = await B.evaluate(() => document.querySelector('.toast')?.innerText || ''); ok('記下後跳出提醒', /差了/.test(tst) && /管理員同意後才會計入/.test(tst), tst);
await sync(B); es = await serverEntries(); const ex = es.find(e => e.type === 'exchange');
ok('伺服器標了 review=rate', ex?.review === 'rate' && ex?.approved === false, JSON.stringify(ex));
await B.screenshot({ path: '/tmp/shot-member-wallet.png' });
await go(B, 'ledger'); const hist = await text(B); ok('成員的歷史頁顯示「金額差異較大，待管理員確認」', hist.includes('金額差異較大，待管理員確認'), hist.slice(0, 300));
ok('成員看不到管理員用的置頂待確認區', !hist.includes('待你確認'));
await go(B, 'settle'); const st = await text(B); ok('結算頁說明有 1 筆等確認、沒計入', /另有 1 筆等管理員確認/.test(st), st.slice(0, 300));

// ---- 4. 管理員看到待確認 → 同意 ----
await sync(A); await go(A, 'ledger'); const ah = await text(A); ok('管理員歷史頁置頂「待你確認（1）」', ah.includes('待你確認（1）'), ah.slice(0, 400));
await A.click('.day:has-text("待你確認") + .item'); await A.waitForTimeout(300);
const sheetTxt = await A.evaluate(() => document.querySelector('.sheet, .layer')?.innerText || ''); ok('處理面板說明原因並有三個選項', /匯率和參考匯率差了/.test(sheetTxt) && sheetTxt.includes('同意') && sheetTxt.includes('我來改一下') && sheetTxt.includes('刪掉'), sheetTxt);
await A.screenshot({ path: '/tmp/shot-admin-pend.png' });
await A.click('#pa'); await A.waitForTimeout(300); await sync(A); es = await serverEntries(); const ex2 = es.find(e => e.type === 'exchange');
ok('同意後 approved=true、review 消失', ex2?.approved === true && !ex2?.review, JSON.stringify(ex2));
await sync(B); await go(B, 'ledger'); ok('成員這邊也不再待確認', !(await text(B)).includes('待管理員確認'));

// ---- 5. 管理員調整容許範圍 → 同步到伺服器 ----
await go(A, 'set'); await A.fill('[data-tol]', '25'); await A.dispatchEvent('[data-tol]', 'change'); await A.waitForTimeout(300); await sync(A);
const g = await api('GET', `/api/trips/${tid}/sync?since=0`, null, AT); ok('容許範圍 25% 已同步到伺服器', g.settings?.lockTolerance === 25, JSON.stringify(g.settings?.lockTolerance));
await A.fill('[data-tol]', '80'); await A.dispatchEvent('[data-tol]', 'change'); await A.waitForTimeout(300);
ok('填超過 50 會被擋並還原', (await A.inputValue('[data-tol]')) === '25', await A.inputValue('[data-tol]'));
// 成員同步後設定頁看不到這一區
await sync(B); await go(B, 'set'); ok('成員的設定頁沒有容許範圍欄位', (await B.$('[data-tol]')) === null);

// ---- 6. 成員記一般帳之後，歷史/結算沒有壞掉 ----
await go(B, 'settle'); ok('結算頁正常顯示', (await text(B)).includes('誰該付給誰'));

// ---- 7. 成員把被標記的換匯改回正確 → 標記自動消失 ----
await go(B, 'wallet'); await B.click('[data-a="ex"]'); await B.waitForTimeout(250); await B.fill('#xm', '50'); await B.fill('#xt', '18205'); await B.click('#xok'); await B.waitForTimeout(300);
es = await until(B, es => es.some(e => e.type === 'exchange' && e.minor === 5000)); const badEx = es.find(e => e.type === 'exchange' && e.minor === 5000);
ok('又打錯一筆：伺服器標了 rate', badEx?.review === 'rate', JSON.stringify(badEx));
await go(B, 'ledger'); await B.click('.item:has-text("待管理員確認")'); await B.waitForTimeout(300);
ok('成員可以直接點開自己被標記的換匯來改', (await B.evaluate(() => document.querySelector('#xt')?.value)) === '18205', await text(B));
await B.fill('#xt', '1820.5'); await B.click('#xok'); await B.waitForTimeout(300); const fixedToast = await B.evaluate(() => document.querySelector('.toast')?.innerText || '');
ok('改回合理的值，不再跳警告', fixedToast.includes('改好囉'), fixedToast); es = await until(B, es => !es.find(e => e.id === badEx.id)?.review); const okEx = es.find(e => e.id === badEx.id);
ok('伺服器上的 review 自動消失', okEx && !okEx.review && okEx.minor === 5000, JSON.stringify(okEx));

// ---- 8. 現金支出按 🔒 鎖定，台幣金額和參考差太多 → 提醒並待確認 ----
await go(B, 'log'); await B.fill('#d', '現金午餐'); await B.fill('#m', '10'); await B.click('#go'); await B.waitForTimeout(300);
await go(B, 'ledger'); await B.click('.item:has-text("現金午餐")'); await B.waitForTimeout(300); await B.check('#el'); await B.click('#eok'); await B.waitForTimeout(300);
const lockToast = await B.evaluate(() => document.querySelector('.toast')?.innerText || ''); ok('鎖定後差太多：跳出提醒', /台幣金額和「金額×匯率」差了/.test(lockToast) && /管理員同意後才會計入/.test(lockToast), lockToast);
es = await until(B, es => es.find(e => e.desc === '現金午餐')?.review === 'lock'); const lk = es.find(e => e.desc === '現金午餐'); ok('伺服器標了 review=lock', lk?.review === 'lock' && !!lk?.lock, JSON.stringify(lk));
await go(B, 'ledger'); await B.click('.item:has-text("現金午餐")'); await B.waitForTimeout(300);
const editTxt = await B.evaluate(() => document.querySelector('.sheet, .layer')?.innerText || ''); ok('編輯面板頂端有警示說明', /台幣金額和「金額×匯率」差了/.test(editTxt) && /改回合理的值就會自動恢復/.test(editTxt), editTxt.slice(0, 200));
await B.uncheck('#el'); await B.click('#eok'); await B.waitForTimeout(300); es = await until(B, es => !es.find(e => e.desc === '現金午餐')?.review); const lk2 = es.find(e => e.desc === '現金午餐'); ok('取消鎖定後，標記消失', lk2 && !lk2.review && !lk2.lock, JSON.stringify(lk2));

// ---- 9. 巡覽：每個畫面的每種按鈕都點一遍，確認所有面板都打得開、沒有任何錯誤 ----
{
  const ATTRS = ['a', 'inv', 'rvk', 'pp', 'cc', 'bud', 'wx', 'mc', 'hf', 'edit', 'cat', 'k', 'dup'], SKIP = /^(detach)$/; // 不點會真的刪除或離開雲端的（data-del、detach）
  for (const [who, P] of [['管理員', A], ['成員', B]]) {
    for (const pg of ['log', 'ledger', 'wallet', 'settle', 'set']) {
      await go(P, pg);
      const pairs = await P.evaluate(attrs => { const out = []; for (const at of attrs) { const seen = new Set(); document.querySelectorAll(`#app [data-${at}]`).forEach(e => { const v = e.getAttribute('data-' + at); if (!seen.has(v) && out.length < 80) { seen.add(v); out.push([at, v]); } }); } return out; }, ATTRS);
      for (const [at, v] of pairs) {
        if (at === 'a' && SKIP.test(v)) continue;
        await go(P, pg); const before = bad; await P.click(`#app [data-${at}="${v}"]`, { timeout: 2500 }).catch(() => {}); await P.waitForTimeout(120);
        const opened = await P.evaluate(() => !!document.querySelector('.scrim')); const vis = await P.evaluate(() => (document.body.innerText.match(/<\/?(div|button|span|svg|label|select|option|input|small|h1|h2|path)\b[^>]{0,40}>?/) || [])[0]); if (vis) { console.log(`✗ 畫面上出現看得到的標籤文字：${vis}（${who}/${pg}/data-${at}=${v}）`); bad++; } await closeSheets(P);
        if (bad > before) console.log(`  ↳ 剛才點的是 ${who}/${pg}/data-${at}=${v}`); touched.add(`${who}/${pg}/${at}=${v}${opened ? '(面板)' : ''}`);
      }
    }
  }
  const panels = [...touched].filter(x => x.endsWith('(面板)')).length;
  ok(`巡覽完成：點了 ${touched.size} 個按鈕（其中 ${panels} 個打開了面板），沒有出現任何錯誤`, touched.size > 40 && panels > 8, `${touched.size}/${panels}`);
}
await b.close(); console.log(bad ? `\n✗ ${bad} 項失敗` : '\n✓ 實機流程全部通過'); process.exit(bad ? 1 : 0);
