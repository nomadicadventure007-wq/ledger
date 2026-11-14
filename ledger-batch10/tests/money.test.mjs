import assert from 'node:assert/strict';
import { allocate, toMinor, toMicro, twdMicro, showTwd } from '../js/core/money.js';
assert.equal(toMinor('12.5', 'EUR'), 1250n); assert.equal(toMinor('300', 'TWD'), 300n);
// 100 元分 3 人：總和必為 100
const a = allocate(100n, [1n, 1n, 1n]); assert.equal(a.reduce((x, y) => x + y), 100n);
// 10 筆 100 元分 3 人：累積後才進位 → 三人合計恰為 1000；逐筆進位會讓固定某人多付 10
const total = 10n * 100n * 1000000n, acc = allocate(total, [1n, 1n, 1n]);
assert.equal(acc.reduce((x, y) => x + y), total);
const naive = [0n, 0n, 0n]; for (let i = 0; i < 10; i++) allocate(100n, [1n, 1n, 1n]).forEach((v, k) => naive[k] += v);
assert.equal(naive.reduce((x, y) => x + y), 1000n);
assert.ok(Math.max(...acc.map(Number)) - Math.min(...acc.map(Number)) <= 1);
// 份數：0.5 份 = 權重 50 vs 100
assert.deepEqual(allocate(300n, [100n, 50n, 50n]), [150n, 75n, 75n]);
// 匯率：EUR 12.50 @36.41 = 455.125 TWD
const t = twdMicro(1250n, 'EUR', toMicro(36.41)); assert.equal(t, 455125000n); assert.equal(showTwd(t), '455');
console.log('✓ money 測試全數通過');
