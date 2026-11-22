import { closePending, isPending, needsReview } from '../../core/sync.js';
import { dec, showAmt, twdMicro } from '../../core/money.js';
import { RATE_FACTOR, rateGapPct, reviewNote, tolOf } from '../../core/rules.js';
import { uid } from '../../core/model.js';
import { replay } from '../../core/wallet.js';
import { callAdmin } from '../../features/admin.js';
import { persist } from '../../features/sync.js';
import { S, can, canPayer, cats, isAdmin, markReview, me, owner, people, tw } from '../../state.js';
import { dupToForm } from '../pages/log.js';
import { render } from '../render.js';
import { esc, mn, opts, sheet, toast, today, warnReview, who, html, setHtml } from '../util.js';

export function exSheet(e0) {
  const o = sheet(html`<h2>🏦 換匯</h2><label>誰換的<select id="xo">${opts(people().filter(p => canPayer(p.id) || p.id === e0?.owner).map(p => [p.id, p.avatar + ' ' + p.name]), e0?.owner ?? me())}</select></label>
   <label>幣別<select id="xc">${opts(Object.keys(S.trip.rates).filter(c => c !== 'TWD').map(c => [c, c]), e0?.cur ?? S.f.cur)}</select></label>
   <label>換到多少外幣<input id="xm" type="number" step="any" inputmode="decimal" value="${e0 ? e0.minor / 10 ** dec(e0.cur) : ''}"></label><label>花了多少台幣<input id="xt" type="number" step="any" inputmode="decimal" value="${e0 ? Number(e0.twdMicro) / 1e6 : ''}"></label><label>日期<input id="xd" type="date" value="${e0?.date ?? today()}"></label>
   <small id="xh"></small><button class="save on" id="xok">存進錢包 💰</button>`);
  const calc = () => { const v = k => o.querySelector('#' + k).value, cur = v('xc'), m = mn(v('xm') || 0, cur), t = BigInt(Math.round((+v('xt') || 0) * 1e6)); return m > 0 && t > 0n ? { cur, m, t, rate: (t * 10n ** BigInt(dec(cur)) + BigInt(m) / 2n) / BigInt(m) } : null; };
  const hint = () => { const c = calc(), h = o.querySelector('#xh'); if (!c) { h.textContent = ''; return; } const g = rateGapPct(c.cur, c.rate, S.trip), bad = g != null && Math.abs(g) > tolOf(S.trip) * RATE_FACTOR; h.className = bad ? 'warn' : ''; h.textContent = `換算匯率 ${(Number(c.rate) / 1e6).toFixed(4)}${g == null ? '' : '，和參考匯率差 ' + (g > 0 ? '+' : '') + g.toFixed(1) + '%'}${bad && !isAdmin() ? ' ⚠️ 差太多了，會請管理員確認（金額有打錯嗎？）' : ''}`; };
  o.addEventListener('input', hint); o.addEventListener('change', hint); hint();
  o.querySelector('#xok').onclick = () => {
    const c = calc(); if (!c) return toast('金額格式不對，或還沒填完');
    const cur = c.cur, m = c.m, t = c.t, rate = c.rate;
    const v = k => o.querySelector('#' + k).value; if (!canPayer(v('xo')) && v('xo') !== e0?.owner) return toast('只能記自己的錢包（或公款）');
    if (e0) { Object.assign(e0, { owner: v('xo'), cur, minor: m, rate: String(rate), twdMicro: String(t), date: v('xd') || e0.date, updatedAt: Date.now(), by: owner() }); const nt = markReview(e0); persist(); o.remove(); render(); return nt ? warnReview(nt) : toast('改好囉 ✨'); }
    S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1;
    S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'exchange', owner: v('xo'), cur, minor: m, rate: String(rate), twdMicro: String(t), date: v('xd') || today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false });
    const nt = markReview(S.entries[0]); persist(); o.remove(); render(); nt ? warnReview(nt) : toast('錢包多一筆囉 💰');
  };
}
export function editSheet(id, force) {
  const e = S.entries.find(x => x.id === id); if (!e || !['expense', 'exchange'].includes(e.type)) return;
  if (isAdmin() && !force && isPending(e, S.trip)) return callAdmin('pendSheet', e); if (closePending(e, S.trip) && !isAdmin()) return toast('等管理員確認 ⏳');
  if (e.type === 'exchange') return can(e) ? exSheet(e) : toast('這筆是別人記的，只有管理員能改 🔒'); if (!can(e)) return toast('這筆是別人記的，只有管理員能改 🔒');
  const wt = { ...e.wt }, sh = new Set(e.shares), g = i => wt[i] ?? 2;
  const o = sheet(html`<h2>編輯</h2>${needsReview(e) && !isAdmin() ? html`<div class="warn">⚠️ ${reviewNote(e, S.trip)}。改回合理的值就會自動恢復；不改的話要等管理員同意才會計入。</div>` : ''}<label>品項<input id="ed" value="${e.desc}"></label><label>金額 (${e.cur})<input id="em" type="number" step="any" inputmode="decimal" value="${Math.abs(e.minor) / 10 ** dec(e.cur)}"></label>
   <label>日期<input id="ea" type="date" value="${e.date}"></label><label>分類<select id="ec">${opts(cats().map(c => [c[0], c[1] + ' ' + c[2]]), e.cat)}</select></label>
   <label>付款人<select id="ep">${opts(people().filter(p => canPayer(p.id) || p.id === e.payer).map(p => [p.id, p.avatar + ' ' + p.name]), e.payer)}</select></label>${e.method === 'cash' && e.minor > 0 ? html`<label>從哪個錢包扣<select id="ew">${opts([['', '自動（舊的先扣）'], ...S.rp.wallets.filter(w => w.owner === e.payer && w.cur === e.cur).map(w => [w.id, w.date.slice(5).replace('-', '/') + ' @' + (Number(w.rate) / 1e6).toFixed(2)])], e.pin || '')}</select></label>` : ''}<label>備註<textarea id="en" rows="3">${e.notes || ''}</textarea></label><div class="day">分攤（份數可調，0.5 份＝一半）</div><div id="chips"></div>
   <label class="chk"><input type="checkbox" id="er" ${e.minor < 0 ? 'checked' : ''}> 這是退款</label><label class="chk"><input type="checkbox" id="el" ${e.lock ? 'checked' : ''}> 🔒 鎖定台幣金額</label><button class="pay" id="edup">⎘ 複製這筆到記帳頁</button><button class="save on" id="eok">存好 ✨</button>`);
  const chips = () => setHtml(o.querySelector('#chips'), people().map(p => html`<div class="chip ${sh.has(p.id) ? 'on' : ''}"><button data-t="${p.id}">${who(p.id).avatar} ${p.name}</button>${sh.has(p.id) ? html`<button data-m="${p.id}" aria-label="減少 ${p.name} 的份數">−</button><b>${g(p.id) / 2}</b><button data-p="${p.id}" aria-label="增加 ${p.name} 的份數">＋</button>` : ''}</div>`));
  o.querySelector('#edup').onclick = () => { o.remove(); dupToForm(e.id); };
  chips(); o.querySelector('#chips').onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.t) sh.has(d.t) ? sh.size > 1 && sh.delete(d.t) : sh.add(d.t); if (d.m) wt[d.m] = Math.max(1, g(d.m) - 1); if (d.p) wt[d.p] = g(d.p) + 1; chips(); };
  o.querySelector('#eok').onclick = () => {
    const v = k => o.querySelector('#' + k), m = mn(v('em').value || 0, e.cur); if (!v('ed').value.trim()) return; if (!(m > 0)) return toast('金額格式不對');
    if (!canPayer(v('ep').value) && v('ep').value !== e.payer) return toast('成員只能記自己付的（或公款付的）');
    Object.assign(e, { desc: v('ed').value.trim(), notes: v('en').value.trim(), minor: v('er').checked ? -m : m, date: v('ea').value || e.date, cat: v('ec').value, payer: v('ep').value, shares: [...sh], wt: Object.fromEntries([...sh].map(i => [i, g(i)])), lock: null, updatedAt: Date.now(), by: owner() });
    e.pin = o.querySelector('#ew')?.value || undefined; e.twdMicro = String(twdMicro(e.minor, e.cur, e.rate)); S.rp = replay(S.entries); if (v('el').checked) e.lock = tw(e);
    const nt = markReview(e); persist(); o.remove(); render(); nt ? warnReview(nt) : toast('改好囉 ✨');
  };
}
export function del(id) {
  const e = S.entries.find(x => x.id === id); if (!can(e)) return toast('這筆是別人記的，只有管理員能刪 🔒'); e.deleted = true; e.updatedAt = Date.now(); e.by = owner(); persist(); render();
  toast('已刪除', () => { e.deleted = false; e.updatedAt = Date.now(); e.by = owner(); persist(); render(); });
}
