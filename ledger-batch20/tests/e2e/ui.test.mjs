// 外觀與無障礙：封面（有圖／沒圖／裁切／動畫）、圖示與 manifest、字型、鍵盤與螢幕閱讀器相關屬性。
import { writeFileSync } from 'node:fs'; import path from 'node:path'; import { stat } from 'node:fs/promises';
import { ROOT, serve, appCopy, pw, reporter, pixels } from './lib.mjs';
import { T, NOW, trip, entries, dev } from './fixture.mjs';
const { ok, finish } = reporter(), { chromium } = await pw(), b = await chromium.launch(), errs = [];
const open = async (base, opts = {}) => { const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 900 }, ...opts }), p = await ctx.newPage(); p.on('pageerror', e => !/waiting/.test(e.message) && errs.push(e.message)); await p.goto(base + '/index.html'); await p.waitForTimeout(900); return p; };

// ===== 1. 沒有封面圖：顯示放大的 🐬 =====
{ const s = await serve(appCopy({ cover: false })), p = await open(s.base);
  const info = await p.evaluate(() => { const c = document.querySelector('#logo'), fb = c.querySelector('.cover-fb'), r = c.getBoundingClientRect(), cs = getComputedStyle(c), o = getComputedStyle(c.querySelector('.orbit')); return { fallback: c.classList.contains('fallback'), fbShown: getComputedStyle(fb).display !== 'none', fbSize: parseFloat(getComputedStyle(fb).fontSize), imgHidden: getComputedStyle(c.querySelector('img')).display === 'none', w: r.width, h: r.height, radius: cs.borderTopLeftRadius, orbitAnim: o.animationName, orbitDur: o.animationDuration, orbitStyle: o.borderTopStyle, title: document.querySelector('h1').innerText }; });
  ok('1-1 沒有圖時自動改顯示 🐬，圖片被隱藏', info.fallback && info.fbShown && info.imgHidden, JSON.stringify(info)); ok('1-2 🐬 放大到圓圈的 6 成以上', info.fbSize >= info.w * 0.55, `${info.fbSize} / ${info.w}`);
  ok('1-3 外框是正圓形（寬＝高、圓角 50%）', Math.abs(info.w - info.h) < 1 && (info.radius.includes('%') || parseFloat(info.radius) >= info.w / 2 - 1), JSON.stringify(info));
  ok('1-4 有虛線軌道，緩慢旋轉（40 秒一圈）', info.orbitStyle === 'dashed' && info.orbitAnim === 'orbit' && info.orbitDur === '40s', JSON.stringify(info)); ok('1-5 標題是「哆啦記帳」', info.title === '哆啦記帳', info.title);
  for (let i = 0; i < 5; i++) await p.click('#logo'); await p.waitForTimeout(300); ok('1-6 連點五下封面，管理者入口出現', !!(await p.$('#rt')) && !!(await p.$('#rk')));
  const p2 = await open(s.base, { reducedMotion: 'reduce' }); ok('1-7 開啟「減少動態效果」時軌道不轉', (await p2.evaluate(() => getComputedStyle(document.querySelector('.orbit')).animationName)) === 'none'); s.close(); }

// ===== 2. 專案裡附的封面圖：載得到、不是後備 =====
{ const s = await serve(), p = await open(s.base);
  const i = await p.evaluate(() => { const c = document.querySelector('#logo'), im = c.querySelector('img'); return { fallback: c.classList.contains('fallback'), nat: [im.naturalWidth, im.naturalHeight] }; });
  ok('2-1 專案附的封面圖（img/ledger-cover.webp）有載入，沒有退回 🐬', !i.fallback && i.nat[0] === 512 && i.nat[1] === 512, JSON.stringify(i)); s.close(); }

// ===== 3. 長方形的封面圖：被裁成圓形、置中、填滿 =====
{ const dir = appCopy({ cover: false }), tmp = await (await b.newContext()).newPage();
  const url = await tmp.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 500; const g = c.getContext('2d'); g.fillStyle = '#28a05a'; g.fillRect(0, 0, 800, 500); g.fillStyle = '#fac828'; for (let x = 0; x < 800; x += 80) g.fillRect(x, 0, 40, 500); g.fillStyle = '#ff00ff'; g.fillRect(350, 200, 100, 100); return c.toDataURL('image/webp', 0.9); }); // 左右是條紋、正中央是洋紅方塊
  writeFileSync(path.join(dir, 'img/ledger-cover.webp'), Buffer.from(url.split(',')[1], 'base64'));
  const s = await serve(dir), p = await open(s.base);
  const info = await p.evaluate(() => { const c = document.querySelector('#logo'), i = c.querySelector('img'), r = i.getBoundingClientRect(), cs = getComputedStyle(i); return { fallback: c.classList.contains('fallback'), nat: [i.naturalWidth, i.naturalHeight], w: r.width, h: r.height, fit: cs.objectFit, ptr: cs.pointerEvents, alt: i.alt }; });
  ok('3-1 有圖時直接顯示圖，不是 🐬', !info.fallback && info.nat[0] === 800 && info.nat[1] === 500, JSON.stringify(info)); ok('3-2 長方形的圖被裁成正方形（填滿、置中）', Math.abs(info.w - info.h) < 1 && info.fit === 'cover', JSON.stringify(info));
  ok('3-3 圖片本身不接收點擊（點擊交給外層），而且是裝飾用（alt 空白）', info.ptr === 'none' && info.alt === '');
  await p.waitForTimeout(300); const el = await p.$('#logo'), bb = await el.boundingBox(), png = await el.screenshot(), [center, corner] = await pixels(tmp, png, [[Math.round(bb.width / 2), Math.round(bb.height / 2)], [8, 8]]);
  ok('3-4 正中央是圖片正中央的標記色（置中裁切）', center[0] > 230 && center[1] < 40 && center[2] > 230, JSON.stringify(center));
  ok('3-5 四個角落不是圖片（被圓形裁掉了）', !(corner[0] > 230 && corner[2] < 80) && !(corner[1] > 130 && corner[0] < 80 && corner[2] < 120), JSON.stringify(corner));
  for (let i = 0; i < 5; i++) await p.click('#logo'); await p.waitForTimeout(300); ok('3-6 有圖時連點五下一樣打得開管理者入口', !!(await p.$('#rt'))); s.close(); }

// ===== 4. 圖示、manifest、字型、頁首 =====
{ const s = await serve(), p = await open(s.base);
  const man = await (await fetch(s.base + '/manifest.json')).json(); ok('4-1 manifest 名稱統一為「哆啦記帳」', man.name === '哆啦記帳' && man.short_name === '哆啦記帳', JSON.stringify([man.name, man.short_name]));
  const urls = [...man.icons.map(i => i.src), 'apple-touch-icon.png', 'icon-192.png', 'img/ledger-cover.webp', 'fonts/iansui-sub.woff2']; const codes = await Promise.all(urls.map(async u => (await fetch(s.base + '/' + u)).status)); ok('4-2 manifest 與首頁引用的圖示、封面、字型全部存在', codes.every(c => c === 200), JSON.stringify(Object.fromEntries(urls.map((u, i) => [u, codes[i]]))));
  ok('4-3 有 maskable 圖示', man.icons.some(i => i.purpose === 'maskable'));
  const head = await p.evaluate(() => ({ themes: [...document.querySelectorAll('meta[name=theme-color]')].map(m => [m.content, m.media]), preload: !!document.querySelector('link[rel=preload][as=font][href$=".woff2"]'), main: !!document.querySelector('main#app'), navLabel: document.querySelector('nav#nav')?.getAttribute('aria-label'), lang: document.documentElement.lang, font: document.fonts.check('16px Iansui') }));
  ok('4-4 淺色／深色模式各有一個狀態列顏色，且淺色與 manifest 一致', head.themes.length === 2 && head.themes[0][0] === man.theme_color && head.themes.some(t => /dark/.test(t[1])), JSON.stringify(head.themes)); ok('4-5 字型預先載入、已成功載入（woff2）', head.preload && head.font, JSON.stringify(head)); ok('4-6 主要區域與導覽列有標示', head.main && head.navLabel === '主選單' && head.lang === 'zh-TW', JSON.stringify(head));
  ok('4-7 字型檔小於 1.7 MB', (await stat(path.join(ROOT, 'fonts/iansui-sub.woff2'))).size < 1.7e6);
  const fontHas = await p.evaluate(async () => { await document.fonts.load('20px Iansui', '哆'); const c = document.createElement('canvas').getContext('2d'); c.font = '40px Iansui'; const a = c.measureText('哆').width; c.font = '40px serif'; return { iansui: a, check: document.fonts.check('20px Iansui', '哆') }; }); ok('4-8 字型有「哆」（App 名稱的第一個字）', fontHas.check, JSON.stringify(fontHas));
  for (const f of ['help/user.html', 'help/admin.html']) { const t = await (await fetch(s.base + '/' + f)).text(); ok(`4-9 ${f} 不向外部網站載入字型（離線也能用）`, !/googleapis|gstatic/.test(t) && /fonts\/iansui-sub\.woff2/.test(t)); }
  s.close(); }

// ===== 5. 無障礙：進入旅程後 =====
{ const s = await serve(), ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 900 } }), p = await ctx.newPage(); p.on('pageerror', e => !/waiting/.test(e.message) && errs.push(e.message)); await p.clock.setFixedTime(new Date(NOW));
  await p.goto(s.base + '/__seed__'); await p.evaluate(async ([db, devv, ents, T]) => { await new Promise((res, rej) => { const r = indexedDB.open('ledger', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'), st = tx.objectStore('kv'); st.put(db, 'db'); st.put(devv, 'dev'); st.put(ents, 'entries:' + T); tx.oncomplete = res; tx.onerror = rej; }; r.onerror = rej; }); }, [{ trips: [trip], cur: T }, dev('m1'), entries.filter(e => !/<|onerror/.test(JSON.stringify(e.cur))), T]);
  await p.goto(s.base + '/index.html'); await p.waitForTimeout(3300); await p.evaluate(() => document.querySelectorAll('.scrim,.toast').forEach(e => e.remove()));
  const cur = await p.evaluate(() => [...document.querySelectorAll('#nav button')].map(b => b.getAttribute('aria-current'))); ok('5-1 導覽列只有目前這一頁標示 aria-current="page"', cur.filter(x => x === 'page').length === 1 && cur.filter(x => x === 'false').length === cur.length - 1, JSON.stringify(cur));
  ok('5-2 記帳頁的輸入框有標籤', (await p.evaluate(() => [document.querySelector('#d').getAttribute('aria-label'), document.querySelector('#m').getAttribute('aria-label')])).join() === '品項,金額');
  await p.click('[data-go="wallet"]'); await p.waitForTimeout(200); await p.click('[data-a="ex"]'); await p.waitForTimeout(250);
  const dlg = await p.evaluate(() => { const s = document.querySelector('.sheet'); return { role: s?.getAttribute('role'), modal: s?.getAttribute('aria-modal'), focused: !!s && (document.activeElement === s || s.contains(document.activeElement)) }; }); ok('5-3 面板有 dialog 角色、是 modal，而且焦點移進面板', dlg.role === 'dialog' && dlg.modal === 'true' && dlg.focused, JSON.stringify(dlg));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); ok('5-4 按 Esc 關閉面板（面板真的存在過）', dlg.role === 'dialog' && !(await p.$('.scrim')));
  await p.click('[data-go="log"]'); await p.waitForTimeout(200); await p.click('[data-a="adv"]'); await p.waitForTimeout(250);
  const lay = await p.evaluate(() => { const l = document.querySelector('.layer'); return { role: l?.getAttribute('role'), modal: l?.getAttribute('aria-modal'), label: l?.getAttribute('aria-label'), focused: document.activeElement === l, ov: document.body.style.overflow }; }); ok('5-5「進階」全螢幕層也有 dialog 角色、名稱、焦點', lay.role === 'dialog' && lay.modal === 'true' && lay.label === '進階設定' && lay.focused && lay.ov === 'hidden', JSON.stringify(lay));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); ok('5-6 Esc 關閉「進階」，並還原捲動', !(await p.$('.layer')) && (await p.evaluate(() => document.body.style.overflow)) === '');
  await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press('Tab'); let focusInfo = null; for (let i = 0; i < 14 && !focusInfo; i++) { const x = await p.evaluate(() => { const a = document.activeElement; return a?.id === 'd' ? { w: getComputedStyle(a).outlineWidth, st: getComputedStyle(a).outlineStyle } : null; }); if (x) focusInfo = x; else await p.keyboard.press('Tab'); }
  ok('5-7 用鍵盤停在輸入框時看得到焦點外框', focusInfo && focusInfo.st === 'solid' && parseFloat(focusInfo.w) >= 2, JSON.stringify(focusInfo));
  await p.click('[data-go="set"]'); await p.waitForTimeout(250); const rate = await p.evaluate(() => [...document.querySelectorAll('input[data-rate]')].map(i => i.getAttribute('aria-label'))); ok('5-8 設定頁的匯率輸入框有標籤（例如「EUR 的匯率」）', rate.length > 0 && rate.every(x => /的匯率$/.test(x)), JSON.stringify(rate)); s.close(); }
ok('0-1 整個過程沒有頁面錯誤', errs.length === 0, errs.join(' | ')); await b.close(); finish('外觀與無障礙測試');
