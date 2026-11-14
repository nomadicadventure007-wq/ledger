import assert from 'node:assert/strict';
import { replay } from '../js/core/wallet.js';
const ex = (id, d, minor, rate) => ({ id, type: 'exchange', owner: 'm1', cur: 'EUR', minor, rate: String(rate * 1e6), date: d, ts: 1 });
const sp = (id, d, minor, o = {}) => ({ id, type: 'expense', payer: 'm1', cur: 'EUR', minor, rate: '36410000', method: 'cash', date: d, ts: 2, ...o });
let r = replay([ex('a', '2026-02-01', 10000, 30), ex('b', '2026-02-02', 10000, 40), sp('s', '2026-02-03', 15000)]);
assert.equal(r.by.s.twdMicro, 5000n * 1000000n);             // 100@30 + 50@40
assert.equal(r.wallets[0].left, 0); assert.equal(r.wallets[1].left, 5000);
r = replay([ex('a', '2026-02-01', 10000, 30), ex('b', '2026-02-02', 10000, 40), sp('s', '2026-02-03', 5000, { pin: 'b' })]);
assert.equal(r.by.s.twdMicro, 2000n * 1000000n);              // 指定扣 b
r = replay([ex('a', '2026-02-01', 10000, 30), sp('s', '2026-02-03', 5000, { lock: '123000000' })]);
assert.equal(r.by.s.twdMicro, 123000000n);                    // 鎖定
r = replay([sp('s', '2026-02-03', 1000, { date: '2026-02-01' }), ex('a', '2026-02-02', 5000, 30)]);
assert.equal(r.by.s.short, 1000);                             // 先花後換 → 不足，用參考匯率
r = replay([ex('a', '2026-02-01', 10000, 30), sp('late', '2026-02-05', 2000), sp('early', '2026-02-02', 3000)]);
assert.equal(r.wallets[0].left, 5000);                        // 補記較早的一筆，順序依日期重算
r = replay([ex('a', '2026-02-01', 10000, 30), sp('s', '2026-02-02', 4000), sp('rf', '2026-02-03', -1000)]);
assert.equal(r.wallets[0].left, 7000); assert.equal(r.by.rf.twdMicro, -300n * 1000000n);   // 退款 10 歐元還回錢包，以 @30 計
r = replay([ex('a', '2026-02-01', 10000, 30), sp('rf', '2026-02-03', -1000)]); assert.equal(r.wallets[0].left, 10000);   // 沒用過就退：不憑空加錢
console.log('✓ wallet 測試全數通過');
