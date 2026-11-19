import assert from 'node:assert/strict';
import { settle } from '../js/core/settle.js';
const tw = e => e.tw * 1000000n;
const X = (payer, shares, t, o = {}) => ({ type: 'expense', payer, shares, tw: BigInt(t), cat: 'food', ...o });
let r = settle(Array.from({ length: 10 }, () => X('A', ['A', 'B', 'C'], 100)), tw);   // 你的情境：10 筆 100 元分 3 人
assert.deepEqual(Object.values(r.p).map(x => x.net).reduce((a, b) => a + b), 0); assert.equal(r.p.A.net, 667); assert.equal(r.p.B.net + r.p.C.net, -667);
assert.ok(Math.abs(r.p.B.net - r.p.C.net) <= 1); assert.equal(r.transfers.reduce((a, t) => a + t.twd, 0), 667);
r = settle([...Array.from({ length: 10 }, () => X('A', ['A', 'B', 'C'], 100)), { type: 'settle', from: 'B', to: 'A', twdMicro: '333000000' }], tw);
assert.equal(r.transfers.length, 1); assert.equal(r.transfers[0].from, 'C');          // B 結清後只剩 C 欠
r = settle([X('A', ['A', 'B'], 300, { wt: { A: 2, B: 1 } })], tw); assert.equal(r.p.B.net, -100); assert.equal(r.p.A.net, 100); // 份數 1 : 0.5
r = settle([X('A', ['A', 'B'], 300), X('B', ['A', 'B'], -100)], tw); assert.equal(r.p.A.net, 200);                              // 退款：總花費 200、各 100，A 墊 300
// 亂數：任何情況下淨額加總必為 0，轉帳加總 = 正數淨額加總，且至多 n-1 筆
const ids = ['A', 'B', 'C', 'D', 'E'], pick = a => a[Math.floor(Math.random() * a.length)];
for (let t = 0; t < 300; t++) {
  const es = Array.from({ length: 1 + Math.floor(Math.random() * 25) }, () => { const sh = ids.filter(() => Math.random() < .6); const s = sh.length ? sh : ['A']; return X(pick(ids), s, 1 + Math.floor(Math.random() * 5000), { wt: Object.fromEntries(s.map(i => [i, 1 + Math.floor(Math.random() * 4)])) }); });
  const x = settle(es, tw), nets = Object.values(x.p).map(v => v.net), pos = nets.filter(v => v > 0).reduce((a, b) => a + b, 0);
  assert.equal(nets.reduce((a, b) => a + b, 0), 0); assert.equal(x.transfers.reduce((a, b) => a + b.twd, 0), pos); assert.ok(x.transfers.length <= Math.max(0, nets.length - 1));
}
console.log('✓ settle 測試全數通過（含 300 組亂數）');
