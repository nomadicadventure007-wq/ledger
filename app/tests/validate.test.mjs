// 壞紀錄檢查：能算帳的紀錄要通過；缺欄位、型別錯、會讓計算丟例外的，都要被挑出來。
import assert from 'node:assert/strict'; import { entryProblem } from '../js/core/validate.js';
import { settle } from '../js/core/settle.js'; import { replay } from '../js/core/wallet.js';
const X = (o = {}) => ({ id: 'e1', type: 'expense', desc: '午餐', minor: 1000, cur: 'EUR', rate: '36410000', twdMicro: '364100000', payer: 'm1', shares: ['m1', 'm2'], wt: {}, method: 'cash', cat: 'food', notes: '', date: '2026-02-01', author: 'm1', lock: null, ...o });
const EX = (o = {}) => ({ id: 'x1', type: 'exchange', owner: 'm1', cur: 'EUR', minor: 10000, rate: '36410000', twdMicro: '3641000000', date: '2026-02-01', ...o });
const ST = (o = {}) => ({ id: 's1', type: 'settle', from: 'm2', to: 'm1', twdMicro: '500000000', date: '2026-02-02', ...o });
for (const [n, e] of [['一般支出', X()], ['信用卡', X({ method: 'credit' })], ['舊資料沒有 method／wt／lock', (({ method, wt, lock, notes, cat, ...r }) => r)(X())], ['退款（負數）', X({ minor: -500, twdMicro: '-179000000' })], ['份數', X({ wt: { m1: 2, m2: 4 } })], ['鎖定', X({ lock: '364100000' })], ['錢包', X({ pin: 'x1' })], ['換匯', EX()], ['結清', ST()], ['付款人不在名單（畫面有備用顯示）', X({ payer: 'zz' })], ['自訂幣別', X({ cur: 'JPY' })]])
  assert.equal(entryProblem(e), '', '應該通過：' + n);
const BAD = [['不是物件', null], ['不是物件（陣列）', []], ['沒有編號', X({ id: '' })], ['編號不是字串', X({ id: 5 })], ['類型不明', X({ type: 'gift' })], ['日期不對', X({ date: '2026/02/01' })], ['日期不是字串', X({ date: 20260201 })],
  ['缺少分攤名單', X({ shares: undefined })], ['分攤名單是空的', X({ shares: [] })], ['分攤對象不是字串', X({ shares: [1] })], ['匯率不是數字', X({ rate: 'abc' })], ['匯率是數字型別', X({ rate: 36410000 })], ['台幣金額帶小數', X({ twdMicro: '1.5' })], ['金額是小數', X({ minor: 12.5 })], ['金額是字串', X({ minor: '1000' })],
  ['幣別帶 HTML', X({ cur: '<img src=x onerror=1>' })], ['缺少付款人', X({ payer: undefined })], ['付款方式不對', X({ method: 'bitcoin' })], ['份數是 0（會除以 0）', X({ wt: { m1: 0 } })], ['份數不是整數', X({ wt: { m1: 1.5 } })], ['鎖定不是數字', X({ lock: '12e3' })],
  ['換匯金額是 0（會除以 0）', EX({ minor: 0 })], ['換匯缺持有人', EX({ owner: undefined })], ['結清缺對象', ST({ to: undefined })], ['結清金額是負的', ST({ twdMicro: '-5' })], ['品項不是字串', X({ desc: { a: 1 } })]];
for (const [n, e] of BAD) assert.notEqual(entryProblem(e), '', '應該被擋下：' + n);
// 這些壞資料如果沒被擋，真的會讓計算丟例外 → 證明這道檢查有必要
const boom = f => { try { f(); return false; } catch { return true; } };
assert.ok(boom(() => settle([X({ shares: undefined })], e => BigInt(e.twdMicro))), '缺 shares 會讓結算崩潰'); assert.ok(boom(() => replay([X({ rate: 'abc', method: 'cash' })])), '匯率亂碼會讓錢包重播崩潰');
console.log('✓ validate 測試通過（%d 種正常、%d 種壞資料）', 11, BAD.length);
