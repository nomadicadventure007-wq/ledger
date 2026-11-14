import { toMinor, toMicro, twdMicro, showTwd, showAmt, dec } from './core/money.js';
import { load, save } from './core/store.js';
import { merge, fingerprint, gaps, isPending, dupIds, FMT } from './core/sync.js';
import { settle } from './core/settle.js';
import { replay } from './core/wallet.js';
import { newTrip, uid, CATS, IMAGES } from './core/model.js';

const S = { page: 'log', trip: null, entries: [], dev: null, f: { desc: '', amt: '', cur: 'EUR', payer: 'm1', shares: ['m1'], method: 'cash', cat: 'food' } };
const $ = s => document.querySelector(s), app = $('#app');
const people = () => [...S.trip.members, ...S.trip.funds];
const cats = () => S.trip.cats || CATS, me = () => S.dev.meBy[S.trip.id] ?? owner(), owner = () => S.dev.ownerBy[S.trip.id] ?? S.dev.meBy[S.trip.id] ?? S.trip.adminId, isAdmin = () => owner() === S.trip.adminId, can = e => isAdmin() || e.author === me(), DENY = '這個只有管理員能改 🔒';
const who = id => { const p = people().find(x => x.id === id) || { name: '?', avatar: '❓' }; return { ...p, avatar: p.img ? `<img class="av" src="${p.img}" alt="">` : p.avatar }; };
const resetForm = () => { S.f = { desc: '', amt: '', cur: Object.keys(S.trip.rates)[0], payer: me(), shares: [me()], method: 'cash', cat: cats()[0][0] }; };
const ic = (slot, emoji) => IMAGES[slot] ? `<span class="ic"><img src="${IMAGES[slot]}" alt=""></span>` : `<span class="ic">${emoji}</span>`;
const today = () => new Date().toLocaleDateString('sv');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const persist = () => Promise.all([save('db', S.db), save('entries:' + S.trip.id, S.entries), save('dev', S.dev)]);

const NAV = [['log', '記帳', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'], ['ledger', '帳本', '<path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5"/>'],
  ['settle', '結算', '<path d="M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H7"/>'], ['wallet', '錢包', '<path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l2-3h12M16 14h2"/>'], ['set', '設定', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>']];
function nav() { $('#nav').innerHTML = NAV.map(([k, n, p]) => `<button class="${S.page === k ? 'on' : ''}" data-go="${k}"><svg viewBox="0 0 24 24">${p}</svg>${n}</button>`).join(''); }

function summary() {
  const f = S.f, rate = S.trip.rates[f.cur], m = S.trip.members.length;
  const sh = f.shares.length === 1 && f.shares[0] === f.payer ? 'Solo' : f.shares.length >= m && !f.shares.some(x => x[0] === 'f') ? 'All' : f.shares[0]?.[0] === 'f' ? 'Shared' : f.shares.length + ' 人';
  return { sh, text: `${today().slice(5).replace('-', '/')}，${who(f.payer).name} 付，${f.shares.map(i => who(i).avatar).join('')} 分攤`, sub: `${f.method === 'cash' ? '現金' : '信用卡'}，${f.cur} @${rate}` };
}
function renderLog() {
  if (!cats().some(c => c[0] === S.f.cat)) S.f.cat = cats()[0][0];
  const f = S.f, s = summary(), ok = f.desc.trim() && +f.amt > 0;
  app.innerHTML = `<div class="top">
   <div class="row" style="grid-template-columns:3fr 1fr"><input id="d" class="pill" placeholder="Loot ✨" value="${esc(f.desc)}"><button class="cur" data-a="cur">${f.cur}</button></div>
   <div class="row"><input id="m" class="pill" type="number" step="any" inputmode="decimal" enterkeyhint="done" placeholder="Poof 💸" value="${esc(f.amt)}" style="text-align:center"></div>
   <div class="cats">${cats().map(([id, e, n, c]) => `<button class="cat ${f.cat === id ? 'sel' : ''}" style="--c:${c}" data-cat="${id}">${ic('cat-' + id, e)}<span>${n}</span></button>`).join('')}</div>
   <div class="bar"><button data-a="payer"><small>Payer</small><b>${who(f.payer).avatar} ${who(f.payer).name}</b></button>
   <button data-a="shares"><small>Shares</small><b style="color:var(--blue)">${s.sh}</b></button>
   <button data-a="method"><small>Method</small><b style="font-size:1.8rem">${f.method === 'cash' ? '💵' : '💳'}</b></button></div></div>
   <div class="dock"><div class="bubble"><div>${s.text}</div><i>${s.sub}</i></div><button id="save" class="save ${ok ? 'on' : ''}" data-a="go">${ok ? '記下來 ✨' : '先填品項和金額喔'}</button></div>`;
  $('#d').oninput = e => { f.desc = e.target.value; chk(); };
  $('#m').oninput = e => { f.amt = e.target.value; chk(); };
  $('#d').onkeydown = e => { if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return; const m = !S.f.amt && recall(S.f.desc); if (m) { Object.assign(S.f, { amt: String(m.minor / 10 ** dec(m.cur)), cur: m.cur, cat: m.cat, payer: m.payer, shares: [...m.shares] }); renderLog(); toast('帶入上次的 ✨'); } $('#m').focus(); };
  $('#m').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) submit(); };
}
const chk = () => { const ok = !!(S.f.desc.trim() && +S.f.amt > 0), b = $('#save'); if (b) { b.classList.toggle('on', ok); b.textContent = ok ? '記下來 ✨' : '先填品項和金額喔'; } };

function submit() {
  const f = S.f; if (!(f.desc.trim() && +f.amt > 0)) return;
  const minor = Number(toMinor(f.amt, f.cur)), rate = String(toMicro(S.trip.rates[f.cur]));
  S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1;
  S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'expense', desc: f.desc.trim(), minor, cur: f.cur, rate, twdMicro: String(twdMicro(minor, f.cur, rate)),
    payer: f.payer, shares: [...f.shares], method: f.method, cat: f.cat, date: today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false, lock: null, wt: {} });
  f.desc = ''; f.amt = ''; persist(); navigator.vibrate?.(10); renderLog(); $('#d').focus(); toast('記好囉 🎉');
}
function act(a) {
  const f = S.f, ids = people().map(p => p.id), mem = S.trip.members.map(m => m.id), fund = S.trip.funds[0].id;
  if (a === 'go') return submit();
  if (a === 'ex') return exSheet();
  if (a === 'backup') return backupSheet();
  if (a === 'send') return sendSheet();
  if (a === 'recv') return recvSheet();
  if (a === 'newtrip') return tripSheet();
  if (a === 'newcur') return curSheet();
  if (a === 'cur') { const c = Object.keys(S.trip.rates); f.cur = c[(c.indexOf(f.cur) + 1) % c.length]; }
  if (a === 'method') f.method = f.method === 'cash' ? 'credit' : 'cash';
  if (a === 'payer') { f.payer = ids[(ids.indexOf(f.payer) + 1) % ids.length]; f.shares = [f.payer]; }
  if (a === 'shares') f.shares = f.shares.length === 1 && f.shares[0] === f.payer && f.payer !== fund ? [...mem] : f.shares[0] === fund ? [f.payer === fund ? mem[0] : f.payer] : [fund];
  renderLog(); $('#d').focus({ preventScroll: true });
}

const tw = e => String(S.rp.by[e.id]?.twdMicro ?? e.twdMicro);
const sheet = html => { const o = document.createElement('div'); o.className = 'scrim'; o.innerHTML = `<div class="sheet">${html}</div>`; document.body.append(o); o.onclick = e => { if (e.target === o) o.remove(); }; return o; };
const opts = (arr, sel) => arr.map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`).join('');
function renderLedger() {
  const live = S.entries.filter(e => !e.deleted), first = live.length ? live.map(e => e.date).sort()[0] : today();
  const days = {}; live.forEach(e => (days[e.date] ||= []).push(e));
  const dn = d => Math.round((new Date(d) - new Date(first)) / 864e5) + 1;
  const D = dupIds(S.entries), tg = e => (isPending(e, S.trip) ? ' · ⏳ 待管理員確認' : '') + (D.has(e.id) ? ' · ⚠️ 可能重複' : ''), row = e => {
    if (e.type === 'settle') return `<div class="item"><span class="ic">🤝</span><div class="t"><div>結清 ${who(e.from).avatar} → ${who(e.to).avatar}</div><small>${who(e.from).name} 還給 ${who(e.to).name}</small></div><div class="a">NT$ ${showTwd(e.twdMicro)}</div><button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button></div>`;
    if (e.type === 'exchange') return `<div class="item" data-edit="${e.id}">${ic('cat-exchange', '💱')}<div class="t"><div>換匯 ${e.cur} ${showAmt(e.minor, e.cur)}</div><small>${who(e.owner).avatar} ${who(e.owner).name} · 花 NT$ ${showTwd(e.twdMicro)}</small></div><button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button></div>`;
    const c = cats().find(x => x[0] === e.cat) || cats().at(-1), sh = S.rp.by[e.id]?.short > 0 && S.rp.wallets.some(w => w.owner === e.payer && w.cur === e.cur);
    return `<div class="item" data-edit="${e.id}">${ic('cat-' + c[0], c[1])}<div class="t"><div>${e.minor < 0 ? '↩︎ 退款 ' : ''}${esc(e.desc)}${e.lock ? ' 🔒' : ''}</div><small>${who(e.payer).avatar} ${who(e.payer).name} 付 · ${e.shares.map(i => who(i).avatar).join('')}${sh ? ' · ⚠️ 錢包不足' : ''}${tg(e)}</small></div>
      <div class="a">${e.cur} ${showAmt(e.minor, e.cur)}<br><small>≈ NT$ ${showTwd(tw(e))}</small></div><button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button></div>`;
  };
  app.innerHTML = `<h1>帳本</h1>` + (live.length ? Object.keys(days).sort().reverse().map(d => `<div class="day">Day ${dn(d)} · ${d.slice(5).replace('-', '/')}</div>` + days[d].map(row).join('')).join('') : `<div class="empty">還沒有紀錄<br>到「記帳」輸入第一筆吧</div>`);
}
function renderSettle() {
  const R = settle(counted(), e => BigInt(tw(e))), ids = Object.keys(R.p), nm = id => `${who(id).avatar} ${who(id).name}`, f = n => Math.abs(n).toLocaleString();
  const sel = ids.includes(S.sel) ? S.sel : null, cs = {};
  (sel ? [R.p[sel]] : Object.values(R.p)).forEach(q => Object.entries(q.cats).forEach(([c, v]) => cs[c] = (cs[c] || 0) + v));
  const rows = Object.entries(cs).sort((a, b) => b[1] - a[1]), sum = rows.reduce((a, r) => a + Math.max(0, r[1]), 0) || 1;
  app.innerHTML = `<h1>結算</h1><div class="item hero"><div class="t"><small>目前總花費</small><div style="font-size:1.9rem">NT$ ${R.total.toLocaleString()}</div></div><span class="ic">🧾</span></div>
   ${budgetBlock(R)}${syncNote()}<div class="day">誰該付給誰</div>` + (R.transfers.length ? R.transfers.map(t => `<div class="item"><div class="t"><div>${nm(t.from)} → ${nm(t.to)}</div></div><div class="a">NT$ ${f(t.twd)}</div><button class="pay" data-pay="${t.from}|${t.to}|${t.twd}">已結清</button></div>`).join('') : `<div class="item"><div class="t" style="text-align:center">${ids.length ? '帳已經平囉 🎉' : '還沒有花費，先去記一筆吧'}</div></div>`) +
   `<div class="day">每個人（累積後才進位一次，加總一定是 0）</div>` + ids.map(id => { const n = R.p[id].net; return `<div class="item"><span class="ic">${who(id).avatar}</span><div class="t"><div>${who(id).name}</div></div><div class="a ${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '該收' : n < 0 ? '該付' : '打平'} ${n ? 'NT$ ' + f(n) : ''}</div></div>`; }).join('') +
   `<div class="day">花費分類（約）</div><div class="tabs"><button class="${sel ? '' : 'on'}" data-sel="">全部</button>${ids.map(id => `<button class="${sel === id ? 'on' : ''}" data-sel="${id}">${who(id).avatar} ${who(id).name}</button>`).join('')}</div>` +
   (sel ? `<div class="item"><div class="t"><small>實際花費</small><div>NT$ ${R.p[sel].cons.toLocaleString()}</div></div><div class="t"><small>代墊出去</small><div>NT$ ${R.p[sel].paid.toLocaleString()}</div></div></div>` : '') +
   rows.map(([c, v]) => { const k = cats().find(x => x[0] === c) || cats().at(-1); return `<div class="item"><span class="ic">${k[1]}</span><div class="t"><div>${k[2]} <small>${Math.round(Math.max(0, v) / sum * 100)}%</small></div><div class="meter"><i style="width:${Math.max(0, v) / sum * 100}%;background:${k[3]}"></i></div></div><div class="a">NT$ ${v.toLocaleString()}</div></div>`; }).join('') + reviewBlock(R);
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
const settingsOf = t => structuredClone({ id: t.id, name: t.name, adminId: t.adminId, members: t.members, funds: t.funds, rates: t.rates, cats: t.cats, close: t.close, budget: t.budget });
const fmtT = t => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function syncBlock() {
  const st = S.dev.syncs[S.trip.id]?.members || {}, g = gaps(S.entries);
  return `<div class="day">同步</div><div class="item hero"><span class="ic">🔗</span><div class="t"><div>資料指紋 #${fingerprint(S.entries)}</div><small>${S.entries.length} 筆 · 兩支手機指紋一樣＝資料一致</small></div></div>` +
   (g.length ? `<div class="item"><div class="t"><div>⚠️ 有 ${g.reduce((a, x) => a + x.miss.length, 0)} 筆缺漏</div><small>請 ${g.map(x => esc(who(S.entries.find(e => e.deviceId === x.dev)?.author).name)).join('、')} 傳「完整」資料</small></div></div>` : '') +
   `<button class="save on" data-a="send" style="margin:6px 0">📤 傳給對方</button><button class="pay" data-a="recv">📥 收進來</button>` +
   S.trip.members.filter(m => m.id !== me()).map(m => `<div class="item"><span class="ic">${who(m.id).avatar}</span><div class="t"><div>${esc(m.name)}</div><small>${st[m.id] ? '上次收到：' + fmtT(st[m.id].t) : '還沒收過 ⚠️'}</small></div></div>`).join('');
}
function syncNote() {
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
  return `<div class="day">旅程回顧 🎞️</div><div class="item hero"><div class="t"><div>📅 最貴的一天：${bd.slice(5).replace('-', '/')}（NT$ ${bv.toLocaleString()}）</div><div>${k[1]} 最燒錢：${k[2]}</div><div>🏆 墊最多：${who(pm[0]).avatar} ${esc(who(pm[0]).name)}（NT$ ${pm[1].paid.toLocaleString()}）</div><div>🧾 共 ${ex.length} 筆、${Object.keys(d).length} 天</div></div></div>`;
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
const shrink = file => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const m = Math.min(im.width, im.height); c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 96, 96); res(c.toDataURL('image/jpeg', .72)); }; im.src = URL.createObjectURL(file); });
const used = id => S.entries.some(e => [e.payer, e.owner, e.from, e.to, ...(e.shares || [])].includes(id));
function renderSet() {
  const A = isAdmin(), t = S.trip, row = (ic, n, sub, at) => `<div class="item" ${at}><span class="ic">${ic}</span><div class="t"><div>${n}</div>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  const ppl = (k, at) => t[k].map(m => row(who(m.id).avatar, esc(m.name) + (m.id === t.adminId ? ' 👑' : ''), '', `data-pp="${k}|${m.id}"`)).join('') + (A ? `<button class="pay" data-pp="${k}|">＋ 新增</button>` : '');
  app.innerHTML = `<h1>設定</h1><div class="item hero"><span class="ic">${who(owner()).avatar}</span><div class="t"><div>這支手機是 ${esc(who(owner()).name)}${me() !== owner() ? '，代 ' + esc(who(me()).name) + ' 操作' : ''}</div><small>${A ? '👑 管理員：可以改全部' : '成員：只能改自己記的'}</small></div></div>
   ${A ? `<label class="field">代誰操作（只有管理員有這個選項）<select id="meSel">${opts(t.members.map(m => [m.id, m.name]), me())}</select></label>` : ''}${standalone() ? '' : '<div class="item"><div class="t"><small>📲 想像 App 一樣用：Safari 點分享 → 加入主畫面</small></div></div>'}${syncBlock()}${backupBlock()}<div class="day">旅程</div>` +
   S.db.trips.map(x => row(x.id === t.id ? '📍' : '🧳', esc(x.name), x.id === t.id ? '目前使用，點一下改名' : '點一下切換', `data-trip="${x.id}"`)).join('') + `<button class="pay" data-a="newtrip">＋ 新旅程</button>
   <div class="day">成員</div>${ppl('members')}<div class="day">公款</div>${ppl('funds')}<div class="day">分類</div>` + cats().map(c => row(c[1], esc(c[2]), '', `data-cc="${c[0]}"`)).join('') + (A ? `<button class="pay" data-cc="">＋ 新增</button>` : '') +
   `<div class="day">參考匯率（1 外幣 ＝ ? 台幣；只影響之後的紀錄）</div>` + Object.entries(t.rates).map(([c, r]) => `<div class="item"><div class="t"><div>${c}</div></div>${c === 'TWD' || !A ? `<div class="a">${r}</div>` : `<input class="rate" type="number" step="any" data-rate="${c}" value="${r}">`}</div>`).join('') + (A ? `<button class="pay" data-a="newcur">＋ 幣別</button>` : '') + `<div class="day">預算</div>` + row('💰', t.budget?.total ? `NT$ ${t.budget.total.toLocaleString()} · ${t.budget.days || '?'} 天` : '還沒設定', A ? '點一下修改' : '', 'data-bud=""');
}
function personSheet(kind, id) {
  if (!isAdmin()) return toast(DENY);
  const list = S.trip[kind], p = list.find(x => x.id === id) || { id: (kind === 'funds' ? 'f' : 'm') + uid(), name: '', avatar: kind === 'funds' ? '🍔' : '🙂', _new: 1 }; let img = p.img;
  const o = sheet(`<h2>${kind === 'funds' ? '公款' : '成員'}</h2><label>名字<input id="pn" value="${esc(p.name)}"></label><label>表情符號<input id="pe" value="${esc(p.avatar)}"></label><label>或用照片（自動縮小）<input id="pf" type="file" accept="image/*"></label>
   ${p.img ? '<button class="pay" id="pr">移除照片</button>' : ''}<button class="save on" id="pok">存好 ✨</button>${!p._new && kind === 'members' && p.id !== S.trip.adminId ? '<button class="pay" id="pa">設為管理員 👑</button>' : ''}${!p._new ? '<button class="pay" id="pd" style="background:#fee2e2;color:#be123c">刪除</button>' : ''}`);
  const q = k => o.querySelector(k), end = m => { persist(); o.remove(); render(); toast(m); };
  q('#pf').onchange = async e => { if (e.target.files[0]) { img = await shrink(e.target.files[0]); toast('照片好了 📷'); } };
  if (q('#pr')) q('#pr').onclick = () => { img = null; q('#pr').remove(); };
  q('#pok').onclick = () => { const n = q('#pn').value.trim(); if (!n) return; Object.assign(p, { name: n, avatar: q('#pe').value.trim() || '🙂', img: img || undefined }); delete p._new; if (!list.includes(p)) list.push(p); end('存好囉 ✨'); };
  if (q('#pa')) q('#pa').onclick = () => { S.trip.adminId = p.id; end('管理員換人了 👑'); };
  if (q('#pd')) q('#pd').onclick = () => { if (p.id === S.trip.adminId || list.length <= 1) return toast('管理員和最後一個不能刪'); if (used(p.id)) return toast('已有紀錄用到，不能刪'); list.splice(list.indexOf(p), 1); end('刪掉了'); };
}
function catSheet(id) {
  if (!isAdmin()) return toast(DENY);
  S.trip.cats ||= CATS.map(c => [...c]); const L = S.trip.cats, c = L.find(x => x[0] === id) || ['c' + uid(), '📦', '', '#E5E7EB', 1];
  const o = sheet(`<h2>分類</h2><label>名字<input id="cn" value="${esc(c[2])}"></label><label>表情符號<input id="ce" value="${esc(c[1])}"></label><label>顏色<input id="cc" type="color" value="${c[3].length === 7 ? c[3] : '#E5E7EB'}"></label><button class="save on" id="cok">存好 ✨</button>${c[4] ? '' : '<button class="pay" id="cd" style="background:#fee2e2;color:#be123c">刪除（舊紀錄會變「雜支」）</button>'}`);
  const end = m => { persist(); o.remove(); render(); toast(m); };
  o.querySelector('#cok').onclick = () => { const n = o.querySelector('#cn').value.trim(); if (!n) return; c[1] = o.querySelector('#ce').value.trim() || '📦'; c[2] = n; c[3] = o.querySelector('#cc').value; if (c[4]) { delete c[4]; L.push(c); } end('存好囉 ✨'); };
  if (o.querySelector('#cd')) o.querySelector('#cd').onclick = () => { if (L.length <= 2) return toast('至少留兩個分類'); L.splice(L.indexOf(c), 1); end('刪掉了'); };
}
function curSheet() {
  const o = sheet(`<h2>新增幣別</h2><label>代碼（例：JPY）<input id="kc" maxlength="4"></label><label>1 外幣 ＝ ? 台幣<input id="kr" type="number" step="any" inputmode="decimal"></label><button class="save on" id="kok">加進去 ✨</button>`);
  o.querySelector('#kok').onclick = () => { const c = o.querySelector('#kc').value.trim().toUpperCase(), r = +o.querySelector('#kr').value; if (!c || !(r > 0)) return; S.trip.rates[c] = r; persist(); o.remove(); render(); };
}
function tripSheet(id) {
  const cur = id && S.db.trips.find(x => x.id === id);
  const o = sheet(`<h2>${cur ? '旅程改名' : '新旅程'}</h2><label>名字<input id="tn" value="${cur ? esc(cur.name) : ''}" placeholder="例：波士尼亞 2026"></label>${cur && S.db.trips.length > 1 ? '<button class="pay" id="trm" style="background:#fee2e2;color:#be123c">從這支手機移除</button>' : ''}${cur ? '' : '<label class="chk"><input type="checkbox" id="tc" checked> 沿用目前的成員、公款、幣別、分類</label>'}<button class="save on" id="tok">${cur ? '存好' : '出發 🧳'}</button>`);
  if (o.querySelector('#trm')) o.querySelector('#trm').onclick = async e => {
    if (!e.target.dataset.sure) { e.target.dataset.sure = 1; return e.target.textContent = '再按一次確認（只影響這支手機，記得先備份）'; }
    const next = S.db.trips.find(x => x.id !== cur.id); await save('entries:' + cur.id, []); S.db.trips = S.db.trips.filter(x => x.id !== cur.id); delete S.dev.meBy[cur.id]; delete S.dev.ownerBy[cur.id];
    S.trip = next; S.db.cur = next.id; S.entries = await load('entries:' + next.id, []); resetForm(); await persist(); o.remove(); render(); toast('已移除 🗑️');
  };
  o.querySelector('#tok').onclick = async () => {
    const n = o.querySelector('#tn').value.trim() || '新旅程'; if (cur) { cur.name = n; persist(); o.remove(); return render(); }
    const t = newTrip(); t.name = n; if (o.querySelector('#tc').checked) { const c = structuredClone(S.trip); Object.assign(t, { members: c.members, funds: c.funds, rates: c.rates, cats: c.cats, adminId: owner() }); } S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = t.adminId;
    S.db.trips.push(t); o.remove(); await switchTrip(t.id);
  };
}
async function switchTrip(id) {
  await persist(); S.db.cur = id; S.trip = S.db.trips.find(t => t.id === id); S.entries = await load('entries:' + id, []); resetForm(); await persist(); S.page = 'set'; render(); toast('已切換 🧳');
}
function renderWallet() {
  const ws = S.rp.wallets;
  app.innerHTML = `<h1>錢包</h1><button class="save on" data-a="ex" style="margin-bottom:14px">＋ 換匯，存進錢包</button>` + (ws.length ? ws.map(w => `<div class="item"><span class="ic">${who(w.owner).avatar}</span><div class="t"><div>${w.cur} ${showAmt(w.left, w.cur)}</div><small>${who(w.owner).name} · 原 ${showAmt(w.init, w.cur)} · @${(Number(w.rate) / 1e6).toFixed(3)} · ${w.date.slice(5).replace('-', '/')}</small></div>${w.left <= 0 ? '<small>用完了</small>' : `<button class="pay" style="width:auto;margin:0" data-chk="${w.id}">核對</button>`}</div>`).join('') : `<div class="empty">還沒有錢包<br>換匯後，現金會存在這裡</div>`);
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
   <label>付款人<select id="ep">${opts(people().map(p => [p.id, p.avatar + ' ' + p.name]), e.payer)}</select></label>${e.method === 'cash' && e.minor > 0 ? `<label>從哪個錢包扣<select id="ew">${opts([['', '自動（舊的先扣）'], ...S.rp.wallets.filter(w => w.owner === e.payer && w.cur === e.cur).map(w => [w.id, w.date.slice(5).replace('-', '/') + ' @' + (Number(w.rate) / 1e6).toFixed(2)])], e.pin || '')}</select></label>` : ''}<div class="day">分攤（份數可調，0.5 份＝一半）</div><div id="chips"></div>
   <label class="chk"><input type="checkbox" id="er" ${e.minor < 0 ? 'checked' : ''}> 這是退款</label><label class="chk"><input type="checkbox" id="el" ${e.lock ? 'checked' : ''}> 🔒 鎖定台幣金額</label><button class="save on" id="eok">存好 ✨</button>`);
  const chips = () => o.querySelector('#chips').innerHTML = people().map(p => `<div class="chip ${sh.has(p.id) ? 'on' : ''}"><button data-t="${p.id}">${who(p.id).avatar} ${p.name}</button>${sh.has(p.id) ? `<button data-m="${p.id}">−</button><b>${g(p.id) / 2}</b><button data-p="${p.id}">＋</button>` : ''}</div>`).join('');
  chips(); o.querySelector('#chips').onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.t) sh.has(d.t) ? sh.size > 1 && sh.delete(d.t) : sh.add(d.t); if (d.m) wt[d.m] = Math.max(1, g(d.m) - 1); if (d.p) wt[d.p] = g(d.p) + 1; chips(); };
  o.querySelector('#eok').onclick = () => {
    const v = k => o.querySelector('#' + k), m = Number(toMinor(v('em').value || 0, e.cur)); if (!(m > 0) || !v('ed').value.trim()) return;
    Object.assign(e, { desc: v('ed').value.trim(), minor: v('er').checked ? -m : m, date: v('ea').value || e.date, cat: v('ec').value, payer: v('ep').value, shares: [...sh], wt: Object.fromEntries([...sh].map(i => [i, g(i)])), lock: null, updatedAt: Date.now(), by: owner() });
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
  const b = e.target.closest('[data-go],[data-a],[data-cat],[data-del],[data-edit],[data-pay],[data-sel],[data-pp],[data-cc],[data-trip],[data-chk],[data-bud]'); if (!b) return;
  if (b.dataset.go) { S.page = b.dataset.go; render(); } else if (b.dataset.a) act(b.dataset.a);
  else if (b.dataset.cat) { S.f.cat = b.dataset.cat; navigator.vibrate?.(10); renderLog(); } else if (b.dataset.chk) chkSheet(b.dataset.chk); else if (b.dataset.bud !== undefined) budSheet(); else if (b.dataset.pp !== undefined) personSheet(...b.dataset.pp.split('|')); else if (b.dataset.cc !== undefined) catSheet(b.dataset.cc); else if (b.dataset.trip) { b.dataset.trip === S.trip.id ? (isAdmin() ? tripSheet(b.dataset.trip) : toast(DENY)) : switchTrip(b.dataset.trip); } else if (b.dataset.pay) pay(...b.dataset.pay.split('|')); else if (b.dataset.sel !== undefined) { S.sel = b.dataset.sel || null; render(); } else if (b.dataset.edit) editSheet(b.dataset.edit); else del(b.dataset.del);
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
  S.dev.ownerBy ||= {}; for (const t of S.db.trips) S.dev.ownerBy[t.id] ??= S.dev.meBy[t.id] ?? t.adminId;
  resetForm(); render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const ask = w => toast('有新版本 ✨', () => w.postMessage('skip'), '更新', 60000);
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); }); });
    });
    let rl; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!rl) { rl = 1; location.reload(); } });
  }
  setTimeout(() => { if (S.entries.length && Date.now() - (S.dev.lastBackup || 0) > 3 * 864e5) toast('💾 好幾天沒備份了', () => { S.page = 'set'; render(); }, '去備份', 7000); }, 2000);
})();
