// 防止 sw.js 被誤清空，也確保「每個程式檔都在離線快取清單裡」、版本號是最新的（清單由 tools/build-sw.mjs 產生）
import assert from 'node:assert/strict'; import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import path from 'node:path';
const root = new URL('../', import.meta.url), sw = readFileSync(new URL('sw.js', root), 'utf8'); assert.ok(sw.length > 500, 'sw.js 是空的或太短');
const files = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
for (const f of files) if (f && !/^icon-/.test(f)) assert.ok(existsSync(new URL(f, root)), '快取清單裡的檔案不存在：' + f);
const walk = d => readdirSync(d).flatMap(n => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const base = path.resolve(new URL('.', root).pathname);
for (const p of walk(path.join(base, 'js')).filter(p => p.endsWith('.js'))) { const f = path.relative(base, p).split(path.sep).join('/'); assert.ok(files.includes(f), '沒有列入離線快取：' + f); }
for (const f of ['css/app.css', 'index.html', 'manifest.json']) assert.ok(files.includes(f), '沒有列入離線快取：' + f);
assert.match(sw, /^const V = 'ledger-[0-9a-f]{8}'/, '版本號格式不對');
execFileSync('node', [path.join(base, 'tools/build-sw.mjs'), '--check'], { stdio: 'inherit' }); // 版本與清單必須是最新的
console.log('✓ sw.js 測試通過（%d 個檔案列入離線快取）', files.length);
