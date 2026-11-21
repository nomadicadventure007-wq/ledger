// 加固：壞紀錄隔離、畫面崩潰時的說明卡、漏接的錯誤只提醒一次、啟動失敗時的說明卡。
import { serve, pw } from './lib.mjs';
import { T, NOW, trip, entries, dev } from './fixture.mjs';
const srv = await serve(), { chromium } = await pw(), base = srv.base, b = await chromium.launch(); let bad = 0; const ok = (n, c, x = '') => { console.log(c ? '✓' : '✗', n, c ? '' : x); if (!c) bad++; };
// 不該出現在正常資料裡的壞紀錄（每一種都是真的會讓舊版崩潰的寫法）
const BAD = [{ id: 'bad1', type: 'expense', desc: '缺分攤', minor: 1000, cur: 'EUR', rate: '36410000', twdMicro: '364100000', payer: 'm1', date: '2026-02-01' }, { id: 'bad2', type: 'expense', desc: '匯率亂碼', minor: 1000, cur: 'EUR', rate: 'abc', twdMicro: '1', payer: 'm1', shares: ['m1'], method: 'cash', date: '2026-02-01' }, { id: 'bad3', type: 'gift', date: '2026-02-01' }, { id: 'bad4', type: 'settle', from: 'm1', twdMicro: '100', date: '2026-02-01' }, { id: 'bad5', type: 'expense', desc: '金額是字串', minor: '1000', cur: 'EUR', rate: '1', twdMicro: '1', payer: 'm1', shares: ['m1'], date: '2026-02-01' }, null, { id: 'bad7', type: 'exchange', owner: 'm1', cur: 'EUR', minor: 0, rate: '36410000', twdMicro: '1', date: '2026-02-01' }];
async function open(seed, { dbOverride, realTime } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 900 } }), page = await ctx.newPage(), errs = [];
  await page.addInitScript(() => { window.__xss = undefined; window.__toasts = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList?.contains('toast') && window.__toasts.push(n.innerText)))).observe(document, { childList: true, subtree: true }); }); // 記錄所有跳出過的提醒 if (!realTime) await page.clock.setFixedTime(new Date(NOW)); page.on('pageerror', e => !/waiting/.test(e.message) && errs.push(e.message)); page.on('dialog', d => d.dismiss());
  await page.goto(base + '/__seed__');
  await page.evaluate(async ([db, devv, ents, T]) => { await new Promise((res, rej) => { const r = indexedDB.open('ledger', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'), s = tx.objectStore('kv'); s.put(db, 'db'); s.put(devv, 'dev'); s.put(ents, 'entries:' + T); tx.oncomplete = res; tx.onerror = rej; }; r.onerror = rej; }); }, [dbOverride ?? { trips: [trip], cur: T }, dev('m1'), seed, T]);
  await page.goto(base + '/index.html'); await page.waitForTimeout(3300); await page.evaluate(() => document.querySelectorAll('.scrim,.toast').forEach(e => e.remove())); return { page, errs, ctx };
}
const idb = (page, key) => page.evaluate(k => new Promise(res => { const r = indexedDB.open('ledger', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); }; }), key);
const go = async (p, pg) => { await p.click(`[data-go="${pg}"]`); await p.waitForTimeout(250); };

// ===== 1. 壞紀錄隔離：舊版載入這些資料會整頁崩潰 =====
{ const { page, errs } = await open([...entries.filter(e => !/<|onerror/.test(JSON.stringify(e.cur))), ...BAD]);
  ok('1-1 帶著 7 筆壞紀錄啟動，沒有任何錯誤', errs.length === 0, errs.join(' | '));
  for (const pg of ['log', 'ledger', 'wallet', 'settle', 'set']) { await go(page, pg); }
  ok('1-2 五個頁面都畫得出來', errs.length === 0 && !(await page.evaluate(() => !!document.querySelector('.crash'))), errs.join(' | '));
  await go(page, 'set'); const w = await page.evaluate(() => document.querySelector('.warn')?.innerText || ''); ok('1-3 設定頁提醒有 7 筆壞資料', /有 7 筆資料格式壞掉/.test(w), w);
  await page.click('[data-a="bad"]'); await page.waitForTimeout(200); const sh = await page.evaluate(() => document.querySelector('.sheet')?.innerText || ''); ok('1-4 「查看」面板列出壞紀錄與原因', sh.includes('缺分攤') && sh.includes('分攤對象不對') && sh.includes('匯率不對') && sh.includes('類型不明'), sh.slice(0, 200));
  const saved = await idb(page, 'bad:' + T), ents = await idb(page, 'entries:' + T);
  ok('1-5 壞紀錄另外保管在手機裡（沒有被刪掉）', saved?.length === 7 && saved.some(x => x.e?.desc === '缺分攤'), JSON.stringify(saved?.length));
  ok('1-6 正常的紀錄資料庫裡不再混有壞紀錄', ents.every(e => e && !String(e.id).startsWith('bad')) && ents.length === entries.filter(e => !/<|onerror/.test(JSON.stringify(e.cur))).length, ents.length);
  await page.click('#bx'); await page.waitForTimeout(250); ok('1-7 按「清除這份清單」後提醒消失', !(await page.evaluate(() => document.body.innerText.includes('格式壞掉'))) && (await idb(page, 'bad:' + T)).length === 0);
  ok('1-8 結算頁數字仍可算出（沒有被壞紀錄影響）', (await page.evaluate(async () => { document.querySelector('[data-go="settle"]').click(); await new Promise(r => setTimeout(r, 250)); return document.body.innerText; })).includes('誰該付給誰'));
  ok('1-9 沒有任何攻擊被執行', (await page.evaluate(() => window.__xss)) === undefined); }

// ===== 2. 某一頁畫不出來 → 說明卡，不是整頁空白 =====
{ const { page, errs } = await open(entries.filter(e => !/<|onerror/.test(JSON.stringify(e.cur))));
  await page.evaluate(() => { window.__orig = Number.prototype.toLocaleString; Number.prototype.toLocaleString = function () { throw new Error('模擬：這一頁壞掉了'); }; });
  await go(page, 'ledger'); const crash = await page.evaluate(() => document.querySelector('.crash')?.innerText || '');
  ok('2-1 這一頁壞掉時顯示說明卡', crash.includes('這一頁出了點問題') && crash.includes('資料都還在') && crash.includes('模擬：這一頁壞掉了'), crash);
  ok('2-2 下方導覽列還在，可以切換', (await page.evaluate(() => !!document.querySelector('#nav button'))));
  await page.evaluate(() => { Number.prototype.toLocaleString = window.__orig; }); await page.click('#cr-home'); await page.waitForTimeout(300);
  ok('2-3 問題排除後，按「回到記帳頁」恢復正常', await page.evaluate(() => !!document.querySelector('#d') && !document.querySelector('.crash')));
  await go(page, 'ledger'); ok('2-4 之後的頁面也都正常', (await page.evaluate(() => document.body.innerText)).includes('FOUND')); }

// ===== 3. 漏接的錯誤（事件處理、非同步）→ 提醒一次、記下來，不會一直跳 =====
{ const { page } = await open(entries.filter(e => !/<|onerror/.test(JSON.stringify(e.cur))), { realTime: true });
  await page.waitForTimeout(4200); const seen = await page.evaluate(() => { const s = [...window.__toasts]; document.querySelectorAll('.toast').forEach(e => e.remove()); return s; });
  await page.evaluate(() => { setTimeout(() => { throw new Error('模擬：漏接的錯誤 A'); }); Promise.reject(new Error('模擬：漏接的非同步錯誤 B')); setTimeout(() => { throw new Error('模擬：漏接的錯誤 C'); }, 50); }); await page.waitForTimeout(400);
  const t = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.innerText)); ok('3-0 啟動時不會誤報（service worker 被封鎖也不算錯誤）', !seen.some(x => /小狀況/.test(x)), JSON.stringify(seen));
  ok('3-1 跳出提醒，而且只跳一次', t.length === 1 && /小狀況/.test(t[0]) && /資料沒有遺失/.test(t[0]), JSON.stringify(t)); }

// ===== 4. 啟動就失敗（資料庫內容損毀）→ 說明卡，不是空白 =====
{ const { page } = await open([], { dbOverride: { trips: 'oops', cur: T } });
  const t = await page.evaluate(() => document.querySelector('.crash')?.innerText || document.body.innerText); ok('4-1 啟動失敗時顯示說明卡與「重新整理」', t.includes('這一頁出了點問題') && !!(await page.$('#cr-reload')), t.slice(0, 120)); }
await b.close(); srv.close(); console.log(bad ? `\n✗ ${bad} 項失敗` : '\n✓ 加固實機測試全部通過'); process.exit(bad ? 1 : 0);
