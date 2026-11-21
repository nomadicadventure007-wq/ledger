// 台幣金額／匯率偏離的判斷（純函式）。和伺服器 worker/src/rules.js 的 reviewOf 是同一套算法，
// 讓你「記下的當下」就能提醒；真正有效的是伺服器的判斷（tests/rules.test.mjs 用同一批案例檢查兩邊一致）。
import { dec } from './money.js';
export const DEFAULT_TOLERANCE = 5; // 台幣金額可偏離的百分比（管理員可在設定改）
export const RATE_FACTOR = 3; // 匯率的容許範圍 = 台幣金額容許範圍的幾倍
export const tolOf = trip => (Number.isFinite(trip?.lockTolerance) ? trip.lockTolerance : DEFAULT_TOLERANCE);

const refOf = (o, trip) => BigInt(Math.round(Number(trip.rates?.[o.cur]) * 1e6));
const abs = x => (x < 0n ? -x : x);
// 這筆「自己宣稱的台幣」與「金額 × 這筆自己的匯率」的差距。現金看 lock；信用卡看 twdMicro。沒有可比的就回 null。
function lockGap(o, trip) {
  if (o.type !== 'expense') return null;
  const claimed = o.method === 'cash' ? o.lock : o.twdMicro;
  if (claimed == null) return null;
  const p = 10n ** BigInt(dec(o.cur)), m = BigInt(o.minor), a = abs(m), exp = (m < 0n ? -1n : 1n) * ((a * BigInt(o.rate) + p / 2n) / p), c = BigInt(claimed);
  return { diff: abs(c - exp), base: abs(exp) };
}
// 回傳 '' 或 'rate'、'lock'、'rate,lock'
export function reviewOf(o, trip) {
  if (o.type === 'settle' || !(Number(trip.rates?.[o.cur]) > 0)) return '';
  const tol = BigInt(Math.round(tolOf(trip) * 100)), ref = refOf(o, trip), rate = BigInt(o.rate), why = [];
  if (abs(rate - ref) * 10000n > ref * tol * BigInt(RATE_FACTOR)) why.push('rate');
  const g = lockGap(o, trip);
  if (g && g.diff * 10000n > g.base * tol) why.push('lock');
  return why.join(',');
}
// 給畫面用的百分比（帶正負號，一位小數）；算不出來就是 null
export const rateGapPct = (cur, rateMicro, trip) => { const ref = refOf({ cur }, trip); return ref > 0n ? Number((BigInt(rateMicro) - ref) * 100000n / ref) / 1000 : null; };
export function lockGapPct(o, trip) { const g = lockGap(o, trip); return g && g.base > 0n ? Number(g.diff * 100000n / g.base) / 1000 : null; }
// 一句人話，說明為什麼要等管理員確認
export function reviewNote(o, trip) {
  const r = (o.review ?? reviewOf(o, trip)).split(','), tol = tolOf(trip), out = [];
  if (r.includes('lock')) { const x = lockGapPct(o, trip); out.push(`台幣金額和「金額×匯率」差了${x == null ? '很多' : ' ' + x.toFixed(1) + '%'}（容許 ±${tol}%）`); }
  if (r.includes('rate')) { const x = rateGapPct(o.cur, o.rate, trip); out.push(`匯率和參考匯率差了${x == null ? '很多' : ' ' + Math.abs(x).toFixed(1) + '%'}（容許 ±${tol * RATE_FACTOR}%）`); }
  return out.join('；');
}
