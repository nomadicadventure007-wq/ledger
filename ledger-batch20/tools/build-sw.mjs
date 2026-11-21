// 產生 sw.js 的「離線快取清單」與「版本號」，不用再手動維護。
//   node tools/build-sw.mjs            重新產生 sw.js（改完任何檔案、發佈前跑一次）
//   node tools/build-sw.mjs --check    只檢查 sw.js 是不是最新的（測試用；不是最新就失敗）
// 清單 = 從 js/main.js 一路追蹤 import 找到的所有程式檔 + 固定的頁面、樣式、字型、說明、圖片。
// 版本號 = 這些檔案內容的雜湊：只要有任何檔案變了，版本就自動換，使用者就會收到「有新版本」。
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'; import { createHash } from 'node:crypto'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), rel = f => './' + path.relative(ROOT, f).split(path.sep).join('/');
const modules = new Set(), visit = f => { if (modules.has(f)) return; if (!existsSync(f)) throw new Error('找不到被 import 的檔案：' + rel(f)); modules.add(f); for (const m of readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)) visit(path.resolve(path.dirname(f), m[1])); };
visit(path.join(ROOT, 'js/main.js'));
const list = d => existsSync(d) ? readdirSync(d).filter(n => !n.startsWith('.')).map(n => path.join(d, n)).filter(p => statSync(p).isFile()).sort() : [];
const fixed = ['index.html', 'manifest.json', 'css/app.css', 'fonts/iansui-sub.woff2', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'].map(f => path.join(ROOT, f)), extra = [...list(path.join(ROOT, 'img')), ...list(path.join(ROOT, 'help'))];
const icons = []; // （保留給「不一定存在」的檔案：只列出、不納入雜湊）
const files = ['./', ...[...fixed, ...[...modules].sort()].map(rel), ...icons, ...extra.map(rel)];
const hash = createHash('sha1'); for (const f of [...fixed, ...[...modules].sort(), ...extra]) { hash.update(rel(f)); hash.update(readFileSync(f)); }
for (const i of icons) if (existsSync(path.join(ROOT, i))) hash.update(readFileSync(path.join(ROOT, i)));
const V = 'ledger-' + hash.digest('hex').slice(0, 8);
const swPath = path.join(ROOT, 'sw.js'), old = readFileSync(swPath, 'utf8'), head = `const V = '${V}', FILES = [${files.map(f => `'${f}'`).join(', ')}];`;
const next = old.replace(/^const V = '[^']*', FILES = \[[^\]]*\];/, head);
if (!/^const V = /.test(old)) throw new Error('sw.js 第一行不是預期的格式');
if (process.argv.includes('--check')) { if (next !== old) { console.error('✗ sw.js 的快取清單或版本不是最新的，請執行：node tools/build-sw.mjs'); process.exit(1); } console.log('✓ sw.js 是最新的（%s，%d 個檔案）', V, files.length); }
else { writeFileSync(swPath, next); console.log(next === old ? '沒有變動' : '已更新 sw.js', V, files.length + ' 個檔案'); }
