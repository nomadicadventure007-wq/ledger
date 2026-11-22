import { dec, showAmt, showTwd, toMicro, toMinor, twdMicro } from '../../core/money.js';
import { replay } from '../../core/wallet.js';
import { uid } from '../../core/model.js';
import { persist } from '../../features/sync.js';
import { S, canAct, canPayer, cats, counted, markReview, me, owner, recall, tw } from '../../state.js';
import { SVG } from '../nav.js';
import { render } from '../render.js';
import { $, app, ic, mn, toast, today, warnReview, who, html, setHtml } from '../util.js';

export function summary() {
  const f = S.f, rate = S.trip.rates[f.cur], m = S.trip.members.length;
  const sh = f.shares.length === 1 && f.shares[0] === f.payer ? 'Solo' : f.shares.length >= m && !f.shares.some(x => x[0] === 'f') ? 'All' : f.shares[0]?.[0] === 'f' ? 'Shared' : f.shares.length + ' 人';
  return { sh, text: html`${(f.date || today()).slice(5).replace('-', '/')}，${who(f.payer).name} 付，${f.shares.map(i => who(i).avatar)} 分攤`, sub: `${f.method === 'cash' ? '現金' : '信用卡'}，${f.cur} @${rate}${+f.amt > 0 ? ' · ≈ NT$ ' + showTwd(estTwd()) : ''}` };
}
function estTwd() {
  try { const f = S.f, minor = Number(toMinor(f.amt, f.cur)), rate = String(toMicro(S.trip.rates[f.cur])), t = { id: 'tmp', type: 'expense', method: f.method, payer: f.payer, cur: f.cur, minor, rate, date: f.date || today(), ts: Date.now(), shares: [], deleted: false };
    return replay([...counted(), t]).by.tmp?.twdMicro ?? twdMicro(minor, f.cur, rate); } catch { return 0n; }
}
function recentHtml() {
  const rc = S.entries.filter(e => !e.deleted && ['expense', 'exchange'].includes(e.type)).slice(0, 8);
  if (!rc.length) return '';
  return html`${html`<div class="recent"><div class="day">最近記的</div>`}${rc.map(e => { const ex = e.type === 'exchange', c = ex ? null : cats().find(x => x[0] === e.cat) || cats().at(-1);
    return html`<div class="item" ${canAct(e) ? html`data-edit="${e.id}"` : ''}>${ex ? ic('cat-exchange', '💱') : ic('cat-' + c[0], c[1])}<div class="t"><div>${ex ? '換匯 ' + e.cur : (e.minor < 0 ? '↩︎ ' : '') + e.desc}</div><small>${who(ex ? e.owner : e.payer).avatar} ${e.date.slice(5).replace('-', '/')}</small></div><div class="a">${e.cur} ${showAmt(e.minor, e.cur)}</div>${ex ? '' : html`<button class="del dup" data-dup="${e.id}" aria-label="複製這筆">⎘</button>`}${canAct(e) ? html`<button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button>` : ''}</div>`; })}${html`</div>`}`;
}
export function renderLog() {
  if (!cats().some(c => c[0] === S.f.cat)) S.f.cat = cats()[0][0];
  const f = S.f, s = summary(), ok = f.desc.trim() && mn(f.amt, f.cur) > 0, py = who(f.payer);
  setHtml(app, html`<div class="lg"><div class="top"><div class="r1"><input id="d" aria-label="品項" class="pill" placeholder="Loot ✨" enterkeyhint="next" value="${f.desc}"><button class="cur" data-a="cur">${f.cur}</button></div>
   <div class="r2"><input id="m" aria-label="金額" class="pill amt" type="number" step="any" inputmode="decimal" enterkeyhint="done" placeholder="Poof 💸" value="${f.amt}"><button id="go" class="go ${ok ? 'on' : ''}" data-a="go" aria-label="記下來">${SVG.banknote}</button></div>
   <div class="cats">${cats().map(([id, e, n, c]) => html`<button class="cat ${f.cat === id ? 'sel' : ''}" style="--c:${c}" data-cat="${id}">${ic('cat-' + id, e)}<span>${n}</span></button>`)}</div>
   <div class="rel"><div class="bar"><button data-a="payer"><small>Payer</small><b><i>${py.avatar}</i>${py.name}</b></button><button data-a="shares"><small>Shares</small><b style="color:var(--link)">${s.sh}</b></button><button data-a="method"><small>Method</small><b><i style="font-size:2.6rem">${f.method === 'cash' ? '💵' : '💳'}</i></b></button></div>
   <button class="chev" data-a="adv" aria-label="進階">${SVG.chev}</button></div></div>
   <div class="side"><div class="bubble"><div>${s.text}</div><i id="bsub">${s.sub}</i></div>${recentHtml()}</div></div>`);
  $('#d').oninput = e => { f.desc = e.target.value; chk(); };
  $('#m').oninput = e => { f.amt = e.target.value; chk(); };
  $('#d').onkeydown = e => { if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return; const m = !S.f.amt && recall(S.f.desc); if (m) { Object.assign(S.f, { amt: String(m.minor / 10 ** dec(m.cur)), cur: m.cur, cat: m.cat, payer: m.payer, shares: [...m.shares] }); renderLog(); toast('帶入上次的 ✨'); } $('#m').focus(); };
  $('#m').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) submit(); };
}
const chk = () => { $('#go')?.classList.toggle('on', !!(S.f.desc.trim() && +S.f.amt > 0)); const b = $('#bsub'); if (b) b.textContent = summary().sub; };
export function submit() {
  const f = S.f; if (!(f.desc.trim() && mn(f.amt, f.cur) > 0)) return;
  if (!canPayer(f.payer)) f.payer = me();
  const minor = mn(f.amt, f.cur), rate = String(toMicro(S.trip.rates[f.cur]));
  S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1;
  S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'expense', desc: f.desc.trim(), minor, cur: f.cur, rate, twdMicro: String(twdMicro(minor, f.cur, rate)),
    payer: f.payer, shares: [...f.shares], method: f.method, cat: f.cat, notes: f.note || '', pin: f.method === 'cash' && f.pin ? f.pin : undefined, date: f.date || today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false, lock: null, wt: {} });
  const note = markReview(S.entries[0]);
  f.desc = ''; f.amt = ''; f.note = ''; f.pin = ''; persist(); navigator.vibrate?.(10); renderLog(); $('#d').focus(); S.rp = replay(counted()); note ? warnReview(note) : toast('✓ 已記下 NT$ ' + showTwd(tw(S.entries[0])));
}
export function dupToForm(id) {
  const e = S.entries.find(x => x.id === id); if (!e || e.type !== 'expense') return;
  Object.assign(S.f, { desc: e.desc, amt: String(Math.abs(e.minor) / 10 ** dec(e.cur)), cur: e.cur, cat: e.cat, payer: canPayer(e.payer) ? e.payer : me(), shares: [...new Set(e.shares.map(x => (x === e.payer && !canPayer(e.payer) ? me() : x)))], method: e.method, note: e.notes || '', pin: '', date: e.date });
  S.page = 'log'; render(); toast('已複製到表單，改一下就能記 ⎘');
}
