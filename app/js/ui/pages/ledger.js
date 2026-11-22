import { closePending, dupIds, isPending, needsReview } from '../../core/sync.js';
import { showAmt, showTwd } from '../../core/money.js';
import { slot } from '../../features/admin.js';
import { S, canAct, cats, isAdmin, isPrivate, people, tw } from '../../state.js';
import { $, app, ic, today, who, html, setHtml } from '../util.js';

export const HF = ['type', 'cat', 'payer', 'method', 'curr', 'kind'], KINDS = ['種類', '支出', '退款', '換匯', '結清'];
export const hfLen = () => ({ type: 3, cat: 1 + cats().length, payer: 1 + people().length, method: 3, curr: 1 + Object.keys(S.trip.rates).length, kind: 5 });
const hay = e => [e.desc, e.notes, cats().find(x => x[0] === e.cat)?.[2], who(e.payer ?? e.owner ?? e.from).name].filter(Boolean).join(' ').toLowerCase();
export function renderLedger() {
  const hf = S.hf ||= { type: 0, cat: 0, payer: 0, method: 0, curr: 0, kind: 0, start: '', end: '' }, P = people(), C = cats(), K = Object.keys(S.trip.rates), cc = C[hf.cat - 1], pp = P[hf.payer - 1];
  hf.kind ??= 0; hf.start ??= ''; hf.end ??= ''; hf.q ??= '';
  const pass = e => (!hf.type || (e.type === 'expense' && (hf.type === 1) === isPrivate(e)))
    && (!hf.kind || (hf.kind === 1 && e.type === 'expense' && e.minor > 0) || (hf.kind === 2 && e.type === 'expense' && e.minor < 0) || (hf.kind === 3 && e.type === 'exchange') || (hf.kind === 4 && e.type === 'settle'))
    && (!hf.cat || e.cat === cc?.[0]) && (!hf.payer || (e.payer ?? e.owner ?? e.from) === pp?.id) && (!hf.method || e.method === ['cash', 'credit'][hf.method - 1]) && (!hf.curr || e.cur === K[hf.curr - 1]) && (!hf.start || e.date >= hf.start) && (!hf.end || e.date <= hf.end) && (!hf.q || hay(e).includes(hf.q.toLowerCase()));
  const all = S.entries.filter(e => !e.deleted), live = S.histList = all.filter(pass), first = all.length ? all.map(e => e.date).sort()[0] : today();
  const found = Math.round(live.filter(e => e.type === 'expense').reduce((a, e) => a + Number(BigInt(tw(e)) / 1000000n), 0));
  const lb = { type: hf.type ? ['', '私帳', '公帳'][hf.type] : '公/私', cat: hf.cat && cc ? ic('cat-' + cc[0], cc[1]) : '分類', payer: hf.payer && pp ? who(pp.id).avatar : '支付', method: hf.method ? ['', '現金', '信用卡'][hf.method] : '方式', curr: hf.curr ? K[hf.curr - 1] : '幣別', kind: KINDS[hf.kind] };
  const pend = isAdmin() ? S.entries.filter(e => isPending(e, S.trip)) : [], pendIds = new Set(pend.map(e => e.id)); // 只有管理員看得到置頂的待確認區；置頂的就不再重複出現在下面的日期清單
  const days = {}; live.filter(e => !pendIds.has(e.id)).forEach(e => (days[e.date] ||= []).push(e));
  const dn = d => Math.round((new Date(d) - new Date(first)) / 864e5) + 1;
  const D = dupIds(S.entries), tg = e => (needsReview(e) ? ' · ⏳ 金額差異較大，待管理員確認' : closePending(e, S.trip) ? ' · ⏳ 待管理員確認' : '') + (D.has(e.id) ? ' · ⚠️ 可能重複' : ''), row = e => {
    if (e.type === 'settle') return html`<div class="item"><span class="ic">🤝</span><div class="t"><div>結清 ${who(e.from).avatar} → ${who(e.to).avatar}</div><small>${who(e.from).name} 還給 ${who(e.to).name}</small></div><div class="a">NT$ ${showTwd(e.twdMicro)}</div>${canAct(e) ? html`<button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button>` : ''}</div>`;
    if (e.type === 'exchange') return html`<div class="item" ${canAct(e) ? html`data-edit="${e.id}"` : ''}>${ic('cat-exchange', '💱')}<div class="t"><div>換匯 ${e.cur} ${showAmt(e.minor, e.cur)}</div><small>${who(e.owner).avatar} ${who(e.owner).name} · 花 NT$ ${showTwd(e.twdMicro)}${tg(e)}</small></div>${canAct(e) ? html`<button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button>` : ''}</div>`;
    const c = cats().find(x => x[0] === e.cat) || cats().at(-1), sh = S.rp.by[e.id]?.short > 0 && S.rp.wallets.some(w => w.owner === e.payer && w.cur === e.cur);
    return html`<div class="item" ${canAct(e) ? html`data-edit="${e.id}"` : ''}>${ic('cat-' + c[0], c[1])}<div class="t"><div>${e.minor < 0 ? '↩︎ 退款 ' : ''}${e.desc}${e.lock ? ' 🔒' : ''}</div><small>${who(e.payer).avatar} ${who(e.payer).name} 付 · ${e.shares.map(i => who(i).avatar)}${sh ? ' · ⚠️ 錢包不足' : ''}${e.notes ? ' · 📝 ' + e.notes.slice(0, 14) : ''}${tg(e)}</small></div>
      <div class="a">${e.cur} ${showAmt(e.minor, e.cur)}<br><small>≈ NT$ ${showTwd(tw(e))}</small></div>${canAct(e) ? html`<button class="del" data-del="${e.id}" aria-label="刪除">🗑️</button>` : ''}</div>`;
  };
  setHtml(app, html`${html`<div class="two a"><div><h1>歷史</h1><input id="hq" aria-label="搜尋" class="hq" type="search" placeholder="搜尋品項、備註、分類…" autocomplete="off" value="${hf.q}"><div class="drange"><input type="date" id="hs" value="${hf.start}" aria-label="起">~<input type="date" id="he" value="${hf.end}" aria-label="迄"></div><div class="tabs"><button class="rst" data-hf="reset" aria-label="重設">↺</button>${HF.map(k => html`<button class="${hf[k] ? 'on' : ''}" data-k="${k}" data-hf="${k}">${lb[k]}</button>`)}</div><div class="found"><small>FOUND: ${live.length}</small><b>NT$ ${found.toLocaleString()}</b>${isAdmin() ? slot('histCsvBtn') : ''}</div></div><div>`}${(pend.length ? html`${slot('pendingHead', pend.length)}${pend.map(row)}` : '')}${(live.length ? Object.keys(days).sort().reverse().map(d => html`${html`<div class="day">Day ${dn(d)} · ${d.slice(5).replace('-', '/')}</div>`}${days[d].map(row)}`) : html`<div class="empty">${all.length ? '沒有符合的紀錄' : '還沒有紀錄'}</div>`)}${html`</div></div>`}`);
}
document.addEventListener('change', e => { const t = e.target; if (t.id === 'hs' || t.id === 'he') { S.hf[t.id === 'hs' ? 'start' : 'end'] = t.value; renderLedger(); } });
const hqApply = v => { S.hf.q = v; renderLedger(); const i = $('#hq'); i.focus(); i.setSelectionRange(v.length, v.length); };
document.addEventListener('input', e => { if (e.target.id === 'hq' && !e.isComposing) hqApply(e.target.value); });
document.addEventListener('compositionend', e => { if (e.target.id === 'hq') hqApply(e.target.value); });
