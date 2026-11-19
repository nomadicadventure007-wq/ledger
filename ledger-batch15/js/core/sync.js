// 同步核心：純函式，無 DOM。規則：同一筆取勝者＝管理員的版本優先；否則較晚修改者；再平手以裝置編號決定（全序，所以合併順序不影響結果）。
export const FMT = 1;
export const winner = (a, b, adminId) => {
  const A = a.by === adminId, B = b.by === adminId; if (A !== B) return A ? a : b;
  if ((a.updatedAt ?? 0) !== (b.updatedAt ?? 0)) return (a.updatedAt ?? 0) > (b.updatedAt ?? 0) ? a : b;
  return (a.deviceId || '') >= (b.deviceId || '') ? a : b;
};
export function merge(local, incoming, { adminId } = {}) {
  const map = new Map(local.map(e => [e.id, e])), st = { added: 0, updated: 0, conflicts: 0, same: 0 };
  for (const inc of incoming) {
    const cur = map.get(inc.id);
    if (!cur) { map.set(inc.id, { ...inc }); st.added++; continue; }
    const w = winner(cur, inc, adminId);
    if (w === inc && (inc.updatedAt !== cur.updatedAt || inc.deleted !== cur.deleted || inc.approved !== cur.approved || inc.by !== cur.by || inc.deviceId !== cur.deviceId)) { map.set(inc.id, { ...inc }); st.updated++; } else st.same++;
    if (cur.updatedAt !== inc.updatedAt && cur.by !== inc.by) st.conflicts++;
  }
  return { entries: [...map.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || (a.id < b.id ? -1 : 1)), stats: st };
}
export function fingerprint(entries) {
  const s = [...entries].sort((a, b) => (a.id < b.id ? -1 : 1)).map(e => `${e.id}:${e.updatedAt}:${e.deleted ? 1 : 0}:${e.approved ? 1 : 0}`).join('|');
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-4);
}
// 每台裝置的序號應連續；缺號代表漏收了某一包。
export function gaps(entries) {
  const by = {}; for (const e of entries) if (e.sq != null && e.deviceId) (by[e.deviceId] ??= new Set()).add(e.sq);
  return Object.entries(by).map(([dev, s]) => { const mx = Math.max(...s), miss = []; for (let i = 1; i <= mx; i++) if (!s.has(i)) miss.push(i); return { dev, miss }; }).filter(x => x.miss.length);
}
// 結清後，非管理員補記「結清日以前」的消費 → 待管理員確認，不計入結算。
export const isPending = (e, trip) => !!(trip.close && e.type === 'expense' && !e.deleted && !e.approved && e.author !== trip.adminId && (e.sts ?? e.ts ?? 0) > trip.close.at && e.date <= trip.close.until);
// 可能重複：同日、同幣別、同金額、同付款人、品項相似，且是不同人記的。
export function dupIds(entries) {
  const g = {}, n = s => String(s || '').toLowerCase().replace(/\s/g, '');
  for (const e of entries) if (e.type === 'expense' && !e.deleted) (g[`${e.date}|${e.cur}|${e.minor}|${e.payer}`] ??= []).push(e);
  const out = new Set();
  for (const L of Object.values(g)) for (const a of L) for (const b of L) if (a.id !== b.id && a.author !== b.author && (n(a.desc).includes(n(b.desc)) || n(b.desc).includes(n(a.desc)))) { out.add(a.id); out.add(b.id); }
  return out;
}
