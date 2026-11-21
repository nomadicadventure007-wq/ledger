// 端對端測試的共用工具：啟動後端（真的 SQLite）與網頁伺服器、用真的瀏覽器開 App。
// 需要：Node 22+、Playwright（npm i -D playwright && npx playwright install chromium）。
// 專案裡要有 worker/ 資料夾（後端），測試會用 worker/test/dev-server.mjs 在本機跑一個後端（8787 埠）。
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { cpSync, existsSync, mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'); // 專案根目錄（index.html 所在）
export const API = 'http://localhost:8787', KEY = 'k';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webp': 'image/webp' };

export async function pw() {
  try { return await import('playwright'); } catch {}
  if (process.env.PW_MODULES) return createRequire(process.env.PW_MODULES.replace(/\/?$/, '/'))('playwright');
  throw new Error('找不到 Playwright。請先執行：npm i -D playwright && npx playwright install chromium（或用環境變數 PW_MODULES 指到它所在的 node_modules）');
}
export async function startWorker() {
  const f = path.join(ROOT, 'worker/test/dev-server.mjs'); if (!existsSync(f)) throw new Error('找不到 worker/test/dev-server.mjs：端對端測試需要專案裡有 worker/ 資料夾');
  await import(pathToFileURL(f).href); await new Promise(r => setTimeout(r, 400)); // 後端跑在 8787
}
export function serve(root = ROOT) {
  return new Promise(res => { const s = http.createServer(async (q, r) => { try { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; const d = await readFile(f); r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); } catch { r.writeHead(404, { 'content-type': 'text/html' }); r.end('<p>404</p>'); } }).listen(0, () => res({ base: `http://localhost:${s.address().port}`, close: () => s.close() })); });
}
// 複製一份 App 到暫存資料夾（可以不含封面圖，或換成測試用的封面圖），不會動到專案本身
export function appCopy({ cover = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ledger-e2e-')); for (const n of ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'fonts', 'help', 'img', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) if (existsSync(path.join(ROOT, n))) cpSync(path.join(ROOT, n), path.join(dir, n), { recursive: true, filter: s => cover || !s.endsWith('ledger-cover.webp') });
  return dir;
}
export function reporter() { let bad = 0; return { ok(n, c, x = '') { console.log(c ? '✓' : '✗', n, c ? '' : x); if (!c) bad++; return c; }, get bad() { return bad; }, fail() { bad++; }, finish(label) { console.log(bad ? `\n✗ ${bad} 項失敗` : `\n✓ ${label}全部通過`); process.exit(bad ? 1 : 0); } }; }
// 在瀏覽器裡解碼一張 PNG，取幾個點的顏色（不需要任何圖片套件）
export async function pixels(page, png, pts) { return page.evaluate(async ([b64, pts]) => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), bmp = await createImageBitmap(new Blob([bytes])), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return pts.map(([x, y]) => [...g.getImageData(x < 0 ? bmp.width + x : x, y < 0 ? bmp.height + y : y, 1, 1).data].slice(0, 3)); }, [png.toString('base64'), pts]); }
