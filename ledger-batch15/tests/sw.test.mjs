// 防止 sw.js 再次被誤清空，也確保每個程式檔都在離線快取清單裡
import assert from 'node:assert/strict'; import { readFileSync, readdirSync, existsSync } from 'node:fs';
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8'); assert.ok(sw.length > 500, 'sw.js 是空的或太短');
const files = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]), root = new URL('../', import.meta.url);
for (const f of files) if (f && !/^icon-/.test(f) && !/^help\//.test(f)) assert.ok(existsSync(new URL(f, root)), '快取清單裡的檔案不存在：' + f);
const need = [...readdirSync(new URL('js/core/', root)).map(f => 'js/core/' + f), 'js/app.js', 'css/app.css', 'index.html', 'manifest.json'];
for (const f of need) assert.ok(files.includes(f), '沒有列入離線快取：' + f);
assert.match(sw, /const V = 'ledger-v\d+'/); console.log('✓ sw.js 測試通過（%d 個檔案列入離線快取）', files.length);
