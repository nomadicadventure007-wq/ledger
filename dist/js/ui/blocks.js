import { fingerprint } from '../core/sync.js';
import { showAmt } from '../core/money.js';
import { cl } from '../features/sync.js';
import { S, counted, me, tw } from '../state.js';
import { who, html } from './util.js';

export function syncNote() {
  const c = cl(); if (c) { const lack = S.trip.members.filter(m => m.id !== me() && !(c.members || []).some(x => x.id === m.id && x.joined)); return html`${html`<div class="day">資料指紋 #${fingerprint(S.entries)}</div>`}${(lack.length ? html`<div class="item"><div class="t"><small>⚠️ ${lack.map(m => m.name).join('、')} 還沒加入雲端，結算可能不完整</small></div></div>` : '')}`; }
  const st = S.dev.syncs[S.trip.id]?.members || {}, lack = S.trip.members.filter(m => m.id !== me() && !st[m.id]);
  return html`${html`<div class="day">資料指紋 #${fingerprint(S.entries)}</div>`}${(lack.length ? html`<div class="item"><div class="t"><small>⚠️ 還沒收過 ${lack.map(m => m.name).join('、')} 的資料，結算可能不完整</small></div></div>` : '')}`;
}
export function catDetails(c, sel) {
  const L = counted().filter(e => e.type === 'expense' && e.cat === c && (!sel || e.shares.includes(sel))).sort((a, b) => b.date.localeCompare(a.date) || (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 20);
  return html`${html`<div class="mcd"><div class="wh"><span>${sel ? who(sel).name + ' 的份額' : '全部'}</span><span>近 ${L.length} 筆</span></div>`}${(L.map(e => { const W = e.shares.reduce((a, i) => a + (e.wt?.[i] ?? 2), 0), w = sel ? (e.wt?.[sel] ?? 2) : W, sm = Math.round(e.minor * w / W), twd = Math.round(Number(BigInt(tw(e))) / 1e6 * w / W);
    return html`<div class="tx"><div class="t"><div>${e.desc}</div><small>${e.date.slice(5).replace('-', '/')} · ≈ NT$ ${twd.toLocaleString()}</small></div><span>${e.cur} ${showAmt(sm, e.cur)}</span></div>`; }) || html`<div class="empty" style="padding:10px">沒有紀錄</div>`)}${html`</div>`}`;
}

export const badBlock = () => (S.bad?.length ? html`<div class="warn">⚠️ 有 ${S.bad.length} 筆資料格式壞掉，沒有計入結算。<br><button class="pay" data-a="bad" style="margin-top:8px">查看</button></div>` : '');
