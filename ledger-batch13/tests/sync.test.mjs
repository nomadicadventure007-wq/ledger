import assert from 'node:assert/strict';
import { merge, fingerprint as fp, gaps, isPending, dupIds, winner } from '../js/core/sync.js';
const E = (id, o = {}) => ({ id, type: 'expense', date: '2026-02-01', cur: 'EUR', minor: 100, payer: 'A', author: 'A', by: 'A', deviceId: 'dA', sq: 1, updatedAt: 10, ts: 10, deleted: false, desc: '拉麵', ...o });
const ADM = { adminId: 'A' };
// 冪等：重複匯入不會變
let a = [E('1'), E('2', { updatedAt: 20 })], b = [E('2', { updatedAt: 30, by: 'B', deviceId: 'dB' }), E('3', { author: 'B', by: 'B', deviceId: 'dB' })];
let m = merge(a, b, ADM); assert.equal(fp(merge(m.entries, b, ADM).entries), fp(m.entries)); assert.equal(m.stats.added, 1);
// 兩個方向合併結果相同
assert.equal(fp(merge(a, b, ADM).entries), fp(merge(b, a, ADM).entries));
// 管理員優先：管理員較舊的修改，勝過成員較新的
assert.equal(winner(E('x', { by: 'A', updatedAt: 5 }), E('x', { by: 'B', updatedAt: 99, deviceId: 'dB' }), 'A').by, 'A');
// 都不是管理員：較新者勝；刪除（墓碑）較新就勝，較舊的「復活」不會成功
assert.equal(winner(E('x', { by: 'B', updatedAt: 5 }), E('x', { by: 'C', updatedAt: 9 }), 'A').by, 'C');
assert.equal(merge([E('d', { deleted: true, updatedAt: 50 })], [E('d', { updatedAt: 20 })], ADM).entries[0].deleted, true);
// 缺號偵測
assert.deepEqual(gaps([E('1', { sq: 1 }), E('2', { sq: 2 }), E('5', { sq: 5 })]), [{ dev: 'dA', miss: [3, 4] }]); assert.equal(gaps([E('1'), E('2', { sq: 2 })]).length, 0);
// 重複偵測：不同人記同一筆
assert.equal(dupIds([E('1'), E('2', { author: 'B', desc: '拉麵 ' })]).size, 2); assert.equal(dupIds([E('1'), E('2', { desc: '地鐵', author: 'B' })]).size, 0); assert.equal(dupIds([E('1'), E('2')]).size, 0);
// 結清後補記舊帳 → 待確認；管理員同意後恢復
const tr = { adminId: 'A', close: { until: '2026-02-05', at: 100 } };
assert.ok(isPending(E('p', { author: 'B', ts: 200 }), tr)); assert.ok(!isPending(E('p', { author: 'B', ts: 50 }), tr)); assert.ok(!isPending(E('p', { author: 'A', ts: 200 }), tr)); assert.ok(!isPending(E('p', { author: 'B', ts: 200, approved: true }), tr)); assert.ok(!isPending(E('p', { author: 'B', ts: 200, date: '2026-02-09' }), tr));
// 亂數：三台裝置各自隨機修改，不論合併順序，結果指紋都相同（可交換、可結合）
const R = n => Math.floor(Math.random() * n), P = ['A', 'B', 'C'];
for (let t = 0; t < 300; t++) {
  const base = Array.from({ length: 6 }, (_, i) => E('e' + i, { updatedAt: 1 })), dev = P.map(p => base.map(e => ({ ...e })));
  dev.forEach((L, i) => { L.forEach(e => { if (Math.random() < .5) Object.assign(e, { by: P[i], deviceId: 'd' + P[i], updatedAt: 2 + R(4), deleted: Math.random() < .3 }); }); if (Math.random() < .7) L.push(E('n' + i + R(3), { by: P[i], author: P[i], deviceId: 'd' + P[i], updatedAt: 2 + R(4) })); });
  const [x, y, z] = dev, f = (p, q) => merge(p, q, ADM).entries;
  const r1 = fp(f(f(x, y), z)), r2 = fp(f(x, f(y, z))), r3 = fp(f(f(z, x), y)), r4 = fp(f(f(y, z), x)); assert.ok(r1 === r2 && r2 === r3 && r3 === r4, 'diverged');
}
console.log('✓ sync 測試全數通過（含 300 組三方亂數合併）');
