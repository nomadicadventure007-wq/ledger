// 這個資料夾會放上公開的網站：管理員專用的功能、說明、金鑰流程都不可以出現在裡面。
// （管理功能在 worker/admin/，只有驗證過的管理員才下載得到。）
import assert from 'node:assert/strict'; import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'; import path from 'node:path';
const base = path.resolve(new URL('..', import.meta.url).pathname), walk = d => readdirSync(d).flatMap(n => { const p = path.join(d, n); return statSync(p).isDirectory() ? (n === 'node_modules' || n === 'tests' ? [] : walk(p)) : [p]; });
assert.ok(!existsSync(path.join(base, 'help/admin.html')), 'help/admin.html 不可以放在公開的資料夾');
for (const f of ['js/ui/sheets/members.js', 'js/ui/sheets/backup.js', 'js/ui/sheets/import.js', 'js/ui/sheets/recovery.js', 'js/features/csv.js', 'js/features/reminders.js']) assert.ok(!existsSync(path.join(base, f)), '管理員專用的檔案不可以在公開的資料夾：' + f);
// 這些字樣只會出現在管理功能裡（成員看到就代表漏了）
const MARK = ['設為管理員 👑', '刪除雲端旅程', '管理員恢復碼', '匯入 CSV', '好幾天沒備份', '旅程結束了', '同意，計入結算', '撤銷 ', '搬到雲端', '🛠️ 管理者說明', 'ADMIN_ONLY'];
let n = 0; for (const p of walk(base).filter(p => /\.(js|html|json|css)$/.test(p))) { const src = readFileSync(p, 'utf8'), rel = path.relative(base, p); n++;
  for (const m of MARK) assert.ok(!src.includes(m), `${rel} 含有管理功能的內容「${m}」，請搬到 worker/admin/`); }
assert.ok(!/SETUP_KEY\s*=/.test(walk(base).map(p => readFileSync(p, 'utf8')).join('\n')), '公開檔案裡不可以有金鑰');
console.log('✓ 公開資料夾沒有管理功能（檢查 %d 個檔案）', n);
