import { toMinor, toMicro, twdMicro, showTwd, showAmt, dec } from './core/money.js';
import { load, save } from './core/store.js';
import { cloudApi } from './core/cloud.js';
import { merge, fingerprint, gaps, isPending, dupIds, FMT } from './core/sync.js';
import { settle } from './core/settle.js';
import { replay } from './core/wallet.js';
import { newTrip, uid, CATS, IMAGES } from './core/model.js';

const S = { page: 'log', trip: null, entries: [], dev: null, f: { desc: '', amt: '', cur: 'EUR', payer: 'm1', shares: ['m1'], method: 'cash', cat: 'food' } };
const $ = s => document.querySelector(s), app = $('#app');
const people = () => [...S.trip.members, ...S.trip.funds];
const cats = () => S.trip.cats || CATS, me = () => S.dev.meBy[S.trip.id] ?? owner(), owner = () => S.dev.ownerBy[S.trip.id] ?? S.dev.meBy[S.trip.id] ?? S.trip.adminId, isAdmin = () => owner() === S.trip.adminId, can = e => isAdmin() || e.author === me(), DENY = '這個只有管理員能改 🔒';
const who = id => { const p = people().find(x => x.id === id) || { name: '?', avatar: '❓' }; return { ...p, avatar: p.img ? `<img class="av" src="${p.img}" alt="">` : p.avatar }; };
const resetForm = () => { S.f = { desc: '', amt: '', cur: Object.keys(S.trip.rates)[0], payer: me(), shares: [me()], method: 'cash', cat: cats()[0][0], note: '', pin: '' }; };
const ic = (slot, emoji) => { const src = (slot.startsWith('cat-') && S.trip?.catImg?.[slot.slice(4)]) || IMAGES[slot]; return src ? `<span class="ic"><img src="${src}" alt=""></span>` : `<span class="ic">${emoji}</span>`; };
const today = () => new Date().toLocaleDateString('sv');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const saveAll = () => Promise.all([save('db', S.db), save('entries:' + S.trip.id, S.entries), save('dev', S.dev)]);
const persist = () => { scheduleSync(); return saveAll(); };

const NAV = [['log', '記帳', '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>'], ['wallet', '錢包', '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'],
  ['settle', '我的', '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'], ['ledger', '歷史', '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'],
  ['set', '設定', '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>']];
const SVG = { banknote: '<svg viewBox="0 0 24 24"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>', chev: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>' };
function nav() { $('#nav').innerHTML = NAV.map(([k, n, p]) => `<button class="${S.page === k ? 'on' : ''}" data-go="${k}"><svg viewBox="0 0 24 24">${p}</svg>${n}</button>`).join(''); }

function summary() {
  const f = S.f, rate = S.trip.rates[f.cur], m = S.trip.members.length;
  const sh = f.shares.length === 1 && f.shares[0] === f.payer ? 'Solo' : f.shares.length >= m && !f.shares.some(x => x[0] === 'f') ? 'All' : f.shares[0]?.[0] === 'f' ? 'Shared' : f.shares.length + ' 人';
  return { sh, text: `${(f.date || today()).slice(5).replace('-', '/')}，${who(f.payer).name} 付，${f.shares.map(i => who(i).avatar).join('')} 分攤`, sub: `${f.method === 'cash' ? '現金' : '信用卡'}，${f.cur} @${rate}${+f.amt > 0 ? ' · ≈ NT$ ' + showTwd(estTwd()) : ''}` };
}
function estTwd() {
  try { const f = S.f, minor = Number(toMinor(f.amt, f.cur)), rate = String(toMicro(S.trip.rates[f.cur])), t = { id: 'tmp', type: 'expense', method: f.method, payer: f.payer, cur: f.cur, minor, rate, date: f.date || today(), ts: Date.now(), shares: [], deleted: false };
    return replay([...counted(), t]).by.tmp?.twdMicro ?? twdMicro(minor, f.cur, rate); } catch { return 0n; }
}
function recentHtml() {
  const rc = S.entries.filter(e => !e.deleted && ['expense', 'exchange'].includes(e.type)).slice(0, 8);
  if (!rc.length) return '<div class="empty" style="padding:28px 0">這裡會顯示最近記的幾筆<br>先到「錢包」換一筆匯，再開始記帳吧</div>';
  return '<div class="recent"><div class="day">最近記的</div>' + rc.map(e => { const ex = e.type === 'exchange', c = ex ? null : cats().find(x => x[0] === e.cat) || cats().at(-1);
    return `<div class="item" data-edit="${e.id}">${ex ? ic('cat-exchange', '💱') : ic('cat-' + c[0], c[1])}<div class="t"><div>${ex ? '換匯 ' + e.cur : (e.minor < 0 ? '↩︎ ' : '') + esc(e.desc)}</div><small>${who(ex ? e.owner : e.payer).avatar} ${e.date.slice(5).replace('-', '/')}</small></div><div class="a">${e.cur} ${showAmt(e.minor, e.cur)}</div>${ex ? '' : `<button class="del dup" data-dup="${e.id}" aria-label="複製這筆">⎘</button>`}<button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button></div>`; }).join('') + '</div>';
}
function renderLog() {
  if (!cats().some(c => c[0] === S.f.cat)) S.f.cat = cats()[0][0];
  const f = S.f, s = summary(), ok = f.desc.trim() && +f.amt > 0, py = who(f.payer);
  app.innerHTML = `<div class="lg"><div class="top"><div class="r1"><input id="d" class="pill" placeholder="Loot ✨" enterkeyhint="next" value="${esc(f.desc)}"><button class="cur" data-a="cur">${f.cur}</button></div>
   <div class="r2"><input id="m" class="pill amt" type="number" step="any" inputmode="decimal" enterkeyhint="done" placeholder="Poof 💸" value="${esc(f.amt)}"><button id="go" class="go ${ok ? 'on' : ''}" data-a="go" aria-label="記下來">${SVG.banknote}</button></div>
   <div class="cats">${cats().map(([id, e, n, c]) => `<button class="cat ${f.cat === id ? 'sel' : ''}" style="--c:${c}" data-cat="${id}">${ic('cat-' + id, e)}<span>${n}</span></button>`).join('')}</div>
   <div class="rel"><div class="bar"><button data-a="payer"><small>Payer</small><b><i>${py.avatar}</i>${esc(py.name)}</b></button><button data-a="shares"><small>Shares</small><b style="color:#38bdf8">${s.sh}</b></button><button data-a="method"><small>Method</small><b><i style="font-size:2.6rem">${f.method === 'cash' ? '💵' : '💳'}</i></b></button></div>
   <button class="chev" data-a="adv" aria-label="進階">${SVG.chev}</button></div></div>
   <div class="side"><div class="bubble"><div>${s.text}</div><i id="bsub">${s.sub}</i></div>${recentHtml()}</div></div>`;
  $('#d').oninput = e => { f.desc = e.target.value; chk(); };
  $('#m').oninput = e => { f.amt = e.target.value; chk(); };
  $('#d').onkeydown = e => { if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return; const m = !S.f.amt && recall(S.f.desc); if (m) { Object.assign(S.f, { amt: String(m.minor / 10 ** dec(m.cur)), cur: m.cur, cat: m.cat, payer: m.payer, shares: [...m.shares] }); renderLog(); toast('帶入上次的 ✨'); } $('#m').focus(); };
  $('#m').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) submit(); };
}
const chk = () => { $('#go')?.classList.toggle('on', !!(S.f.desc.trim() && +S.f.amt > 0)); const b = $('#bsub'); if (b) b.textContent = summary().sub; };
function advSheet() {
  const f = S.f, snap = { shares: [...f.shares], date: f.date, pin: f.pin, note: f.note }, o = document.createElement('div'); o.className = 'layer'; document.body.append(o);
  const draw = () => {
    const ws = f.method === 'cash' ? S.rp.wallets.filter(w => w.owner === f.payer && w.cur === f.cur) : [], sm = summary();
    o.innerHTML = `<div class="lh"><button id="lx">取消</button><span>ADVANCED</span><button id="lok">完成</button></div><div class="lb">
      <div class="grp"><label class="cap">成員分攤（點選切換）</label><div class="avs">${people().map(p => `<div class="avc ${f.shares.includes(p.id) ? 'on' : ''}" data-t="${p.id}"><span>${who(p.id).avatar}</span><small>${esc(p.name)}</small></div>`).join('')}</div></div>
      <label class="cap">交易日期</label><input id="ad" type="date" value="${f.date || today()}">
      ${ws.length ? `<label class="cap">指定扣款錢包（預設為自動遞延）</label><select id="aw"><option value="">🤖 自動遞延扣款（舊錢包優先）</option>${ws.map((w, k) => `<option value="${w.id}" ${f.pin === w.id ? 'selected' : ''}>💰 錢包 #${k + 1}（${w.cur}）餘額 ${showAmt(w.left, w.cur)}，匯率 ${(Number(w.rate) / 1e6).toFixed(2)}</option>`).join('')}</select>` : ''}
      <label class="cap">Note</label><textarea id="an" rows="6" placeholder="Add some details…">${esc(f.note)}</textarea></div>
      <div class="lsum"><div class="bubble2"><div>${sm.text}</div><i>${sm.sub}</i></div></div>`;
  };
  draw(); document.body.style.overflow = 'hidden';
  const close = () => { o.remove(); document.body.style.overflow = ''; renderLog(); };
  o.onclick = e => { const b = e.target.closest('button,[data-t]'); if (!b) return;
    if (b.id === 'lx') { Object.assign(f, snap); return close(); } if (b.id === 'lok') return close();
    if (b.dataset.t) { const k = f.shares.indexOf(b.dataset.t); if (k >= 0) { if (f.shares.length > 1) f.shares.splice(k, 1); } else f.shares.push(b.dataset.t); draw(); } };
  o.onchange = e => { if (e.target.id === 'ad') f.date = e.target.value || undefined; else if (e.target.id === 'aw') f.pin = e.target.value; else return; draw(); };
  o.oninput = e => { if (e.target.id === 'an') f.note = e.target.value; };
}
function submit() {
  const f = S.f; if (!(f.desc.trim() && +f.amt > 0)) return;
  const minor = Number(toMinor(f.amt, f.cur)), rate = String(toMicro(S.trip.rates[f.cur]));
  S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1;
  S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'expense', desc: f.desc.trim(), minor, cur: f.cur, rate, twdMicro: String(twdMicro(minor, f.cur, rate)),
    payer: f.payer, shares: [...f.shares], method: f.method, cat: f.cat, notes: f.note || '', pin: f.method === 'cash' && f.pin ? f.pin : undefined, date: f.date || today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false, lock: null, wt: {} });
  f.desc = ''; f.amt = ''; f.note = ''; f.pin = ''; persist(); navigator.vibrate?.(10); renderLog(); $('#d').focus(); S.rp = replay(counted()); toast('✓ 已記下 NT$ ' + showTwd(tw(S.entries[0])));
}
function act(a) {
  const f = S.f, ids = people().map(p => p.id), mem = S.trip.members.map(m => m.id), fund = S.trip.funds[0].id;
  if (a === 'go') return submit();
  if (a === 'ex') return exSheet();
  if (a === 'adv') return advSheet();
  if (a === 'backup') return backupSheet();
  if (a === 'csvx') return exportCsv('expenses', S.entries.filter(e => !e.deleted));
  if (a === 'csvhist') return exportCsv('expenses-filtered', S.histList || []);
  if (a === 'csvw') return exportWalletCsv();
  if (a === 'csvs') return exportSettleCsv();
  if (a === 'csvi') return importSheet();
  if (a === 'cloud') return cloudSheet();
  if (a === 'detach') return detachSheet();
  if (a === 'clouddel') return delSheet();
  if (a === 'joincode') return joinCodeSheet();
  if (a === 'syncnow') { toast('同步中…'); return syncNow(true); }
  if (a === 'send') return sendSheet();
  if (a === 'recv') return recvSheet();
  if (a === 'newtrip') return tripSheet();
  if (a === 'newcur') return curSheet();
  if (a === 'cur') { const c = Object.keys(S.trip.rates); f.cur = c[(c.indexOf(f.cur) + 1) % c.length]; }
  if (a === 'method') { f.method = f.method === 'cash' ? 'credit' : 'cash'; f.pin = ''; }
  if (a === 'payer') { f.payer = ids[(ids.indexOf(f.payer) + 1) % ids.length]; f.shares = [f.payer]; f.pin = ''; }
  if (a === 'shares') f.shares = f.shares.length === 1 && f.shares[0] === f.payer && f.payer !== fund ? [...mem] : f.shares[0] === fund ? [f.payer === fund ? mem[0] : f.payer] : [fund];
  renderLog(); $('#d').focus({ preventScroll: true });
}

const tw = e => String(S.rp.by[e.id]?.twdMicro ?? e.twdMicro);
const sheet = html => { const o = document.createElement('div'); o.className = 'scrim'; o.innerHTML = `<div class="sheet">${html}</div>`; document.body.append(o); o.onclick = e => { if (e.target === o) o.remove(); }; return o; };
const opts = (arr, sel) => arr.map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`).join('');
const HF = ['type', 'cat', 'payer', 'method', 'curr', 'kind'], KINDS = ['種類', '支出', '退款', '換匯', '結清'];
const hfLen = () => ({ type: 3, cat: 1 + cats().length, payer: 1 + people().length, method: 3, curr: 1 + Object.keys(S.trip.rates).length, kind: 5 });
const hay = e => [e.desc, e.notes, cats().find(x => x[0] === e.cat)?.[2], who(e.payer ?? e.owner ?? e.from).name].filter(Boolean).join(' ').toLowerCase();
const isPrivate = e => e.type === 'expense' && e.shares.length === 1 && e.shares[0] === e.payer && S.trip.members.some(m => m.id === e.payer);
function renderLedger() {
  const hf = S.hf ||= { type: 0, cat: 0, payer: 0, method: 0, curr: 0, kind: 0, start: '', end: '' }, P = people(), C = cats(), K = Object.keys(S.trip.rates), cc = C[hf.cat - 1], pp = P[hf.payer - 1];
  hf.kind ??= 0; hf.start ??= ''; hf.end ??= ''; hf.q ??= '';
  const pass = e => (!hf.type || (e.type === 'expense' && (hf.type === 1) === isPrivate(e)))
    && (!hf.kind || (hf.kind === 1 && e.type === 'expense' && e.minor > 0) || (hf.kind === 2 && e.type === 'expense' && e.minor < 0) || (hf.kind === 3 && e.type === 'exchange') || (hf.kind === 4 && e.type === 'settle'))
    && (!hf.cat || e.cat === cc?.[0]) && (!hf.payer || (e.payer ?? e.owner ?? e.from) === pp?.id) && (!hf.method || e.method === ['cash', 'credit'][hf.method - 1]) && (!hf.curr || e.cur === K[hf.curr - 1]) && (!hf.start || e.date >= hf.start) && (!hf.end || e.date <= hf.end) && (!hf.q || hay(e).includes(hf.q.toLowerCase()));
  const all = S.entries.filter(e => !e.deleted), live = S.histList = all.filter(pass), first = all.length ? all.map(e => e.date).sort()[0] : today();
  const found = Math.round(live.filter(e => e.type === 'expense').reduce((a, e) => a + Number(BigInt(tw(e)) / 1000000n), 0));
  const lb = { type: hf.type ? ['', '私帳', '公帳'][hf.type] : '公/私', cat: hf.cat && cc ? ic('cat-' + cc[0], cc[1]) : '分類', payer: hf.payer && pp ? who(pp.id).avatar : '支付', method: hf.method ? ['', '現金', '信用卡'][hf.method] : '方式', curr: hf.curr ? K[hf.curr - 1] : '幣別', kind: KINDS[hf.kind] };
  const days = {}; live.forEach(e => (days[e.date] ||= []).push(e));
  const dn = d => Math.round((new Date(d) - new Date(first)) / 864e5) + 1;
  const D = dupIds(S.entries), tg = e => (isPending(e, S.trip) ? ' · ⏳ 待管理員確認' : '') + (D.has(e.id) ? ' · ⚠️ 可能重複' : ''), row = e => {
    if (e.type === 'settle') return `<div class="item"><span class="ic">🤝</span><div class="t"><div>結清 ${who(e.from).avatar} → ${who(e.to).avatar}</div><small>${who(e.from).name} 還給 ${who(e.to).name}</small></div><div class="a">NT$ ${showTwd(e.twdMicro)}</div><button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button></div>`;
    if (e.type === 'exchange') return `<div class="item" data-edit="${e.id}">${ic('cat-exchange', '💱')}<div class="t"><div>換匯 ${e.cur} ${showAmt(e.minor, e.cur)}</div><small>${who(e.owner).avatar} ${who(e.owner).name} · 花 NT$ ${showTwd(e.twdMicro)}</small></div><button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button></div>`;
    const c = cats().find(x => x[0] === e.cat) || cats().at(-1), sh = S.rp.by[e.id]?.short > 0 && S.rp.wallets.some(w => w.owner === e.payer && w.cur === e.cur);
    return `<div class="item" data-edit="${e.id}">${ic('cat-' + c[0], c[1])}<div class="t"><div>${e.minor < 0 ? '↩︎ 退款 ' : ''}${esc(e.desc)}${e.lock ? ' 🔒' : ''}</div><small>${who(e.payer).avatar} ${who(e.payer).name} 付 · ${e.shares.map(i => who(i).avatar).join('')}${sh ? ' · ⚠️ 錢包不足' : ''}${e.notes ? ' · 📝 ' + esc(e.notes.slice(0, 14)) : ''}${tg(e)}</small></div>
      <div class="a">${e.cur} ${showAmt(e.minor, e.cur)}<br><small>≈ NT$ ${showTwd(tw(e))}</small></div><button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button></div>`;
  };
  app.innerHTML = `<div class="two a"><div><h1>歷史</h1><input id="hq" class="hq" type="search" placeholder="搜尋品項、備註、分類…" autocomplete="off" value="${esc(hf.q)}"><div class="drange"><input type="date" id="hs" value="${hf.start}" aria-label="起">~<input type="date" id="he" value="${hf.end}" aria-label="迄"></div><div class="tabs"><button class="rst" data-hf="reset" aria-label="重設">↺</button>${HF.map(k => `<button class="${hf[k] ? 'on' : ''}" data-k="${k}" data-hf="${k}">${lb[k]}</button>`).join('')}</div><div class="found"><small>FOUND: ${live.length}</small><b>NT$ ${found.toLocaleString()}</b><button class="pill-s" data-a="csvhist">⬇︎ CSV</button></div></div><div>` + (live.length ? Object.keys(days).sort().reverse().map(d => `<div class="day">Day ${dn(d)} · ${d.slice(5).replace('-', '/')}</div>` + days[d].map(row).join('')).join('') : `<div class="empty">${all.length ? '沒有符合的紀錄' : '還沒有紀錄<br>① 到「錢包」換一筆匯（沒有外幣可略過）<br>② 回「記帳」輸入第一筆'}</div>`) + '</div></div>';
}
function renderSettle() {
  const R = settle(counted(), e => BigInt(tw(e))), ids = Object.keys(R.p), nm = id => `${who(id).avatar} ${who(id).name}`, f = n => Math.abs(n).toLocaleString();
  const sel = ids.includes(S.sel) ? S.sel : null, cs = {};
  (sel ? [R.p[sel]] : Object.values(R.p)).forEach(q => Object.entries(q.cats).forEach(([c, v]) => cs[c] = (cs[c] || 0) + v));
  const rows = Object.entries(cs).sort((a, b) => b[1] - a[1]), sum = rows.reduce((a, r) => a + Math.max(0, r[1]), 0) || 1;
  app.innerHTML = `<div class="two b"><div><h1>我的</h1><div class="item hero"><div class="t"><small>目前總花費</small><div style="font-size:1.9rem">NT$ ${R.total.toLocaleString()}</div></div><span class="ic">🧾</span></div>
   ${budgetBlock(R)}${syncNote()}<div class="day">誰該付給誰</div>` + (R.transfers.length ? R.transfers.map((t, i) => `<div class="item"><div class="t"><div style="white-space:normal">${nm(t.from)} → ${nm(t.to)}</div></div><div class="a">NT$ ${f(t.twd)}</div><button class="pay" style="width:auto;margin:0 6px 0 0" data-cptr="${i}" aria-label="複製">📋</button><button class="pay" style="width:auto;margin:0" data-pay="${t.from}|${t.to}|${t.twd}">已結清</button></div>`).join('') + '<button class="pay" data-cptr="all">📋 複製全部轉帳（貼到 LINE）</button>' : `<div class="item"><div class="t" style="text-align:center">${ids.length ? '帳已經平囉 🎉' : '還沒有花費，先去記一筆吧'}</div></div>`) +
   `<div class="day">每個人（累積後才進位一次，加總一定是 0）</div>` + ids.map(id => { const n = R.p[id].net; return `<div class="item"><span class="ic">${who(id).avatar}</span><div class="t"><div>${who(id).name}</div></div><div class="a ${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '該收' : n < 0 ? '該付' : '打平'} ${n ? 'NT$ ' + f(n) : ''}</div></div>`; }).join('') +
   `</div><div>${trendBlock()}<div class="day">花費分類（約）</div><div class="tabs"><button class="${sel ? '' : 'on'}" data-sel="">全部</button>${ids.map(id => `<button class="${sel === id ? 'on' : ''}" data-sel="${id}">${who(id).avatar} ${who(id).name}</button>`).join('')}</div>` +
   (sel ? `<div class="item"><div class="t"><small>實際花費</small><div>NT$ ${R.p[sel].cons.toLocaleString()}</div></div><div class="t"><small>代墊出去</small><div>NT$ ${R.p[sel].paid.toLocaleString()}</div></div></div>` : '') +
   rows.map(([c, v]) => { const k = cats().find(x => x[0] === c) || cats().at(-1);
    return `<div class="item mc" data-mc="${c}"><div class="mcr">${ic('cat-' + k[0], k[1])}<div class="t"><div>${k[2]} <small>${Math.round(Math.max(0, v) / sum * 100)}%</small></div><div class="meter"><i style="width:${Math.max(0, v) / sum * 100}%;background:${k[3]}"></i></div></div><div class="a">NT$ ${v.toLocaleString()}</div></div>${S.myCat === c ? catDetails(c, sel) : ''}</div>`; }).join('') + reviewBlock(R) + '</div></div>';
}
function pay(from, to, twd) {
  if (!isAdmin()) return toast(DENY);
  S.trip.close = { until: new Date(Date.now() - 864e5).toLocaleDateString('sv'), at: Date.now() };
  S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1; S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'settle', from, to, twdMicro: String(BigInt(twd) * 1000000n), date: today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false });
  persist(); render(); toast('結清囉 🤝');
}
// ---- 同步 ----
const b64 = u => { let t = ''; for (let i = 0; i < u.length; i += 8192) t += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(t); };
async function pack(o) {
  const j = new TextEncoder().encode(JSON.stringify(o));
  if (typeof CompressionStream !== 'undefined') return 'LGR1.' + b64(new Uint8Array(await new Response(new Blob([j]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
  return 'LGR0.' + b64(j);
}
async function unpack(code) {
  code = code.trim().replace(/\s+/g, ''); const h = code.slice(0, 5), u = Uint8Array.from(atob(code.slice(5)), c => c.charCodeAt(0));
  if (h === 'LGR1.') return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  if (h === 'LGR0.') return JSON.parse(new TextDecoder().decode(u)); throw 0;
}
const settingsOf = t => structuredClone({ id: t.id, name: t.name, adminId: t.adminId, members: t.members, funds: t.funds, rates: t.rates, cats: t.cats, close: t.close, budget: t.budget, catImg: t.catImg });
const fmtT = t => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function fileSyncBlock() {
  const st = S.dev.syncs[S.trip.id]?.members || {}, g = gaps(S.entries);
  return `<div class="day">同步</div><div class="item hero"><span class="ic">🔗</span><div class="t"><div>資料指紋 #${fingerprint(S.entries)}</div><small>${S.entries.length} 筆 · 兩支手機指紋一樣＝資料一致</small></div></div>` +
   (g.length ? `<div class="item"><div class="t"><div>⚠️ 有 ${g.reduce((a, x) => a + x.miss.length, 0)} 筆缺漏</div><small>請 ${g.map(x => esc(who(S.entries.find(e => e.deviceId === x.dev)?.author).name)).join('、')} 傳「完整」資料</small></div></div>` : '') +
   `<button class="save on" data-a="send" style="margin:6px 0">📤 傳給對方</button><button class="pay" data-a="recv">📥 收進來</button>` +
   S.trip.members.filter(m => m.id !== me()).map(m => `<div class="item"><span class="ic">${who(m.id).avatar}</span><div class="t"><div>${esc(m.name)}</div><small>${st[m.id] ? '上次收到：' + fmtT(st[m.id].t) : '還沒收過 ⚠️'}</small></div></div>`).join('');
}
function syncNote() {
  const c = cl(); if (c) { const lack = S.trip.members.filter(m => m.id !== me() && !(c.members || []).some(x => x.id === m.id && x.joined)); return `<div class="day">資料指紋 #${fingerprint(S.entries)}　雲端同步中</div>` + (lack.length ? `<div class="item"><div class="t"><small>⚠️ ${lack.map(m => esc(m.name)).join('、')} 還沒加入雲端，結算可能不完整</small></div></div>` : ''); }
  const st = S.dev.syncs[S.trip.id]?.members || {}, lack = S.trip.members.filter(m => m.id !== me() && !st[m.id]);
  return `<div class="day">資料指紋 #${fingerprint(S.entries)}　結算前請兩人對一下，一樣才準</div>` + (lack.length ? `<div class="item"><div class="t"><small>⚠️ 還沒收過 ${lack.map(m => esc(m.name)).join('、')} 的資料，結算可能不完整</small></div></div>` : '');
}
async function sendSheet() {
  const o = sheet(`<h2>📤 傳給對方</h2><label class="chk"><input type="checkbox" id="inc"> 只傳上次之後新的（較短，但對方要收齊每一包）</label><textarea id="code" readonly rows="4"></textarea><small id="len"></small>
   <button class="save on" id="s1">分享文字碼（LINE）</button><button class="pay" id="s2">分享檔案（AirDrop）</button><button class="pay" id="s3">複製文字碼</button>`);
  const q = k => o.querySelector(k); let code = '';
  const build = async () => { const since = q('#inc').checked ? S.dev.syncs[S.trip.id]?.lastExport || 0 : 0; code = await pack({ v: FMT, me: owner(), t: Date.now(), trip: settingsOf(S.trip), entries: S.entries.filter(e => e.updatedAt > since) }); q('#code').value = code; q('#len').textContent = `${code.length} 字元` + (code.length > 9000 ? '，LINE 可能放不下，請改用「檔案」' : ''); };
  const done = () => { (S.dev.syncs[S.trip.id] ||= { members: {} }).lastExport = Date.now(); persist(); };
  q('#inc').onchange = build; await build();
  q('#s1').onclick = async () => { try { navigator.share ? await navigator.share({ text: code }) : await navigator.clipboard.writeText(code); done(); } catch {} };
  q('#s2').onclick = async () => { try { const f = new File([code], 'ledger-sync.txt', { type: 'text/plain' }); if (!navigator.canShare?.({ files: [f] })) return toast('這裡不能分享檔案，請用複製'); await navigator.share({ files: [f] }); done(); } catch {} };
  q('#s3').onclick = async () => { try { await navigator.clipboard.writeText(code); done(); toast('已複製 📋'); } catch { q('#code').select(); } };
}
function recvSheet() {
  const o = sheet(`<h2>📥 收進來</h2><textarea id="rc" rows="4" placeholder="把對方傳來的文字碼貼在這裡"></textarea><button class="pay" id="rp">📋 從剪貼簿貼上</button><label class="field">或選擇檔案<input id="rf" type="file" accept=".txt,text/plain"></label><button class="save on" id="rok">預覽</button>`);
  const q = k => o.querySelector(k);
  q('#rp').onclick = async () => { try { q('#rc').value = await navigator.clipboard.readText(); } catch { toast('請長按輸入框貼上'); } };
  q('#rf').onchange = async e => { if (e.target.files[0]) q('#rc').value = await e.target.files[0].text(); };
  q('#rok').onclick = () => preview(q('#rc').value, o);
}
async function preview(code, o) {
  let P; try { P = await unpack(code); } catch { return toast('這個碼讀不懂，請對方重傳 😢'); }
  if (P?.kind === 'backup' && P.v === FMT) return restoreSheet(P, o);
  if (P?.v !== FMT || !P.trip) return toast('版本不同，請兩邊都更新 App');
  if (!S.db.trips.some(t => t.id === P.trip.id)) return joinSheet(P, o);
  if (P.trip.id !== S.trip.id) await switchTrip(P.trip.id);
  const useSet = P.me === P.trip.adminId && (!isAdmin() || P.trip.adminId !== S.trip.adminId), adm = useSet ? P.trip.adminId : S.trip.adminId;
  const r = merge(S.entries, P.entries, { adminId: adm }), tmp = { ...S.trip, ...(useSet ? P.trip : {}) }, pend = r.entries.filter(e => isPending(e, tmp) && !isPending(e, S.trip)).length, g = gaps(r.entries);
  const from = S.trip.members.find(m => m.id === P.me)?.name || '對方';
  o.remove(); const w = sheet(`<h2>預覽：${esc(from)} 的資料</h2><div class="item"><div class="t"><div>➕ 新增 ${r.stats.added} 筆</div><div>✏️ 更新 ${r.stats.updated} 筆</div><div>⚔️ 兩邊都改過 ${r.stats.conflicts} 筆</div><div>⏳ 待管理員確認 ${pend} 筆</div><div>⚠️ 可能重複 ${dupIds(r.entries).size} 筆</div>${useSet ? '<small>※ 成員、匯率、分類會以管理員為準</small>' : ''}${g.length ? `<small>⚠️ 還缺 ${g.reduce((a, x) => a + x.miss.length, 0)} 筆，請對方傳「完整」資料</small>` : ''}</div></div><button class="save on" id="mok">合併 ✨</button><button class="pay" id="mno">取消</button>`);
  w.querySelector('#mno').onclick = () => w.remove();
  w.querySelector('#mok').onclick = () => {
    S.entries = r.entries; if (useSet) Object.assign(S.trip, P.trip);
    const sy = (S.dev.syncs[S.trip.id] ||= { members: {} }); sy.members[P.me] = { t: Date.now(), n: P.entries.length };
    persist(); w.remove(); render(); toast('合併好囉 🔗 #' + fingerprint(S.entries));
  };
}
function joinSheet(P, o) {
  o.remove(); const w = sheet(`<h2>加入「${esc(P.trip.name)}」</h2><label>你是誰？<select id="js">${opts(P.trip.members.map(m => [m.id, m.name]), '')}</select></label><button class="save on" id="jok">加入 🧳</button>`);
  w.querySelector('#jok').onclick = async () => {
    const t = P.trip; S.db.trips.push(t); S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = w.querySelector('#js').value; await save('entries:' + t.id, P.entries);
    (S.dev.syncs[t.id] = { members: { [P.me]: { t: Date.now(), n: P.entries.length } } }); w.remove(); await switchTrip(t.id);
  };
}
function pendSheet(e) {
  if (!isAdmin()) return toast('等管理員確認 ⏳');
  const w = sheet(`<h2>⏳ 結清後補記的</h2><div class="item"><div class="t"><div>${esc(e.desc)}</div><small>${e.date} · ${who(e.payer).name} 付 · ${e.cur} ${showAmt(e.minor, e.cur)}</small></div></div><button class="save on" id="pa">同意，計入結算</button><button class="pay" id="pd" style="background:#fee2e2;color:#be123c">不要，刪掉</button>`);
  w.querySelector('#pa').onclick = () => { e.approved = true; e.updatedAt = Date.now(); e.by = owner(); persist(); w.remove(); render(); toast('已計入 ✅'); };
  w.querySelector('#pd').onclick = () => { e.deleted = true; e.updatedAt = Date.now(); e.by = owner(); persist(); w.remove(); render(); };
}
// ---- 打磨 ----
const standalone = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
function backupBlock() {
  const t = S.dev.lastBackup;
  return `<div class="day">備份</div><div class="item"><div class="t"><div>${t ? '上次備份：' + fmtT(t) : '還沒備份過 ⚠️'}</div><small>手機若被清資料，就靠它救回來</small></div></div><button class="pay" data-a="backup">💾 備份（全部旅程）</button><small style="display:block;color:var(--mute);margin:0 4px 6px">還原：到「收進來」貼上備份碼即可</small>`;
}
async function backupSheet() {
  const all = {}; for (const t of S.db.trips) all[t.id] = t.id === S.trip.id ? S.entries : await load('entries:' + t.id, []);
  const code = await pack({ v: FMT, kind: 'backup', db: S.db, dev: S.dev, entries: all, t: Date.now() });
  const o = sheet(`<h2>💾 備份</h2><textarea readonly rows="3">${code}</textarea><small>${code.length} 字元</small><button class="save on" id="b1">分享檔案（存到「檔案」或 AirDrop）</button><button class="pay" id="b2">複製</button>`);
  const done = () => { S.dev.lastBackup = Date.now(); persist(); };
  o.querySelector('#b1').onclick = async () => { try { const f = new File([code], 'ledger-backup.txt', { type: 'text/plain' }); if (!navigator.canShare?.({ files: [f] })) return toast('這裡不能分享檔案，請用複製'); await navigator.share({ files: [f] }); done(); } catch {} };
  o.querySelector('#b2').onclick = async () => { try { await navigator.clipboard.writeText(code); done(); toast('已複製 📋'); } catch {} };
}
function restoreSheet(P, o) {
  o.remove(); const w = sheet(`<h2>⚠️ 還原備份</h2><div class="item"><div class="t"><div>${P.db.trips.length} 趟旅程，備份於 ${fmtT(P.t)}</div><small>會用備份「覆蓋」這支手機現在的全部資料</small></div></div><button class="save on" id="ro">確定還原</button><button class="pay" id="rn">取消</button>`);
  w.querySelector('#rn').onclick = () => w.remove();
  w.querySelector('#ro').onclick = async () => { for (const id of Object.keys(P.entries)) await save('entries:' + id, P.entries[id]); await save('db', P.db); await save('dev', P.dev); location.reload(); };
}
function budSheet() {
  if (!isAdmin()) return toast(DENY); const b = S.trip.budget || {};
  const o = sheet(`<h2>💰 預算</h2><label>總預算（台幣）<input id="bt" type="number" inputmode="decimal" value="${b.total || ''}"></label><label>旅程天數<input id="bd" type="number" inputmode="numeric" value="${b.days || ''}"></label><button class="save on" id="bok">存好 ✨</button>`);
  o.querySelector('#bok').onclick = () => { S.trip.budget = { total: Math.round(+o.querySelector('#bt').value) || 0, days: Math.round(+o.querySelector('#bd').value) || 0 }; persist(); o.remove(); render(); };
}
function budgetBlock(R) {
  const b = S.trip.budget; if (!b?.total) return '';
  const left = b.total - R.total, pct = Math.min(100, Math.max(0, R.total / b.total * 100)), ds = counted().map(e => e.date).sort(), n = ds.length ? Math.round((new Date(today()) - new Date(ds[0])) / 864e5) + 1 : 1;
  return `<div class="item"><div class="t"><small>預算 NT$ ${b.total.toLocaleString()}</small><div class="${left < 0 ? 'neg' : ''}">${left < 0 ? '超支' : '還剩'} NT$ ${Math.abs(left).toLocaleString()} <small>（已用 ${Math.round(pct)}%）</small></div><div class="meter"><i style="width:${pct}%;background:${left < 0 ? '#fb7185' : '#86efac'}"></i></div>${b.days && n < b.days && left > 0 ? `<small>第 ${n}/${b.days} 天 · 之後每天約可花 NT$ ${Math.round(left / (b.days - n)).toLocaleString()}</small>` : ''}</div></div>`;
}
function reviewBlock(R) {
  const ex = counted().filter(e => e.type === 'expense'); if (ex.length < 3) return '';
  const d = {}; ex.forEach(e => d[e.date] = (d[e.date] || 0) + Number(BigInt(tw(e)) / 1000000n)); const [bd, bv] = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
  const c = {}; Object.values(R.p).forEach(q => Object.entries(q.cats).forEach(([k, v]) => c[k] = (c[k] || 0) + v)); const k = cats().find(x => x[0] === Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]) || cats().at(-1);
  const pm = Object.entries(R.p).sort((a, b) => b[1].paid - a[1].paid)[0];
  return `<div class="day">旅程回顧 🎞️</div><div class="item hero"><div class="t"><div>📅 最貴的一天：${bd.slice(5).replace('-', '/')}（NT$ ${bv.toLocaleString()}）</div><div>${ic('cat-' + k[0], k[1])} 最燒錢：${k[2]}</div><div>🏆 墊最多：${who(pm[0]).avatar} ${esc(who(pm[0]).name)}（NT$ ${pm[1].paid.toLocaleString()}）</div><div>🧾 共 ${ex.length} 筆、${Object.keys(d).length} 天</div></div></div>`;
}
function chkSheet(id) {
  const w = S.rp.wallets.find(x => x.id === id); if (!w) return;
  const o = sheet(`<h2>💵 現金核對</h2><div class="item"><div class="t"><div>系統記錄剩 ${w.cur} ${showAmt(w.left, w.cur)}</div><small>${who(w.owner).name} 的錢包</small></div></div><label>皮夾實際剩多少？<input id="ca" type="number" step="any" inputmode="decimal"></label><button class="save on" id="cok">核對</button>`);
  o.querySelector('#cok').onclick = () => {
    const v = o.querySelector('#ca').value; if (v === '') return; const diff = w.left - Number(toMinor(v, w.cur)); o.remove();
    if (diff <= 0) return toast(diff < 0 ? '實際比記錄多，可能漏記換匯 🤔' : '剛好吻合 🎉');
    const rate = String(toMicro(S.trip.rates[w.cur] || 1)); S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1;
    S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'expense', desc: '現金核對差額', minor: diff, cur: w.cur, rate, twdMicro: String(twdMicro(diff, w.cur, rate)), payer: w.owner, shares: [w.owner], method: 'cash', cat: cats().at(-1)[0], pin: w.id, date: today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false, lock: null, wt: {} });
    persist(); render(); toast('差額記成雜支了 🧾');
  };
}
const recall = d => { d = d.trim().toLowerCase(); return d && S.entries.find(e => e.type === 'expense' && !e.deleted && e.minor > 0 && e.desc.trim().toLowerCase() === d); };
// ---- 雲端同步（伺服器是權威：權限由 Cloudflare Worker 判斷） ----
const cl = () => S.dev.cloud?.[S.trip.id], strip = ({ _s, ...x }) => x, dirtyList = () => S.entries.filter(e => e._s !== e.updatedAt);
let syncing = false, syncTimer;
function scheduleSync(ms = 1500) { clearTimeout(syncTimer); if (cl() && !cl().dead) syncTimer = setTimeout(() => syncNow(), ms); }
function softRender() { if (document.querySelector('.scrim')) return; if (S.page === 'log' && (S.f.desc || S.f.amt)) return; render(); }
async function syncNow(manual) {
  const c = cl(); if (!c || c.dead || syncing) return; syncing = true; const tid = S.trip.id;
  try {
    const dirty = dirtyList(), sj = JSON.stringify(settingsOf(S.trip)), pushSet = isAdmin() && sj !== c.sj, rejected = []; let newRec;
    for (let i = 0; i === 0 || i * 400 < dirty.length; i++) {
      if (!dirty.length && !pushSet) break;
      const r = await cloudApi('POST', `/api/trips/${tid}/push`, { entries: dirty.slice(i * 400, (i + 1) * 400).map(strip), ...(i === 0 && pushSet ? { settings: settingsOf(S.trip) } : {}) }, c.token);
      if (r.error) throw r; rejected.push(...r.rejected); if (r.newRecoveryCode) newRec = r.newRecoveryCode; if (i === 0 && pushSet) c.sj = sj;
    }
    const rej = new Set(rejected.map(x => x.id)), got = new Set(), pushed = new Map(dirty.map(e => [e.id, e.updatedAt])); let since = rejected.length ? 0 : Math.max(0, (c.rev || 0) - 20);
    for (;;) {
      const r = await cloudApi('GET', `/api/trips/${tid}/sync?since=${since}`, null, c.token); if (r.error) throw r;
      if (S.trip.id !== tid) return;
      const m = new Map(S.entries.map(e => [e.id, e]));
      for (const e of r.entries) { const l = m.get(e.id); got.add(e.id); if (l && l._s !== l.updatedAt && pushed.get(e.id) !== l.updatedAt && !rej.has(e.id)) continue; m.set(e.id, { ...e, _s: e.updatedAt }); }
      S.entries = [...m.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || (a.id < b.id ? -1 : 1));
      if (r.settings && (!isAdmin() || r.settings.adminId !== S.trip.adminId)) { Object.assign(S.trip, r.settings); c.sj = JSON.stringify(settingsOf(S.trip)); }
      c.rev = r.rev; c.members = r.members; if (!r.more) break; since = r.rev;
    }
    S.entries = S.entries.filter(e => !(rej.has(e.id) && !got.has(e.id)));
    c.err = null; c.last = Date.now(); await saveAll();
    if (rejected.length) toast('⚠️ ' + [...new Set(rejected.map(x => x.reason))].join('、'), undefined, undefined, 5000);
    else if (manual) toast('同步好了 ✅');
    if (newRec) recoverySheet(newRec);
    softRender();
  } catch (e) { c.err = e.error || '同步失敗'; if (e.status === 401) { c.dead = true; c.err = '憑證失效，請重新用邀請碼加入'; } if (manual) toast('⚠️ ' + c.err); if (S.page === 'set') softRender(); }
  finally { syncing = false; }
}
function cloudBlock() {
  const c = cl(), n = dirtyList().length, A = isAdmin(), ms = c.members || [];
  return `<div class="day">雲端</div><div class="item hero"><span class="ic">☁️</span><div class="t"><div>${c.dead ? '⚠️ 憑證失效' : c.err ? '離線中' : '已連線'}</div><small>${c.last ? '上次同步 ' + fmtT(c.last) : '尚未同步'}${n ? ' · ' + n + ' 筆待送' : ''}${c.err && !c.dead ? ' · ' + esc(c.err) : ''}</small></div></div><button class="save on" data-a="syncnow" style="margin:6px 0">🔄 立即同步</button>` +
    S.trip.members.filter(m => m.id !== owner()).map(m => { const x = ms.find(y => y.id === m.id); return `<div class="item"><span class="ic">${who(m.id).avatar}</span><div class="t"><div>${esc(m.name)}</div><small>${x?.joined ? (x.lastSeen ? '上次上線 ' + fmtT(x.lastSeen) : '已加入') : '還沒加入'}</small></div>${A ? `<button class="pay" style="width:auto;margin:0" data-inv="${m.id}">邀請碼</button><button class="pay" style="width:auto;margin:0 0 0 6px;background:#fee2e2;color:#be123c" data-rvk="${m.id}">撤銷</button>` : ''}</div>`; }).join('') +
    `<div class="day">進階</div><div class="item"><div class="t"><small>旅程編號（用恢復碼找回管理員時會用到）</small><div style="word-break:break-all;font-weight:400">${esc(S.trip.id)}</div></div></div><button class="pay" data-a="detach">離開雲端（保留這支手機的資料）</button>${A ? '<button class="pay" data-a="clouddel" style="background:#fee2e2;color:#be123c">刪除雲端旅程</button>' : ''}`;
}
function syncBlock() {
  if (cl()) return cloudBlock();
  return `<div class="day">雲端（真正的權限）</div><div class="item"><div class="t"><small>搬到雲端後，誰能改什麼由伺服器把關，成員改不了別人的帳，也不用再手動傳檔。</small></div></div>${isAdmin() ? '<button class="save on" data-a="cloud" style="margin:6px 0">☁️ 把這趟旅程搬到雲端</button><div class="item"><div class="t"><small>📌 邀請碼和恢復碼要「先搬到雲端」才會出現：<br>① 按上面的按鈕，輸入你的金鑰 → 畫面會顯示一次「恢復碼」，請存好。<br>② 搬完後，這一區會出現每位成員旁的「邀請碼」鈕，按它就能產生並分享。<br>還沒部署雲端的話，可先用下方「傳給對方」邀請旅伴。</small></div></div>' : ''}<button class="pay" data-a="joincode">🎟️ 輸入邀請碼加入</button>` + fileSyncBlock();
}
function copyBtn(o, sel, text) { o.querySelector(sel).onclick = async () => { try { await navigator.clipboard.writeText(text); toast('已複製 📋'); } catch { toast('請長按選取複製'); } }; }
function recoverySheet(code) {
  const o = sheet(`<h2>🔑 管理員恢復碼</h2><div class="item"><div class="t"><small>只會顯示這一次。管理員手機遺失時，靠它找回身分。請截圖或抄下來，存在安全的地方。</small></div></div><div style="font-size:1.4rem;font-weight:700;text-align:center;word-break:break-all;padding:8px" id="rcode">${esc(code)}</div><small style="text-align:center;color:var(--mute);word-break:break-all">旅程編號：<span id="rtid">${esc(S.trip.id)}</span>（找回時兩個都要）</small><button class="pay" id="rc1">複製</button><button class="save on" id="rc2">我已經存好了</button>`);
  copyBtn(o, '#rc1', code); o.querySelector('#rc2').onclick = () => o.remove();
}
function cloudSheet() {
  if (!isAdmin()) return toast(DENY);
  const o = sheet(`<h2>☁️ 搬到雲端</h2><div class="item"><div class="t"><small>會把這趟旅程的成員、設定和 ${S.entries.length} 筆紀錄上傳。之後成員用邀請碼加入。</small></div></div><label>建立金鑰（SETUP_KEY）<input id="ck" type="password" autocomplete="off"></label><button class="save on" id="cgo">上傳 ☁️</button>`);
  o.querySelector('#cgo').onclick = async () => {
    const key = o.querySelector('#ck').value; if (!key) return; toast('上傳中…');
    const r = await cloudApi('POST', '/api/trips', { settings: settingsOf(S.trip), entries: S.entries.slice(0, 400).map(strip) }, null, key);
    if (r.error) return toast('⚠️ ' + r.error);
    S.dev.cloud[S.trip.id] = { token: r.token, rev: 0, sj: JSON.stringify(settingsOf(S.trip)), last: 0 }; await saveAll(); o.remove(); recoverySheet(r.recoveryCode); syncNow(); render();
  };
}
function confirmSheet(title, text, label, danger, onOk) {
  const o = sheet(`<h2>${title}</h2><div class="item"><div class="t"><small>${text}</small></div></div><button class="pay" id="cy"${danger ? ' style="background:#fee2e2;color:#be123c"' : ''}>${label}</button><button class="save" id="cn">取消</button>`);
  o.querySelector('#cn').onclick = () => o.remove(); o.querySelector('#cy').onclick = async () => { o.remove(); await onOk(); };
}
const detach = async () => { delete S.dev.cloud[S.trip.id]; await saveAll(); render(); toast('已離開雲端，資料保留在這支手機'); };
function rvkSheet(mid) {
  confirmSheet('撤銷 ' + esc(who(mid).name), '對方手機的憑證會立刻失效，無法再同步。之後可以重新發邀請碼讓他加入。', '撤銷', true, async () => { const r = await cloudApi('POST', `/api/trips/${S.trip.id}/revoke`, { memberId: mid }, cl().token); toast(r.error ? '⚠️ ' + r.error : '已撤銷 ' + who(mid).name); syncNow(); });
}
function detachSheet() { confirmSheet('離開雲端', '這支手機會停止同步，但紀錄都還在。之後可以用邀請碼重新加入。其他人不受影響。', '離開雲端', false, detach); }
function delSheet() {
  const o = sheet(`<h2>刪除雲端旅程</h2><div class="item"><div class="t"><small>會永久刪除伺服器上的整趟旅程，所有成員都會失去同步。各人手機裡的資料不會被刪。請輸入旅程名稱「${esc(S.trip.name)}」確認。</small></div></div><label>旅程名稱<input id="dn" autocomplete="off"></label><button class="pay" id="dy" style="background:#fee2e2;color:#be123c">永久刪除</button>`);
  o.querySelector('#dy').onclick = async () => { if (o.querySelector('#dn').value.trim() !== S.trip.name) return toast('名稱不對'); const r = await cloudApi('POST', `/api/trips/${S.trip.id}/delete`, {}, cl().token); if (r.error) return toast('⚠️ ' + r.error); o.remove(); await detach(); toast('雲端旅程已刪除'); };
}
async function inviteSheet(mid) {
  const r = await cloudApi('POST', `/api/trips/${S.trip.id}/invites`, { memberId: mid }, cl().token); if (r.error) return toast('⚠️ ' + r.error);
  const url = location.origin + location.pathname, msg = `加入「${S.trip.name}」的記帳：\n1. 開啟 ${url}\n2. 設定 → 輸入邀請碼\n邀請碼：${r.code}（7 天內有效，只能用一次）`;
  const o = sheet(`<h2>🎟️ 給 ${esc(who(mid).name)} 的邀請碼</h2><div style="font-size:2rem;font-weight:700;text-align:center;letter-spacing:.1em" id="icode">${r.code}</div><small style="text-align:center;color:var(--mute)">7 天內有效，只能用一次。重發新碼會讓對方舊手機的憑證失效。</small><button class="save on" id="i1">分享</button><button class="pay" id="i2">複製</button>`);
  o.querySelector('#i1').onclick = async () => { try { await navigator.share({ text: msg }); } catch {} }; copyBtn(o, '#i2', msg);
}
function joinCodeSheet() {
  const o = sheet(`<h2>🎟️ 輸入邀請碼</h2><label>邀請碼<input id="jc" autocomplete="off" autocapitalize="characters" placeholder="XXXXX-XXXXX"></label><button class="save on" id="jgo">加入</button><div class="day">換手機的管理員？</div><label>旅程編號<input id="rt" autocomplete="off"></label><label>管理員恢復碼<input id="rk" autocomplete="off" autocapitalize="characters"></label><button class="pay" id="rgo">用恢復碼找回管理員</button>`);
  o.querySelector('#rgo').onclick = async () => {
    const tid = o.querySelector('#rt').value.trim(), code = o.querySelector('#rk').value; if (!tid || !code.trim()) return;
    const r = await cloudApi('POST', '/api/recover', { tripId: tid, code }); if (r.error) return toast('⚠️ ' + r.error);
    const g = await cloudApi('GET', `/api/trips/${r.tripId}/sync?since=0`, null, r.token); if (g.error) return toast('⚠️ ' + g.error);
    let t = S.db.trips.find(x => x.id === r.tripId); if (!t) { t = g.settings; S.db.trips.push(t); await save('entries:' + t.id, []); } else Object.assign(t, g.settings);
    S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = r.memberId; S.dev.cloud[t.id] = { token: r.token, rev: 0, sj: JSON.stringify(settingsOf(t)), last: 0 };
    o.remove(); await switchTrip(t.id); recoverySheet(r.recoveryCode); syncNow(true);
  };
  o.querySelector('#jgo').onclick = async () => {
    const code = o.querySelector('#jc').value; if (!code.trim()) return;
    const r = await cloudApi('POST', '/api/join', { code }); if (r.error) return toast('⚠️ ' + r.error);
    let t = S.db.trips.find(x => x.id === r.tripId); if (!t) { t = r.settings; S.db.trips.push(t); await save('entries:' + t.id, []); } else Object.assign(t, r.settings);
    S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = r.memberId; S.dev.cloud[t.id] = { token: r.token, rev: 0, sj: JSON.stringify(settingsOf(t)), last: 0 };
    o.remove(); await switchTrip(t.id); syncNow(true);
  };
}
// ---- CSV 匯出／匯入 ----
const csvRow = a => a.map(v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
function parseCsv(t) {
  t = t.replace(/^\uFEFF/, ''); const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n') { r.push(f.replace(/\r$/, '')); rows.push(r); r = []; f = ''; } else f += c; }
  if (f !== '' || r.length) { r.push(f.replace(/\r$/, '')); rows.push(r); }
  return rows.filter(x => x.some(y => y.trim() !== ''));
}
async function saveFile(name, text) {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
  try { if (window.showSaveFilePicker) { const h = await showSaveFilePicker({ suggestedName: name, types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }] }); const w = await h.createWritable(); await w.write(blob); await w.close(); toast('已存檔 ✅'); return true; } } catch (e) { if (e.name === 'AbortError') return false; }
  const f = new File([blob], name, { type: 'text/csv' });
  try { if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return true; } } catch (e) { if (e.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('已下載 ⬇︎'); return true;
}
const HEAD = ['日期', '時間', '種類', '分類', '品項', '外幣金額', '幣別', '匯率', '台幣', '付款人', '分攤', '公私', '付款方式', '備註', '記錄者', '編號'];
function exportCsv(kind, list) {
  const t = ts => ts ? new Date(ts).toTimeString().slice(0, 5) : '', twd = e => Math.round(Number(tw(e)) / 1e4) / 100, rows = [HEAD];
  for (const e of [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.ts ?? 0) - (b.ts ?? 0))) {
    if (e.type === 'expense') { const c = cats().find(x => x[0] === e.cat); rows.push([e.date, t(e.ts), e.minor < 0 ? '退款' : '支出', c ? c[2] : e.cat, e.desc, e.minor / 10 ** dec(e.cur), e.cur, Number(e.rate) / 1e6, twd(e), who(e.payer).name, e.shares.map(i => who(i).name + ':' + (e.wt?.[i] ?? 2) / 2).join('|'), isPrivate(e) ? '私帳' : '公帳', e.method === 'cash' ? '現金' : '信用卡', e.notes || '', who(e.author).name, e.id]); }
    else if (e.type === 'exchange') rows.push([e.date, t(e.ts), '換匯', '', '', e.minor / 10 ** dec(e.cur), e.cur, Number(e.rate) / 1e6, Number(e.twdMicro) / 1e6, who(e.owner).name, '', '', '', '', who(e.author).name, e.id]);
    else if (e.type === 'settle') rows.push([e.date, t(e.ts), '結清', '', '', '', 'TWD', 1, Number(e.twdMicro) / 1e6, who(e.from).name, who(e.to).name, '', '', '', who(e.author).name, e.id]);
  }
  if (rows.length < 2) return toast('沒有可匯出的紀錄');
  saveFile(`ledger-${kind}-${today()}.csv`, rows.map(csvRow).join('\r\n')).then(ok => ok && offerBackup());
}
function exportWalletCsv() {
  const rows = [['編號', '日期', '持有人', '幣別', '換匯金額', '花費台幣', '匯率', '目前餘額']];
  for (const w of S.rp.wallets) { const e = S.entries.find(x => x.id === w.id); rows.push([w.id, w.date, who(w.owner).name, w.cur, w.init / 10 ** dec(w.cur), Number(e?.twdMicro ?? 0) / 1e6, Number(w.rate) / 1e6, w.left / 10 ** dec(w.cur)]); }
  if (rows.length < 2) return toast('還沒有錢包'); saveFile(`ledger-wallets-${today()}.csv`, rows.map(csvRow).join('\r\n'));
}
function exportSettleCsv() {
  const R = settle(counted(), e => BigInt(tw(e))), rows = [['成員', '實際花費(台幣)', '代墊(台幣)', '淨額(正=該收,負=該付)']];
  Object.entries(R.p).forEach(([id, q]) => rows.push([who(id).name, q.cons, q.paid, q.net])); rows.push([], ['轉帳建議', '付款人', '收款人', '金額(台幣)']); R.transfers.forEach(t => rows.push(['', who(t.from).name, who(t.to).name, t.twd]));
  saveFile(`ledger-settlement-${today()}.csv`, rows.map(csvRow).join('\r\n'));
}
function csvBlock() {
  return `<div class="day">CSV 匯出／匯入</div><button class="save on" data-a="csvx" style="margin-bottom:8px">⬇︎ 匯出帳目 CSV</button><div class="r1" style="grid-template-columns:1fr 1fr;margin:0"><button class="pay" data-a="csvw">⬇︎ 錢包</button><button class="pay" data-a="csvs">⬇︎ 結算</button></div><button class="pay" data-a="csvi">⬆︎ 匯入 CSV（本 App 或舊版）</button>`;
}
const metaNew = () => { S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1; return { tripId: S.trip.id, author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), deleted: false }; };
const ms = (x, c) => Math.round(parseFloat(x) * 10 ** dec(c)), mic = x => Math.round(parseFloat(x) * 1e6);
function importSheet() {
  const o = sheet(`<h2>⬆︎ 匯入 CSV</h2><div class="item"><div class="t"><small>可匯入：本 App 匯出的帳目 CSV，或舊版 PWA 的「Expenses」「Wallet」CSV。重複的紀錄會略過。</small></div></div><label>選擇 CSV 檔<input id="cf" type="file" accept=".csv,text/csv,text/plain"></label>`);
  o.querySelector('#cf').onchange = async e => { const f = e.target.files[0]; if (!f) return; const rows = parseCsv(await f.text()), h = rows[0] || []; o.remove();
    if (h[0] === '日期' && h.includes('編號')) return importOwn(rows); if (h.includes('expenseId') || (h.includes('walletId') && h.includes('ownerUID'))) return legacySheet(rows); toast('⚠️ 不認得這個 CSV 的格式'); };
}
function importOwn(rows) {
  const id = n => people().find(p => p.name === n)?.id, miss = new Set(), add = [], have = new Set(S.entries.map(e => e.id)); let dup = 0;
  for (const c of rows.slice(1)) { const [date, time, kind, catN, desc, amt, cur, rate, twd, p1, p2, , meth, note, , eid] = c; if (!date || !cur && kind !== '結清') continue;
    if (eid && have.has(eid)) { dup++; continue; } const nd = normDate(date), ts = (nd && Date.parse(`${nd.date}T${time || '12:00'}`)) || Date.now();
    if (kind === '換匯') { if (!id(p1)) { miss.add(p1); continue; } add.push({ id: eid || 'e' + uid(), type: 'exchange', owner: id(p1), cur, minor: ms(amt, cur), rate: String(mic(rate)), twdMicro: String(mic(twd)), date, ts }); }
    else if (kind === '結清') { if (!id(p1) || !id(p2)) { miss.add(p1 + '/' + p2); continue; } add.push({ id: eid || 'e' + uid(), type: 'settle', from: id(p1), to: id(p2), twdMicro: String(mic(twd)), date, ts }); }
    else { const sh = (p2 || '').split('|').map(x => x.split(':')), ids = sh.map(x => id(x[0])); if (!id(p1) || ids.some(x => !x)) { miss.add(p1); continue; }
      add.push({ id: eid || 'e' + uid(), type: 'expense', desc, minor: ms(amt, cur), cur, rate: String(mic(rate)), twdMicro: String(mic(twd)), payer: id(p1), shares: ids, wt: Object.fromEntries(sh.map((x, k) => [ids[k], Math.round(parseFloat(x[1] || 1) * 2)])), method: meth === '現金' ? 'cash' : 'credit', cat: cats().find(x => x[2] === catN)?.[0] ?? cats().at(-1)[0], notes: note || '', date, ts, lock: kind === '退款' ? null : null }); } }
  if (miss.size) return toast('⚠️ 找不到成員：' + [...miss].join('、') + '（請先在設定建立同名成員）');
  finishImport(add, dup);
}
function finishImport(add, dup) {
  const w = sheet(`<h2>預覽</h2><div class="item"><div class="t"><div>➕ 將匯入 ${add.length} 筆</div><div>⏭ 略過重複 ${dup} 筆</div></div></div><button class="save on" id="io" ${add.length ? '' : 'disabled'}>匯入</button><button class="pay" id="in">取消</button>`);
  w.querySelector('#in').onclick = () => w.remove();
  w.querySelector('#io').onclick = () => { for (const e of add) { for (const c of [e.cur]) if (c && !(c in S.trip.rates)) S.trip.rates[c] = parseFloat(e.rate) / 1e6 || 1; S.entries.unshift({ ...metaNew(), ...e }); } S.entries.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)); w.remove(); persist(); render(); toast(`已匯入 ${add.length} 筆 ✅`); };
}
function legacySheet(rows) {
  const isW = !rows[0].includes('expenseId'), uids = [...new Set(rows.slice(1).flatMap(c => isW ? [c[1]] : [c[8], ...(c[9] || '').split('|')]).filter(Boolean))].sort(), P = people(); let n = 0;
  const def = u => u === 'u004' ? S.trip.funds[0]?.id : S.trip.members[n++ % S.trip.members.length].id;
  const w = sheet(`<h2>舊版 CSV：對應成員</h2><div class="item"><div class="t"><small>舊版的「人」要對應到現在的成員（u004 通常是公款）。確認後匯入 ${rows.length - 1} 筆。</small></div></div>${uids.map(u => `<label>${esc(u)} →<select data-u="${esc(u)}">${opts(P.map(p => [p.id, p.name]), def(u))}</select></label>`).join('')}<button class="save on" id="lo">匯入</button>`);
  w.querySelector('#lo').onclick = () => {
    const map = {}; w.querySelectorAll('[data-u]').forEach(x => map[x.dataset.u] = x.value); const add = [], have = new Set(S.entries.map(e => e.id)); let dup = 0;
    for (const c of rows.slice(1)) { const eid = 'l' + c[0]; if (have.has(eid)) { dup++; continue; }
      if (isW) { const cur = c[2], nd = normDate(c[6]); add.push({ id: eid, type: 'exchange', owner: map[c[1]], cur, minor: ms(c[3], cur), rate: String(mic(c[5])), twdMicro: String(mic(parseFloat(c[3]) * parseFloat(c[5]))), date: nd?.date ?? today(), ts: nd?.ts ?? Date.now() }); continue; }
      if (c.length < 10) continue; const nm = (c[2] || '').trim().split(/\s+/).pop(), cur = c[5], tm = mic(c[7]);
      add.push({ id: eid, type: 'expense', desc: c[3], minor: ms(c[4], cur), cur, rate: String(mic(c[6])), twdMicro: String(tm), lock: String(tm), payer: map[c[8]], shares: c[9].split('|').map(u => map[u]), wt: {}, method: c[10] === 'cash' ? 'cash' : 'credit', cat: cats().find(x => x[2] === nm || x[0] === nm)?.[0] ?? cats().at(-1)[0], notes: c[12] || '', date: normDate(c[1])?.date ?? today(), ts: normDate(c[1])?.ts ?? Date.now() }); }
    w.remove(); finishImport(add, dup); };
}
document.addEventListener('change', e => { const t = e.target; if (t.id === 'hs' || t.id === 'he') { S.hf[t.id === 'hs' ? 'start' : 'end'] = t.value; renderLedger(); } });
// ---- 優化：備份提醒、複製轉帳、複製上一筆、每日趨勢、自訂分類圖、搜尋 ----
const normDate = x => { const m = String(x || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2}))?)?/); if (!m) return null; const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return { date: d, ts: Date.parse(`${d}T${(m[4] || '12').padStart(2, '0')}:${m[5] || '00'}:00`) || Date.now() }; };
function fixDates() {
  let n = 0; S.entries.forEach((e, i) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) { const nd = normDate(e.date); if (nd) { e.date = nd.date; e.ts = nd.ts + i; e.updatedAt = Date.now(); e.by = owner(); n++; } } });
  if (n) { saveAll(); setTimeout(() => toast(`已修正 ${n} 筆日期格式 🛠️`), 800); }
}
const okPath = t => /^(img\/|\.\/img\/|https:\/\/)[\w\-./%~+]+$/i.test(t);
function catDetails(c, sel) {
  const L = counted().filter(e => e.type === 'expense' && e.cat === c && (!sel || e.shares.includes(sel))).sort((a, b) => b.date.localeCompare(a.date) || (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 20);
  return `<div class="mcd"><div class="wh"><span>${sel ? esc(who(sel).name) + ' 的份額' : '全部'}</span><span>近 ${L.length} 筆</span></div>` + (L.map(e => { const W = e.shares.reduce((a, i) => a + (e.wt?.[i] ?? 2), 0), w = sel ? (e.wt?.[sel] ?? 2) : W, sm = Math.round(e.minor * w / W), twd = Math.round(Number(BigInt(tw(e))) / 1e6 * w / W);
    return `<div class="tx"><div class="t"><div>${esc(e.desc)}</div><small>${e.date.slice(5).replace('-', '/')} · ≈ NT$ ${twd.toLocaleString()}</small></div><span>${e.cur} ${showAmt(sm, e.cur)}</span></div>`; }).join('') || '<div class="empty" style="padding:10px">沒有紀錄</div>') + '</div>';
}
function applyFresh(t, o) {
  const names = o.querySelector('#tm').value.split(/[,，、]/).map(x => x.trim()).filter(Boolean).slice(0, 10), AV = ['🐬', '🌻', '🦊', '🐼', '🐸', '🐙', '🦁', '🐧', '🐰', '🐻'];
  if (names.length) { t.members = names.map((n, i) => ({ id: 'm' + (i + 1), name: n, avatar: AV[i] })); t.adminId = 'm1'; }
  const rates = {}; for (const l of o.querySelector('#tr').value.split('\n')) { const m = l.trim().match(/^([A-Za-z]{2,4})[\s:=,]+([\d.]+)/); if (m && +m[2] > 0) rates[m[1].toUpperCase()] = parseFloat(m[2]); }
  if (Object.keys(rates).length) { rates.TWD = 1; t.rates = rates; }
}
const shrinkPng = file => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const m = Math.min(96 / im.width, 96 / im.height), w = im.width * m, h = im.height * m; c.getContext('2d').drawImage(im, (96 - w) / 2, (96 - h) / 2, w, h); res(c.toDataURL('image/png')); }; im.src = URL.createObjectURL(file); });
async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); try { document.execCommand('copy'); } catch {} a.remove(); } toast('已複製 📋'); }
function copyTransfers(arg) {
  const T = settle(counted(), e => BigInt(tw(e))).transfers, L = arg === 'all' ? T : [T[+arg]].filter(Boolean); if (!L.length) return;
  copyText(`【${S.trip.name} 結算】\n` + L.map(t => `${who(t.from).name} → ${who(t.to).name}　NT$ ${t.twd.toLocaleString()}`).join('\n'));
}
function dupToForm(id) {
  const e = S.entries.find(x => x.id === id); if (!e || e.type !== 'expense') return;
  Object.assign(S.f, { desc: e.desc, amt: String(Math.abs(e.minor) / 10 ** dec(e.cur)), cur: e.cur, cat: e.cat, payer: e.payer, shares: [...e.shares], method: e.method, note: e.notes || '', pin: '', date: e.date });
  S.page = 'log'; render(); toast('已複製到表單，改一下就能記 ⎘');
}
function offerBackup() { if (Date.now() - (S.dev.lastBackup || 0) > 864e5) toast('💾 順便備份一下嗎？', backupSheet, '備份', 6000); }
function tripEndCheck() {
  const b = S.trip.budget, ds = S.entries.filter(e => !e.deleted).map(e => e.date).sort(); if (!b?.days || !ds.length) return; S.dev.endAsked ||= {};
  const end = new Date(new Date(ds[0] + 'T12:00:00').getTime() + (b.days - 1) * 864e5).toLocaleDateString('sv'); if (today() < end || S.dev.endAsked[S.trip.id]) return;
  S.dev.endAsked[S.trip.id] = 1; saveAll();
  const o = sheet(`<h2>🎉 旅程結束了</h2><div class="item"><div class="t"><small>「${esc(S.trip.name)}」已到預定的最後一天。要不要把整趟帳目匯出成 CSV，並備份一份？</small></div></div><button class="save on" id="te1">⬇︎ 匯出帳目 CSV</button><button class="pay" id="te2">💾 備份</button><button class="pay" id="te3">稍後</button>`);
  o.querySelector('#te1').onclick = () => { o.remove(); exportCsv('expenses', S.entries.filter(e => !e.deleted)); }; o.querySelector('#te2').onclick = () => { o.remove(); backupSheet(); }; o.querySelector('#te3').onclick = () => o.remove();
}
function trendBlock() {
  const ex = counted().filter(e => e.type === 'expense'); if (!ex.length) return '';
  const d = {}; ex.forEach(e => d[e.date] = (d[e.date] || 0) + Number(BigInt(tw(e)) / 1000000n));
  const ds = Object.keys(d).sort(), first = ds[0], last = ds.at(-1) > today() ? ds.at(-1) : today(), days = [];
  for (const t = new Date(first + 'T12:00:00'); t.toLocaleDateString('sv') <= last && days.length < 60; t.setDate(t.getDate() + 1)) { const k = t.toLocaleDateString('sv'); days.push([k, Math.max(0, d[k] || 0)]); }
  const B = S.trip.budget, tl = B?.total && B?.days ? B.total / B.days : 0, mx = Math.max(1, tl, ...days.map(x => x[1])), W = 320, H = 110, step = (W - 8) / days.length, bw = Math.min(28, step - 4), y = v => H - 14 - v / mx * (H - 22);
  const bars = days.map(([k, v], i) => `<rect x="${(4 + i * step + (step - bw) / 2).toFixed(1)}" y="${(v === 0 ? H - 16 : y(v)).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, v / mx * (H - 22)).toFixed(1)}" rx="${Math.min(6, bw / 2, Math.max(1, v / mx * (H - 22)) / 2).toFixed(1)}" fill="${v === 0 ? '#E5E7EB' : k === today() ? '#8ED1FC' : '#F9A8D4'}"/>`).join('');
  const dd = x => x.slice(5).replace('-', '/'), avg = Math.round(days.reduce((a, x) => a + x[1], 0) / days.length);
  return `<div class="day">每日花費趨勢</div><div class="item" style="display:block"><div style="display:flex;justify-content:space-between"><small>今天 NT$ ${Math.round(d[today()] || 0).toLocaleString()}</small><small>平均每天 NT$ ${avg.toLocaleString()}</small></div><svg viewBox="0 0 ${W} ${H}" stroke="none" style="width:100%;height:auto;display:block;margin-top:6px" role="img" aria-label="每日花費趨勢">${bars}${tl ? `<line x1="0" x2="${W}" y1="${y(tl).toFixed(1)}" y2="${y(tl).toFixed(1)}" stroke="#fb7185" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}<g font-size="9" fill="#9ca3af"><text x="4" y="${H - 2}">${dd(days[0][0])}</text><text x="${W - 4}" y="${H - 2}" text-anchor="end">${dd(days.at(-1)[0])}</text><text x="${W - 4}" y="9" text-anchor="end">最高 ${Math.round(mx).toLocaleString()}</text></g></svg>${tl ? '<small>虛線＝每天預算</small>' : ''}</div>`;
}
const hqApply = v => { S.hf.q = v; renderLedger(); const i = $('#hq'); i.focus(); i.setSelectionRange(v.length, v.length); };
document.addEventListener('input', e => { if (e.target.id === 'hq' && !e.isComposing) hqApply(e.target.value); });
document.addEventListener('compositionend', e => { if (e.target.id === 'hq') hqApply(e.target.value); });
const shrink = file => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const m = Math.min(im.width, im.height); c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 96, 96); res(c.toDataURL('image/jpeg', .72)); }; im.src = URL.createObjectURL(file); });
const used = id => S.entries.some(e => [e.payer, e.owner, e.from, e.to, ...(e.shares || [])].includes(id));
function renderSet() {
  const A = isAdmin(), t = S.trip, row = (ic, n, sub, at) => `<div class="item" ${at}><span class="ic">${ic}</span><div class="t"><div>${n}</div>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  const ppl = (k, at) => t[k].map(m => row(who(m.id).avatar, esc(m.name) + (m.id === t.adminId ? ' 👑' : ''), '', `data-pp="${k}|${m.id}"`)).join('') + (A ? `<button class="pay" data-pp="${k}|">＋ 新增</button>` : '');
  app.innerHTML = `<h1>設定</h1><div class="cols"><div class="item hero"><span class="ic">${who(owner()).avatar}</span><div class="t"><div>這支手機是 ${esc(who(owner()).name)}${me() !== owner() ? '，代 ' + esc(who(me()).name) + ' 操作' : ''}</div><small>${A ? '👑 管理員：可以改全部' : '成員：只能改自己記的'}</small></div></div>
   ${A ? `<label class="field">代誰操作（只有管理員有這個選項）<select id="meSel">${opts(t.members.map(m => [m.id, m.name]), me())}</select></label>` : ''}${standalone() ? '' : '<div class="item"><div class="t"><small>📲 想像 App 一樣用：Safari 點分享 → 加入主畫面</small></div></div>'}${syncBlock()}${backupBlock()}${csvBlock()}<div class="day">旅程</div>` +
   S.db.trips.map(x => row(x.id === t.id ? '📍' : '🧳', esc(x.name), x.id === t.id ? '目前使用，點一下改名' : '點一下切換', `data-trip="${x.id}"`)).join('') + `<button class="pay" data-a="newtrip">＋ 新旅程</button>
   <div class="day">成員</div>${ppl('members')}<div class="day">公款</div>${ppl('funds')}<div class="day">分類</div>` + cats().map(c => row(ic('cat-' + c[0], c[1]), esc(c[2]), '', `data-cc="${c[0]}"`)).join('') + (A ? `<button class="pay" data-cc="">＋ 新增</button>` : '') +
   `<div class="day">參考匯率（1 外幣 ＝ ? 台幣；只影響之後的紀錄）</div>` + Object.entries(t.rates).map(([c, r]) => `<div class="item"><div class="t"><div>${c}</div></div>${c === 'TWD' || !A ? `<div class="a">${r}</div>` : `<input class="rate" type="number" step="any" data-rate="${c}" value="${r}">`}</div>`).join('') + (A ? `<button class="pay" data-a="newcur">＋ 幣別</button>` : '') + `<div class="day">預算</div>` + row('💰', t.budget?.total ? `NT$ ${t.budget.total.toLocaleString()} · ${t.budget.days || '?'} 天` : '還沒設定', A ? '點一下修改' : '', 'data-bud=""') + '</div>';
}
function personSheet(kind, id) {
  if (!isAdmin()) return toast(DENY);
  const list = S.trip[kind], p = list.find(x => x.id === id) || { id: (kind === 'funds' ? 'f' : 'm') + uid(), name: '', avatar: kind === 'funds' ? '🍔' : '🙂', _new: 1 }; let img = p.img, fromFile = false;
  const o = sheet(`<h2>${kind === 'funds' ? '公款' : '成員'}</h2><label>名字<input id="pn" value="${esc(p.name)}"></label><label>表情符號<input id="pe" value="${esc(p.avatar)}"></label><label>或用照片（自動縮小）<input id="pf" type="file" accept="image/*"></label>
   <label>或填圖片檔名（放在 GitHub 的 img/ 資料夾，例：img/smile.png）<input id="pi" value="${p.img && !p.img.startsWith('data:') ? esc(p.img) : ''}" autocomplete="off"></label>${p.img ? '<button class="pay" id="pr">移除照片</button>' : ''}<button class="save on" id="pok">存好 ✨</button>${!p._new && kind === 'members' && p.id !== S.trip.adminId ? '<button class="pay" id="pa">設為管理員 👑</button>' : ''}${!p._new ? '<button class="pay" id="pd" style="background:#fee2e2;color:#be123c">刪除</button>' : ''}`);
  const q = k => o.querySelector(k), end = m => { persist(); o.remove(); render(); toast(m); };
  q('#pf').onchange = async e => { if (e.target.files[0]) { img = await shrink(e.target.files[0]); fromFile = true; toast('照片好了 📷'); } };
  if (q('#pr')) q('#pr').onclick = () => { img = null; q('#pr').remove(); };
  q('#pok').onclick = () => { const n = q('#pn').value.trim(); if (!n) return; const typed = q('#pi').value.trim(); if (typed && !okPath(typed)) return toast('圖片檔名要像 img/smile.png'); if (!fromFile) { if (typed) img = typed; else if (p.img && !p.img.startsWith('data:')) img = null; } Object.assign(p, { name: n, avatar: q('#pe').value.trim() || '🙂', img: img || undefined }); delete p._new; if (!list.includes(p)) list.push(p); end('存好囉 ✨'); };
  if (q('#pa')) q('#pa').onclick = () => { S.trip.adminId = p.id; end('管理員換人了 👑'); };
  if (q('#pd')) q('#pd').onclick = () => { if (p.id === S.trip.adminId || list.length <= 1) return toast('管理員和最後一個不能刪'); if (used(p.id)) return toast('已有紀錄用到，不能刪'); list.splice(list.indexOf(p), 1); end('刪掉了'); };
}
function catSheet(id) {
  if (!isAdmin()) return toast(DENY);
  S.trip.cats ||= CATS.map(c => [...c]); const L = S.trip.cats, c = L.find(x => x[0] === id) || ['c' + uid(), '📦', '', '#E5E7EB', 1];
  const o = sheet(`<h2>分類</h2><label>名字<input id="cn" value="${esc(c[2])}"></label><label>表情符號<input id="ce" value="${esc(c[1])}"></label><label>顏色<input id="cc" type="color" value="${c[3].length === 7 ? c[3] : '#E5E7EB'}"></label><label>或用自己的圖片（自動縮小，支援透明背景）<input id="cpf" type="file" accept="image/*"></label><label>或填圖片檔名（放在 GitHub 的 img/ 資料夾，例：img/food.png）<input id="cpi" value="${S.trip.catImg?.[c[0]] && !S.trip.catImg[c[0]].startsWith('data:') ? esc(S.trip.catImg[c[0]]) : ''}" autocomplete="off"></label>${S.trip.catImg?.[c[0]] ? '<button class="pay" id="cpr">移除自訂圖片</button>' : ''}<button class="save on" id="cok">存好 ✨</button>${c[4] ? '' : '<button class="pay" id="cd" style="background:#fee2e2;color:#be123c">刪除（舊紀錄會變「雜支」）</button>'}`);
  let img = S.trip.catImg?.[c[0]], fromFile = false; const end = m => { persist(); o.remove(); render(); toast(m); };
  o.querySelector('#cpf').onchange = async e => { if (e.target.files[0]) { img = await shrinkPng(e.target.files[0]); fromFile = true; toast('圖片好了 🖼️'); } };
  if (o.querySelector('#cpr')) o.querySelector('#cpr').onclick = () => { img = null; o.querySelector('#cpr').remove(); };
  o.querySelector('#cok').onclick = () => { const n = o.querySelector('#cn').value.trim(); if (!n) return; const typed = o.querySelector('#cpi').value.trim(); if (typed && !okPath(typed)) return toast('圖片檔名要像 img/food.png'); if (!fromFile) { if (typed) img = typed; else if (S.trip.catImg?.[c[0]] && !S.trip.catImg[c[0]].startsWith('data:')) img = null; } if (img) (S.trip.catImg ||= {})[c[0]] = img; else if (S.trip.catImg) delete S.trip.catImg[c[0]]; c[1] = o.querySelector('#ce').value.trim() || '📦'; c[2] = n; c[3] = o.querySelector('#cc').value; if (c[4]) { delete c[4]; L.push(c); } end('存好囉 ✨'); };
  if (o.querySelector('#cd')) o.querySelector('#cd').onclick = () => { if (L.length <= 2) return toast('至少留兩個分類'); L.splice(L.indexOf(c), 1); end('刪掉了'); };
}
function curSheet() {
  const o = sheet(`<h2>新增幣別</h2><label>代碼（例：JPY）<input id="kc" maxlength="4"></label><label>1 外幣 ＝ ? 台幣<input id="kr" type="number" step="any" inputmode="decimal"></label><button class="save on" id="kok">加進去 ✨</button>`);
  o.querySelector('#kok').onclick = () => { const c = o.querySelector('#kc').value.trim().toUpperCase(), r = +o.querySelector('#kr').value; if (!c || !(r > 0)) return; S.trip.rates[c] = r; persist(); o.remove(); render(); };
}
function tripSheet(id) {
  const cur = id && S.db.trips.find(x => x.id === id);
  const o = sheet(`<h2>${cur ? '旅程改名' : '新旅程'}</h2><label>名字<input id="tn" value="${cur ? esc(cur.name) : ''}" placeholder="例：波士尼亞 2026"></label>${cur && S.db.trips.length > 1 ? '<button class="pay" id="trm" style="background:#fee2e2;color:#be123c">從這支手機移除</button>' : ''}${cur ? '' : `<label class="chk"><input type="checkbox" id="tc" checked> 沿用目前的成員、公款、幣別、分類</label><div id="tf" class="fresh" hidden><label>成員（用逗號分隔，第一位是你）<input id="tm" value="Smile, Jiani" autocomplete="off"></label><label>幣別與匯率（每行一個：代碼 空格 匯率）<textarea id="tr" rows="4">${Object.entries(S.trip.rates).filter(([c]) => c !== 'TWD').map(([c, r]) => c + ' ' + r).join('\n')}</textarea></label></div>`}<button class="save on" id="tok">${cur ? '存好' : '出發 🧳'}</button>`);
  o.querySelector('#tc')?.addEventListener('change', e => { o.querySelector('#tf').hidden = e.target.checked; });
  if (o.querySelector('#trm')) o.querySelector('#trm').onclick = async e => {
    if (!e.target.dataset.sure) { e.target.dataset.sure = 1; return e.target.textContent = '再按一次確認（只影響這支手機，記得先備份）'; }
    const next = S.db.trips.find(x => x.id !== cur.id); await save('entries:' + cur.id, []); S.db.trips = S.db.trips.filter(x => x.id !== cur.id); delete S.dev.meBy[cur.id]; delete S.dev.ownerBy[cur.id];
    S.trip = next; S.db.cur = next.id; S.entries = await load('entries:' + next.id, []); resetForm(); await persist(); o.remove(); render(); toast('已移除 🗑️');
  };
  o.querySelector('#tok').onclick = async () => {
    const n = o.querySelector('#tn').value.trim() || '新旅程'; if (cur) { cur.name = n; persist(); o.remove(); return render(); }
    const t = newTrip(); t.name = n; if (o.querySelector('#tc').checked) { const c = structuredClone(S.trip); Object.assign(t, { members: c.members, funds: c.funds, rates: c.rates, cats: c.cats, adminId: owner() }); } else applyFresh(t, o); S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = t.adminId;
    S.db.trips.push(t); o.remove(); await switchTrip(t.id);
  };
}
async function switchTrip(id) {
  await persist(); S.db.cur = id; S.trip = S.db.trips.find(t => t.id === id); S.entries = await load('entries:' + id, []); fixDates(); resetForm(); await persist(); S.page = 'set'; render(); toast('已切換 🧳');
}
function renderWallet() {
  const ws = S.rp.wallets;
  app.innerHTML = `<h1>錢包</h1><button class="save on" data-a="ex" style="margin-bottom:14px">＋ 換匯，存進錢包</button>` + (ws.length ? '<div class="wlist">' + ws.map(w => {
    const open = S.wx === w.id, tx = open ? S.entries.filter(e => !e.deleted && S.rp.by[e.id]?.ded?.some(d => d.w === w.id)).sort((a, b) => b.date.localeCompare(a.date) || (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 20) : [];
    return `<div class="item wcard ${open ? 'open' : ''}"><div class="wrow" data-wx="${w.id}"><span class="ic">${who(w.owner).avatar}</span><div class="t"><small>${w.cur} 💰</small><div class="bal">${showAmt(w.left, w.cur)}</div></div><div class="a"><small>Rate: ${(Number(w.rate) / 1e6).toFixed(2)}</small><br><button class="del" data-del="${w.id}" aria-label="刪除">🗑️</button></div></div>` +
      (open ? `<div class="wtx"><div class="wh"><span>初始：${showAmt(w.init, w.cur)}</span><span>近 20 筆支出</span></div>${tx.length ? tx.map(e => { const c = cats().find(x => x[0] === e.cat) || cats().at(-1), d = S.rp.by[e.id].ded.filter(x => x.w === w.id).reduce((a, x) => a + x.t, 0); return `<div class="tx">${ic('cat-' + c[0], c[1])}<div class="t"><div>${esc(e.desc)}</div><small>${e.date.slice(5).replace('-', '/')}</small></div><b>−${showAmt(d, e.cur)}</b></div>`; }).join('') : '<div class="empty" style="padding:12px">無扣款紀錄</div>'}${w.left > 0 ? `<button class="pay" data-chk="${w.id}" style="margin-top:10px">核對現金</button>` : ''}</div>` : '') + `</div>`;
  }).join('') + '</div>' : `<div class="empty">還沒有錢包<br>換匯後，現金會存在這裡</div>`);
}
function exSheet(e0) {
  const o = sheet(`<h2>🏦 換匯</h2><label>誰換的<select id="xo">${opts(people().map(p => [p.id, p.avatar + ' ' + p.name]), e0?.owner ?? me())}</select></label>
   <label>幣別<select id="xc">${opts(Object.keys(S.trip.rates).filter(c => c !== 'TWD').map(c => [c, c]), e0?.cur ?? S.f.cur)}</select></label>
   <label>換到多少外幣<input id="xm" type="number" step="any" inputmode="decimal" value="${e0 ? e0.minor / 10 ** dec(e0.cur) : ''}"></label><label>花了多少台幣<input id="xt" type="number" step="any" inputmode="decimal" value="${e0 ? Number(e0.twdMicro) / 1e6 : ''}"></label><label>日期<input id="xd" type="date" value="${e0?.date ?? today()}"></label>
   <button class="save on" id="xok">存進錢包 💰</button>`);
  o.querySelector('#xok').onclick = () => {
    const v = k => o.querySelector('#' + k).value, cur = v('xc'), m = Number(toMinor(v('xm') || 0, cur)), t = BigInt(Math.round(+v('xt') * 1e6)); if (!(m > 0 && t > 0n)) return;
    const rate = (t * 10n ** BigInt(dec(cur)) + BigInt(m) / 2n) / BigInt(m);
    if (e0) { Object.assign(e0, { owner: v('xo'), cur, minor: m, rate: String(rate), twdMicro: String(t), date: v('xd') || e0.date, updatedAt: Date.now(), by: owner() }); persist(); o.remove(); render(); return toast('改好囉 ✨'); }
    S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1;
    S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'exchange', owner: v('xo'), cur, minor: m, rate: String(rate), twdMicro: String(t), date: v('xd') || today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false });
    persist(); o.remove(); render(); toast('錢包多一筆囉 💰');
  };
}
function editSheet(id) {
  const e = S.entries.find(x => x.id === id); if (!e || !['expense', 'exchange'].includes(e.type)) return; if (e.type === 'exchange') return can(e) ? exSheet(e) : toast('這筆是別人記的，只有管理員能改 🔒'); if (isPending(e, S.trip)) return pendSheet(e); if (!can(e)) return toast('這筆是別人記的，只有管理員能改 🔒');
  const wt = { ...e.wt }, sh = new Set(e.shares), g = i => wt[i] ?? 2;
  const o = sheet(`<h2>編輯</h2><label>品項<input id="ed" value="${esc(e.desc)}"></label><label>金額 (${e.cur})<input id="em" type="number" step="any" inputmode="decimal" value="${Math.abs(e.minor) / 10 ** dec(e.cur)}"></label>
   <label>日期<input id="ea" type="date" value="${e.date}"></label><label>分類<select id="ec">${opts(cats().map(c => [c[0], c[1] + ' ' + c[2]]), e.cat)}</select></label>
   <label>付款人<select id="ep">${opts(people().map(p => [p.id, p.avatar + ' ' + p.name]), e.payer)}</select></label>${e.method === 'cash' && e.minor > 0 ? `<label>從哪個錢包扣<select id="ew">${opts([['', '自動（舊的先扣）'], ...S.rp.wallets.filter(w => w.owner === e.payer && w.cur === e.cur).map(w => [w.id, w.date.slice(5).replace('-', '/') + ' @' + (Number(w.rate) / 1e6).toFixed(2)])], e.pin || '')}</select></label>` : ''}<label>備註<textarea id="en" rows="3">${esc(e.notes || '')}</textarea></label><div class="day">分攤（份數可調，0.5 份＝一半）</div><div id="chips"></div>
   <label class="chk"><input type="checkbox" id="er" ${e.minor < 0 ? 'checked' : ''}> 這是退款</label><label class="chk"><input type="checkbox" id="el" ${e.lock ? 'checked' : ''}> 🔒 鎖定台幣金額</label><button class="pay" id="edup">⎘ 複製這筆到記帳頁</button><button class="save on" id="eok">存好 ✨</button>`);
  const chips = () => o.querySelector('#chips').innerHTML = people().map(p => `<div class="chip ${sh.has(p.id) ? 'on' : ''}"><button data-t="${p.id}">${who(p.id).avatar} ${p.name}</button>${sh.has(p.id) ? `<button data-m="${p.id}">−</button><b>${g(p.id) / 2}</b><button data-p="${p.id}">＋</button>` : ''}</div>`).join('');
  o.querySelector('#edup').onclick = () => { o.remove(); dupToForm(e.id); };
  chips(); o.querySelector('#chips').onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.t) sh.has(d.t) ? sh.size > 1 && sh.delete(d.t) : sh.add(d.t); if (d.m) wt[d.m] = Math.max(1, g(d.m) - 1); if (d.p) wt[d.p] = g(d.p) + 1; chips(); };
  o.querySelector('#eok').onclick = () => {
    const v = k => o.querySelector('#' + k), m = Number(toMinor(v('em').value || 0, e.cur)); if (!(m > 0) || !v('ed').value.trim()) return;
    Object.assign(e, { desc: v('ed').value.trim(), notes: v('en').value.trim(), minor: v('er').checked ? -m : m, date: v('ea').value || e.date, cat: v('ec').value, payer: v('ep').value, shares: [...sh], wt: Object.fromEntries([...sh].map(i => [i, g(i)])), lock: null, updatedAt: Date.now(), by: owner() });
    e.pin = o.querySelector('#ew')?.value || undefined; e.twdMicro = String(twdMicro(e.minor, e.cur, e.rate)); S.rp = replay(S.entries); if (v('el').checked) e.lock = tw(e);
    persist(); o.remove(); render(); toast('改好囉 ✨');
  };
}
function toast(msg, undo, label = '復原', ms) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg + (undo ? ` <button>${label}</button>` : ''); document.body.append(t);
  if (undo) t.querySelector('button').onclick = () => { undo(); t.remove(); };
  setTimeout(() => t.remove(), ms ?? (undo ? 4000 : 1400));
}
function del(id) {
  const e = S.entries.find(x => x.id === id); if (!can(e)) return toast('這筆是別人記的，只有管理員能刪 🔒'); e.deleted = true; e.updatedAt = Date.now(); e.by = owner(); persist(); render();
  toast('已刪除', () => { e.deleted = false; e.updatedAt = Date.now(); e.by = owner(); persist(); render(); });
}
const soon = n => `<h1>${n}</h1><div class="empty">這一頁會在後續版本加入</div>`;
const counted = () => S.entries.filter(e => !isPending(e, S.trip));
function render() { S.rp = replay(counted()); nav(); const v = { log: renderLog, ledger: renderLedger, wallet: renderWallet, settle: renderSettle, set: renderSet }[S.page]; if (v) v(); else app.innerHTML = soon(NAV.find(n => n[0] === S.page)[1]); }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-go],[data-a],[data-cat],[data-del],[data-edit],[data-pay],[data-sel],[data-pp],[data-cc],[data-trip],[data-chk],[data-bud],[data-wx],[data-hf],[data-inv],[data-rvk],[data-cptr],[data-dup],[data-mc]'); if (!b) return;
  if (b.dataset.go) { S.page = b.dataset.go; render(); } else if (b.dataset.a) act(b.dataset.a);
  else if (b.dataset.cat) { S.f.cat = b.dataset.cat; navigator.vibrate?.(10); renderLog(); } else if (b.dataset.mc) { S.myCat = S.myCat === b.dataset.mc ? null : b.dataset.mc; renderSettle(); } else if (b.dataset.cptr) copyTransfers(b.dataset.cptr); else if (b.dataset.dup) dupToForm(b.dataset.dup); else if (b.dataset.inv) inviteSheet(b.dataset.inv); else if (b.dataset.rvk) rvkSheet(b.dataset.rvk); else if (b.dataset.wx) { S.wx = S.wx === b.dataset.wx ? null : b.dataset.wx; renderWallet(); } else if (b.dataset.hf) { const h = S.hf, k = b.dataset.hf; if (k === 'reset') { HF.forEach(x => h[x] = 0); h.start = h.end = h.q = ''; } else h[k] = (h[k] + 1) % hfLen()[k]; renderLedger(); } else if (b.dataset.chk) chkSheet(b.dataset.chk); else if (b.dataset.bud !== undefined) budSheet(); else if (b.dataset.pp !== undefined) personSheet(...b.dataset.pp.split('|')); else if (b.dataset.cc !== undefined) catSheet(b.dataset.cc); else if (b.dataset.trip) { b.dataset.trip === S.trip.id ? (isAdmin() ? tripSheet(b.dataset.trip) : toast(DENY)) : switchTrip(b.dataset.trip); } else if (b.dataset.pay) pay(...b.dataset.pay.split('|')); else if (b.dataset.sel !== undefined) { S.sel = b.dataset.sel || null; render(); } else if (b.dataset.edit) editSheet(b.dataset.edit); else del(b.dataset.del);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.rate && isAdmin() && +t.value > 0) { S.trip.rates[t.dataset.rate] = +t.value; persist(); toast('匯率更新囉'); }
  else if (t.id === 'meSel' && isAdmin()) { S.dev.meBy[S.trip.id] = t.value; resetForm(); persist(); render(); }
});
(async () => {
  let db = await load('db', null);
  if (!db) { const old = await load('trip', null); if (old) { db = { trips: [old], cur: old.id }; await save('entries:' + old.id, await load('entries', [])); } else { const t = newTrip(); db = { trips: [t], cur: t.id }; } }
  S.db = db; S.trip = db.trips.find(t => t.id === db.cur) || db.trips[0]; S.entries = await load('entries:' + S.trip.id, []);
  S.dev = await load('dev', null) || { id: 'd' + uid(), seq: 0 }; S.dev.meBy ||= {}; S.dev.sqBy ||= {}; S.dev.syncs ||= {}; if (typeof S.dev.me === 'string') { S.dev.meBy[S.trip.id] = S.dev.me; delete S.dev.me; }
  S.dev.ownerBy ||= {}; S.dev.cloud ||= {}; for (const t of S.db.trips) S.dev.ownerBy[t.id] ??= S.dev.meBy[t.id] ?? t.adminId;
  fixDates(); resetForm(); render(); syncNow();
  addEventListener('online', () => syncNow()); document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow()); setInterval(() => document.visibilityState === 'visible' && syncNow(), 30000);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const ask = w => toast('有新版本 ✨', () => w.postMessage('skip'), '更新', 60000);
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); }); });
    });
    let rl; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!rl) { rl = 1; location.reload(); } });
  }
  setTimeout(tripEndCheck, 2600);
  setTimeout(() => { if (S.entries.length && Date.now() - (S.dev.lastBackup || 0) > 3 * 864e5) toast('💾 好幾天沒備份了', () => { S.page = 'set'; render(); }, '去備份', 7000); }, 2000);
})();
