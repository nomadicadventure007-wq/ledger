import { closePending, isPending } from './core/sync.js';
import { CATS } from './core/model.js';
import { reviewNote, reviewOf } from './core/rules.js';
import { save, load } from './core/store.js';
import { entryProblem } from './core/validate.js';

export const S = { page: 'log', trip: null, entries: [], bad: [], dev: null, f: { desc: '', amt: '', cur: 'EUR', payer: 'm1', shares: ['m1'], method: 'cash', cat: 'food' } };
export const people = () => [...S.trip.members, ...S.trip.funds];
export const anyAdmin = () => S.db.trips.some(t => S.dev.ownerBy[t.id] === t.adminId), canAct = e => isAdmin() || (e.author === me() && !closePending(e, S.trip) && e.by !== S.trip.adminId);
export const cats = () => S.trip.cats || CATS, me = () => S.dev.meBy[S.trip.id] ?? owner(), owner = () => S.dev.ownerBy[S.trip.id] ?? S.dev.meBy[S.trip.id] ?? S.trip.adminId, isAdmin = () => owner() === S.trip.adminId, can = e => isAdmin() || e.author === me(), DENY = '這個只有管理員能改 🔒';
// 成員只能記「自己付的」或「公款付的」；管理員可以代記任何人（伺服器也是這樣擋）
export const payerIds = () => (isAdmin() ? people().map(p => p.id) : [me(), ...S.trip.funds.map(f => f.id)]), canPayer = id => payerIds().includes(id);
// 記下或改完之後呼叫：成員的紀錄若偏離太多，標上 review（跟伺服器同一套算法），並回傳一句說明；管理員的紀錄一律不標
export const markReview = e => { if (isAdmin()) { delete e.review; return ''; } const r = reviewOf(e, S.trip); if (r) { e.review = r; return reviewNote(e, S.trip); } delete e.review; return ''; };
export const resetForm = () => { S.f = { desc: '', amt: '', cur: Object.keys(S.trip.rates)[0], payer: me(), shares: [me()], method: 'cash', cat: cats()[0][0], note: '', pin: '' }; };
export const saveAll = () => Promise.all([save('db', S.db), save('entries:' + S.trip.id, S.entries), save('dev', S.dev)]);
export const tw = e => String(S.rp.by[e.id]?.twdMicro ?? e.twdMicro);
export const isPrivate = e => e.type === 'expense' && e.shares.length === 1 && e.shares[0] === e.payer && S.trip.members.some(m => m.id === e.payer);
export const settingsOf = t => structuredClone({ id: t.id, name: t.name, adminId: t.adminId, members: t.members, funds: t.funds, rates: t.rates, cats: t.cats, close: t.close, budget: t.budget, catImg: t.catImg, lockTolerance: t.lockTolerance });
export const recall = d => { d = d.trim().toLowerCase(); return d && S.entries.find(e => e.type === 'expense' && !e.deleted && e.minor > 0 && e.desc.trim().toLowerCase() === d); };
export const metaNew = () => { S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1; return { tripId: S.trip.id, author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), deleted: false }; };
export const used = id => S.entries.some(e => [e.payer, e.owner, e.from, e.to, ...(e.shares || [])].includes(id));
export const counted = () => S.entries.filter(e => !isPending(e, S.trip));

// ---- 壞紀錄隔離 ----
// 格式壞掉的紀錄（缺欄位、型別不對…）不會被刪掉，也不會參與計算或畫面，而是移到 S.bad 保管（也存進手機的 bad:旅程編號）。
// 沒有壞的就原樣回傳同一個陣列。
export function quarantine(es) {
  const keep = [], found = [];
  for (const e of es) { const why = entryProblem(e); if (why) found.push({ id: String(e?.id ?? '?').slice(0, 64), why, at: Date.now(), e }); else keep.push(e); }
  if (!found.length) return es;
  S.bad = [...(S.bad || []).filter(b => !found.some(f => f.id === b.id)), ...found].slice(-200);
  save('bad:' + S.trip.id, S.bad); if (es === S.entries) save('entries:' + S.trip.id, keep);
  return keep;
}
// 讀某趟旅程的紀錄，並把壞的隔離起來（S.trip 必須已經是那一趟）
export const loadEntries = async id => { S.bad = await load('bad:' + id, []); const es = await load('entries:' + id, []), keep = quarantine(es); if (keep !== es) save('entries:' + id, keep); return keep; };
