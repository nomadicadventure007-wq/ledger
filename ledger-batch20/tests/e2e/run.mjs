// 依序執行所有端對端測試（每個測試各自啟動後端與瀏覽器）。
//   node tests/e2e/run.mjs            全部
//   node tests/e2e/run.mjs ui sync    只跑名稱含 ui 或 sync 的
import { spawnSync } from 'node:child_process'; import { readdirSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url)), want = process.argv.slice(2), files = readdirSync(dir).filter(f => f.endsWith('.test.mjs') && (!want.length || want.some(w => f.includes(w)))).sort(); let failed = [];
for (const f of files) { console.log(`\n━━━━━━ ${f} ━━━━━━`); const r = spawnSync('node', ['--no-warnings', path.join(dir, f)], { stdio: 'inherit' }); if (r.status !== 0) failed.push(f); }
console.log(failed.length ? `\n✗ 失敗的測試檔：${failed.join('、')}` : `\n✓ 端對端測試全部通過（${files.length} 個檔案）`); process.exit(failed.length ? 1 : 0);
