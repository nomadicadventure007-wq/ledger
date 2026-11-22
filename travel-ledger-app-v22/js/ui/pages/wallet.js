import { needsReview } from '../../core/sync.js';
import { showAmt } from '../../core/money.js';
import { S, canAct, cats } from '../../state.js';
import { app, ic, who, html, setHtml } from '../util.js';

export function renderWallet() {
  const ws = S.rp.wallets;
  setHtml(app, html`${html`<h1>錢包</h1><button class="save on" data-a="ex" style="margin-bottom:14px">＋ 換匯，存進錢包</button>${(n => n ? html`<div class="warn">⏳ 有 ${n} 筆換匯等管理員確認，確認後才會出現在錢包</div>` : '')(S.entries.filter(e => e.type === 'exchange' && needsReview(e)).length)}`}${(ws.length ? html`${html`<div class="wlist">`}${ws.map(w => {
    const open = S.wx === w.id, tx = open ? S.entries.filter(e => !e.deleted && S.rp.by[e.id]?.ded?.some(d => d.w === w.id)).sort((a, b) => b.date.localeCompare(a.date) || (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 20) : [];
    return html`${html`<div class="item wcard ${open ? 'open' : ''}"><div class="wrow" data-wx="${w.id}"><span class="ic">${who(w.owner).avatar}</span><div class="t"><small>${w.cur} 💰</small><div class="bal">${showAmt(w.left, w.cur)}</div></div><div class="a"><small>Rate: ${(Number(w.rate) / 1e6).toFixed(2)}</small><br>${canAct(S.entries.find(x => x.id === w.id) || {}) ? html`<button class="del" data-del="${w.id}" aria-label="刪除">🗑️</button>` : ''}</div></div>`}${(open ? html`<div class="wtx"><div class="wh"><span>初始：${showAmt(w.init, w.cur)}</span><span>近 20 筆支出</span></div>${tx.length ? tx.map(e => { const c = cats().find(x => x[0] === e.cat) || cats().at(-1), d = S.rp.by[e.id].ded.filter(x => x.w === w.id).reduce((a, x) => a + x.t, 0); return html`<div class="tx">${ic('cat-' + c[0], c[1])}<div class="t"><div>${e.desc}</div><small>${e.date.slice(5).replace('-', '/')}</small></div><b>−${showAmt(d, e.cur)}</b></div>`; }) : html`<div class="empty" style="padding:12px">無扣款紀錄</div>`}${w.left > 0 ? html`<button class="pay" data-chk="${w.id}" style="margin-top:10px">核對現金</button>` : ''}</div>` : '')}${html`</div>`}`;
  })}${html`</div>`}` : html`<div class="empty">還沒有錢包</div>`)}`);
}
