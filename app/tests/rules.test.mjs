// 台幣金額／匯率偏離的判斷：App 這份和伺服器 worker/src/rules.js 那份必須一模一樣（契約測試）。
import assert from 'node:assert/strict'; import { existsSync } from 'node:fs';
import { reviewOf, reviewNote, rateGapPct, lockGapPct, tolOf } from '../js/core/rules.js';
const trip = { rates: { TWD: 1, EUR: 36.41, JPY: 0.23 }, lockTolerance: undefined };
const X = (o = {}) => ({ type: 'expense', minor: 1000, cur: 'EUR', rate: '36410000', twdMicro: '364100000', method: 'credit', lock: null, ...o });
const cases = [
  ['信用卡：正常', X(), ''], ['信用卡：差 3%', X({ twdMicro: '375000000' }), ''], ['信用卡：差 20%', X({ twdMicro: '437000000' }), 'lock'],
  ['現金：沒有鎖定就不看台幣', X({ method: 'cash', twdMicro: '1' }), ''], ['現金：鎖定一致', X({ method: 'cash', lock: '364100000' }), ''], ['現金：鎖定離譜', X({ method: 'cash', lock: '1' }), 'lock'],
  ['匯率差 20%', X({ rate: '43700000', twdMicro: '437000000' }), 'rate'], ['匯率差 7%（在放寬範圍內）', X({ rate: '39000000', twdMicro: '390000000' }), ''],
  ['匯率和金額都離譜', X({ rate: '60000000', twdMicro: '1' }), 'rate,lock'], ['退款：正負號反了', X({ minor: -1000 }), 'lock'], ['退款：正常', X({ minor: -1000, twdMicro: '-364100000' }), ''],
  ['換匯：匯率離譜', { type: 'exchange', cur: 'EUR', minor: 10000, rate: '60000000', twdMicro: '6000000000' }, 'rate'], ['換匯：正常', { type: 'exchange', cur: 'EUR', minor: 10000, rate: '37000000', twdMicro: '3700000000' }, ''],
  ['結清不檢查', { type: 'settle', twdMicro: '1' }, ''], ['日圓（0 位小數）', X({ cur: 'JPY', minor: 10000, rate: '230000', twdMicro: '2300000000' }), ''], ['日圓：差 20%', X({ cur: 'JPY', minor: 10000, rate: '230000', twdMicro: '2760000000' }), 'lock'],
  ['台幣', X({ cur: 'TWD', minor: 300, rate: '1000000', twdMicro: '300000000' }), ''], ['沒有這個幣別就不判斷', X({ cur: 'XYZ' }), ''],
];
for (const [n, e, want] of cases) assert.equal(reviewOf(e, trip), want, n);
// 容許百分比可調
assert.equal(tolOf(trip), 5); assert.equal(reviewOf(X({ twdMicro: '437000000' }), { ...trip, lockTolerance: 25 }), ''); assert.equal(reviewOf(X({ twdMicro: '364100001' }), { ...trip, lockTolerance: 0 }), 'lock');
// 給畫面的文字
assert.equal(rateGapPct('EUR', '39000000', trip).toFixed(1), '7.1'); assert.equal(lockGapPct(X({ twdMicro: '437000000' }), trip).toFixed(1), '20.0'); assert.match(reviewNote(X({ twdMicro: '437000000' }), trip), /差了 20\.0%.*±5%/);
assert.match(reviewNote(X({ rate: '60000000' }), trip), /匯率.*±15%/);
// 契約：和伺服器那份逐案比對（兩個資料夾放在一起時才跑；沒有 worker 資料夾就略過）
const wp = new URL('../worker/src/rules.js', import.meta.url);
if (existsSync(wp)) {
  const W = await import(wp.href); let n = 0;
  for (const [, e, want] of cases) { if (e.type !== 'settle' && trip.rates[e.cur]) { assert.equal(W.reviewOf(e, trip), want); n++; } }
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 2000; i++) { // 隨機案例：兩邊結果必須相同
    const cur = ['EUR', 'JPY', 'TWD'][Math.floor(rnd() * 3)], minor = (rnd() < .15 ? -1 : 1) * (1 + Math.floor(rnd() * 500000)), ref = Math.round(trip.rates[cur] * 1e6), rate = String(Math.max(1, Math.round(ref * (0.7 + rnd() * 0.6)))), tol = [0, 1, 5, 12.5, 50][Math.floor(rnd() * 5)];
    const e = X({ cur, minor, rate, method: rnd() < .5 ? 'cash' : 'credit', twdMicro: String(Math.round(Math.abs(minor) * Number(rate) / 10 ** (cur === 'EUR' ? 2 : 0) * (0.8 + rnd() * 0.4)) * Math.sign(minor)), lock: rnd() < .5 ? String(Math.round(Math.abs(minor) * Number(rate) / 10 ** (cur === 'EUR' ? 2 : 0) * (0.8 + rnd() * 0.4)) * Math.sign(minor)) : null });
    if (cur === 'JPY') { e.cur = 'JPY'; }
    const S = { ...trip, lockTolerance: tol }; assert.equal(W.reviewOf(e, S), reviewOf(e, S), JSON.stringify([e, tol])); n++;
  }
  console.log('✓ 契約測試：App 與伺服器對 %d 個案例的判斷完全一致', n);
} else console.log('（略過契約測試：找不到 worker/ 資料夾）');
console.log('✓ rules 測試通過');
