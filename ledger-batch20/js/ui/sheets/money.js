import { isAmt, showAmt, toMicro, twdMicro } from '../../core/money.js';
import { uid } from '../../core/model.js';
import { persist } from '../../features/sync.js';
import { DENY, S, cats, isAdmin, me, owner } from '../../state.js';
import { render } from '../render.js';
import { mn, sheet, toast, today, who, html } from '../util.js';

export function budSheet() {
  if (!isAdmin()) return toast(DENY); const b = S.trip.budget || {};
  const o = sheet(html`<h2>💰 預算</h2><label>總預算（台幣）<input id="bt" type="number" inputmode="decimal" value="${b.total || ''}"></label><label>旅程天數<input id="bd" type="number" inputmode="numeric" value="${b.days || ''}"></label><button class="save on" id="bok">存好 ✨</button>`);
  o.querySelector('#bok').onclick = () => { S.trip.budget = { total: Math.round(+o.querySelector('#bt').value) || 0, days: Math.round(+o.querySelector('#bd').value) || 0 }; persist(); o.remove(); render(); };
}
export function chkSheet(id) {
  const w = S.rp.wallets.find(x => x.id === id); if (!w) return;
  const o = sheet(html`<h2>💵 現金核對</h2><div class="item"><div class="t"><div>系統記錄剩 ${w.cur} ${showAmt(w.left, w.cur)}</div><small>${who(w.owner).name} 的錢包</small></div></div><label>皮夾實際剩多少？<input id="ca" type="number" step="any" inputmode="decimal"></label><button class="save on" id="cok">核對</button>`);
  o.querySelector('#cok').onclick = () => {
    const v = o.querySelector('#ca').value; if (v === '') return; if (!isAmt(v)) return toast('金額格式不對'); const diff = w.left - mn(v, w.cur); o.remove();
    if (diff <= 0) return toast(diff < 0 ? '實際比記錄多，可能漏記換匯 🤔' : '剛好吻合 🎉');
    const rate = String(toMicro(S.trip.rates[w.cur] || 1)); S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1;
    S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'expense', desc: '現金核對差額', minor: diff, cur: w.cur, rate, twdMicro: String(twdMicro(diff, w.cur, rate)), payer: w.owner, shares: [w.owner], method: 'cash', cat: cats().at(-1)[0], pin: w.id, date: today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false, lock: null, wt: {} });
    persist(); render(); toast('差額記成雜支了 🧾');
  };
}
