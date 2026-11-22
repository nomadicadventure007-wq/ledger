import { dec } from './money.js';
export const MAX_MEMBERS = 8, MAX_FUNDS = 4;
export const DEFAULT_TOLERANCE = 5;
export const RATE_FACTOR = 3;
export const tolOf = trip => (Number.isFinite(trip?.lockTolerance) ? trip.lockTolerance : DEFAULT_TOLERANCE);

const refOf = (o, trip) => BigInt(Math.round(Number(trip.rates?.[o.cur]) * 1e6));
const abs = x => (x < 0n ? -x : x);
function lockGap(o, trip) {
  if (o.type !== 'expense') return null;
  const claimed = o.method === 'cash' ? o.lock : o.twdMicro;
  if (claimed == null) return null;
  const p = 10n ** BigInt(dec(o.cur)), m = BigInt(o.minor), a = abs(m), exp = (m < 0n ? -1n : 1n) * ((a * BigInt(o.rate) + p / 2n) / p), c = BigInt(claimed);
  return { diff: abs(c - exp), base: abs(exp) };
}
export function reviewOf(o, trip) {
  if (o.type === 'settle' || !(Number(trip.rates?.[o.cur]) > 0)) return '';
  const tol = BigInt(Math.round(tolOf(trip) * 100)), ref = refOf(o, trip), rate = BigInt(o.rate), why = [];
  if (abs(rate - ref) * 10000n > ref * tol * BigInt(RATE_FACTOR)) why.push('rate');
  const g = lockGap(o, trip);
  if (g && g.diff * 10000n > g.base * tol) why.push('lock');
  return why.join(',');
}
export const rateGapPct = (cur, rateMicro, trip) => { const ref = refOf({ cur }, trip); return ref > 0n ? Number((BigInt(rateMicro) - ref) * 100000n / ref) / 1000 : null; };
export function lockGapPct(o, trip) { const g = lockGap(o, trip); return g && g.base > 0n ? Number(g.diff * 100000n / g.base) / 1000 : null; }
export function reviewNote(o, trip) {
  const r = (o.review ?? reviewOf(o, trip)).split(','), tol = tolOf(trip), out = [];
  if (r.includes('lock')) { const x = lockGapPct(o, trip); out.push(`台幣金額和「金額×匯率」差了${x == null ? '很多' : ' ' + x.toFixed(1) + '%'}（容許 ±${tol}%）`); }
  if (r.includes('rate')) { const x = rateGapPct(o.cur, o.rate, trip); out.push(`匯率和參考匯率差了${x == null ? '很多' : ' ' + Math.abs(x).toFixed(1) + '%'}（容許 ±${tol * RATE_FACTOR}%）`); }
  return out.join('；');
}
