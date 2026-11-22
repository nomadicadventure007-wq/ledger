import { showAmt } from '../../core/money.js';
import { S, people } from '../../state.js';
import { renderLog, summary } from '../pages/log.js';
import { today, who, html, setHtml } from '../util.js';

export function advSheet() {
  const f = S.f, snap = { shares: [...f.shares], date: f.date, pin: f.pin, note: f.note }, o = document.createElement('div'); o.className = 'layer'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', '進階設定'); o.tabIndex = -1; document.body.append(o);
  const draw = () => {
    const ws = f.method === 'cash' ? S.rp.wallets.filter(w => w.owner === f.payer && w.cur === f.cur) : [], sm = summary();
    setHtml(o, html`<div class="lh"><button id="lx">取消</button><span>ADVANCED</span><button id="lok">完成</button></div><div class="lb">
      <div class="grp"><label class="cap">成員分攤</label><div class="avs">${people().map(p => html`<div class="avc ${f.shares.includes(p.id) ? 'on' : ''}" data-t="${p.id}"><span>${who(p.id).avatar}</span><small>${p.name}</small></div>`)}</div></div>
      <label class="cap">交易日期</label><input id="ad" type="date" value="${f.date || today()}">
      ${ws.length ? html`<label class="cap">扣款錢包</label><select id="aw"><option value="">🤖 自動遞延扣款（舊錢包優先）</option>${ws.map((w, k) => html`<option value="${w.id}" ${f.pin === w.id ? 'selected' : ''}>💰 錢包 #${k + 1}（${w.cur}）餘額 ${showAmt(w.left, w.cur)}，匯率 ${(Number(w.rate) / 1e6).toFixed(2)}</option>`)}</select>` : ''}
      <label class="cap">Note</label><textarea id="an" rows="6" placeholder="Add some details…">${f.note}</textarea></div>
      <div class="lsum"><div class="bubble2"><div>${sm.text}</div><i>${sm.sub}</i></div></div>`);
  };
  draw(); document.body.style.overflow = 'hidden'; o.focus({ preventScroll: true });
  const close = () => { o.remove(); document.body.style.overflow = ''; renderLog(); };
  o.onclick = e => { const b = e.target.closest('button,[data-t]'); if (!b) return;
    if (b.id === 'lx') { Object.assign(f, snap); return close(); } if (b.id === 'lok') return close();
    if (b.dataset.t) { const k = f.shares.indexOf(b.dataset.t); if (k >= 0) { if (f.shares.length > 1) f.shares.splice(k, 1); } else f.shares.push(b.dataset.t); draw(); } };
  o.onchange = e => { if (e.target.id === 'ad') f.date = e.target.value || undefined; else if (e.target.id === 'aw') f.pin = e.target.value; else return; draw(); };
  o.oninput = e => { if (e.target.id === 'an') f.note = e.target.value; };
}
