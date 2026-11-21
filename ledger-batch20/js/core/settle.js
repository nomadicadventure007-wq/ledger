// 結算引擎：每筆都保留精確份額(通分後的整數)，全部累積完才進位一次；進位用最大餘數法，保證每人淨額加總為 0。
const fl = (a, b) => (a >= 0n ? a / b : -((-a + b - 1n) / b)), rd = (a, b) => fl(2n * a + b, 2n * b);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function settle(entries, tw) {
  const live = entries.filter(e => !e.deleted), ex = live.filter(e => e.type === 'expense'), st = live.filter(e => e.type === 'settle');
  const wOf = (e, i) => BigInt(e.wt?.[i] ?? 2), Wt = e => e.shares.reduce((a, i) => a + wOf(e, i), 0n);
  let D = 1n; for (const e of ex) { const W = Wt(e); D = (D / gcd(D, W)) * W; }
  const P = {}, g = id => (P[id] ??= { paid: 0n, cons: 0n, adj: 0n, cats: {} }); let total = 0n;
  for (const e of ex) {
    const t = BigInt(tw(e)), f = D / Wt(e); total += t; g(e.payer).paid += t * D;
    for (const i of e.shares) { const c = t * wOf(e, i) * f, p = g(i); p.cons += c; p.cats[e.cat] = (p.cats[e.cat] ?? 0n) + c; }
  }
  for (const s of st) { const a = BigInt(s.twdMicro) * D; g(s.from).adj += a; g(s.to).adj -= a; }
  const den = D * 1000000n, ids = Object.keys(P).sort(), n = {}, r = {};
  for (const id of ids) { const x = P[id].paid - P[id].cons + P[id].adj; n[id] = fl(x, den); r[id] = x - n[id] * den; }
  let k = -ids.reduce((a, i) => a + n[i], 0n);
  [...ids].sort((a, b) => (r[b] > r[a] ? 1 : r[b] < r[a] ? -1 : a < b ? -1 : 1)).forEach(i => { if (k > 0n) { n[i] += 1n; k--; } });
  const cr = ids.filter(i => n[i] > 0n).map(i => [i, n[i]]).sort((a, b) => (b[1] > a[1] ? 1 : -1)), db = ids.filter(i => n[i] < 0n).map(i => [i, -n[i]]).sort((a, b) => (b[1] > a[1] ? 1 : -1));
  const transfers = []; let a = 0, b = 0;
  while (a < cr.length && b < db.length) {
    const m = cr[a][1] < db[b][1] ? cr[a][1] : db[b][1]; transfers.push({ from: db[b][0], to: cr[a][0], twd: Number(m) });
    cr[a][1] -= m; db[b][1] -= m; if (cr[a][1] === 0n) a++; if (db[b][1] === 0n) b++;
  }
  const p = {}; for (const id of ids) p[id] = { net: Number(n[id]), paid: Number(rd(P[id].paid, den)), cons: Number(rd(P[id].cons, den)), cats: Object.fromEntries(Object.entries(P[id].cats).map(([c, v]) => [c, Number(rd(v, den))])) };
  return { p, transfers, total: Number(rd(total, 1000000n)) };
}
