import { twdMicro } from './money.js';
export function replay(entries) {
  const T = e => e.ts ?? e.updatedAt ?? 0, live = entries.filter(e => !e.deleted).sort((a, b) => a.date.localeCompare(b.date) || T(a) - T(b));
  const wallets = live.filter(e => e.type === 'exchange').map(e => ({ id: e.id, owner: e.owner, cur: e.cur, init: e.minor, left: e.minor, rate: BigInt(e.rate), date: e.date, ts: T(e) }));
  const by = {};
  for (const e of live) {
    if (e.type !== 'expense' || e.method !== 'cash') continue;
    if (e.minor < 0) {
      let back = -e.minor, tw = 0n;
      for (const w of wallets.filter(w => w.owner === e.payer && w.cur === e.cur && (w.date < e.date || (w.date === e.date && w.ts <= T(e)))).reverse()) { if (back <= 0) break; const t = Math.min(w.init - w.left, back); if (t <= 0) continue; w.left += t; back -= t; tw += twdMicro(t, e.cur, w.rate); }
      if (back > 0) tw += twdMicro(back, e.cur, BigInt(e.rate));
      by[e.id] = { twdMicro: e.lock ? BigInt(e.lock) : -tw, ded: [], short: 0 }; continue;
    }
    let need = e.minor, tw = 0n; const ded = [];
    const ws = wallets.filter(w => w.owner === e.payer && w.cur === e.cur && w.left > 0 && (w.date < e.date || (w.date === e.date && w.ts <= T(e))));
    const i = ws.findIndex(w => w.id === e.pin); if (i > 0) ws.unshift(...ws.splice(i, 1));
    for (const w of ws) { if (need <= 0) break; const t = Math.min(w.left, need); w.left -= t; need -= t; tw += twdMicro(t, e.cur, w.rate); ded.push({ w: w.id, t }); }
    if (need > 0) tw += twdMicro(need, e.cur, BigInt(e.rate));
    by[e.id] = { twdMicro: e.lock ? BigInt(e.lock) : tw, ded, short: need };
  }
  return { wallets, by };
}
