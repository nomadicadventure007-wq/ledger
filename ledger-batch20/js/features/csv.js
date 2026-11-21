import { dec } from '../core/money.js';
import { settle } from '../core/settle.js';
import { S, cats, counted, isPrivate, owner, saveAll, tw } from '../state.js';
import { offerBackup } from '../ui/sheets/backup.js';
import { toast, today, who } from '../ui/util.js';

// ---- CSV 匯出／匯入 ----
const csvRow = a => a.map(v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
export function parseCsv(t) {
  t = t.replace(/^\uFEFF/, ''); const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n') { r.push(f.replace(/\r$/, '')); rows.push(r); r = []; f = ''; } else f += c; }
  if (f !== '' || r.length) { r.push(f.replace(/\r$/, '')); rows.push(r); }
  return rows.filter(x => x.some(y => y.trim() !== ''));
}
async function saveFile(name, text) {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
  try { if (window.showSaveFilePicker) { const h = await showSaveFilePicker({ suggestedName: name, types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }] }); const w = await h.createWritable(); await w.write(blob); await w.close(); toast('已存檔 ✅'); return true; } } catch (e) { if (e.name === 'AbortError') return false; }
  const f = new File([blob], name, { type: 'text/csv' });
  try { if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return true; } } catch (e) { if (e.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('已下載 ⬇︎'); return true;
}
const HEAD = ['日期', '時間', '種類', '分類', '品項', '外幣金額', '幣別', '匯率', '台幣', '付款人', '分攤', '公私', '付款方式', '備註', '記錄者', '編號'];
export function exportCsv(kind, list) {
  const t = ts => ts ? new Date(ts).toTimeString().slice(0, 5) : '', twd = e => Math.round(Number(tw(e)) / 1e4) / 100, rows = [HEAD];
  for (const e of [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.ts ?? 0) - (b.ts ?? 0))) {
    if (e.type === 'expense') { const c = cats().find(x => x[0] === e.cat); rows.push([e.date, t(e.ts), e.minor < 0 ? '退款' : '支出', c ? c[2] : e.cat, e.desc, e.minor / 10 ** dec(e.cur), e.cur, Number(e.rate) / 1e6, twd(e), who(e.payer).name, e.shares.map(i => who(i).name + ':' + (e.wt?.[i] ?? 2) / 2).join('|'), isPrivate(e) ? '私帳' : '公帳', e.method === 'cash' ? '現金' : '信用卡', e.notes || '', who(e.author).name, e.id]); }
    else if (e.type === 'exchange') rows.push([e.date, t(e.ts), '換匯', '', '', e.minor / 10 ** dec(e.cur), e.cur, Number(e.rate) / 1e6, Number(e.twdMicro) / 1e6, who(e.owner).name, '', '', '', '', who(e.author).name, e.id]);
    else if (e.type === 'settle') rows.push([e.date, t(e.ts), '結清', '', '', '', 'TWD', 1, Number(e.twdMicro) / 1e6, who(e.from).name, who(e.to).name, '', '', '', who(e.author).name, e.id]);
  }
  if (rows.length < 2) return toast('沒有可匯出的紀錄');
  saveFile(`ledger-${kind}-${today()}.csv`, rows.map(csvRow).join('\r\n')).then(ok => ok && offerBackup());
}
export function exportWalletCsv() {
  const rows = [['編號', '日期', '持有人', '幣別', '換匯金額', '花費台幣', '匯率', '目前餘額']];
  for (const w of S.rp.wallets) { const e = S.entries.find(x => x.id === w.id); rows.push([w.id, w.date, who(w.owner).name, w.cur, w.init / 10 ** dec(w.cur), Number(e?.twdMicro ?? 0) / 1e6, Number(w.rate) / 1e6, w.left / 10 ** dec(w.cur)]); }
  if (rows.length < 2) return toast('還沒有錢包'); saveFile(`ledger-wallets-${today()}.csv`, rows.map(csvRow).join('\r\n'));
}
export function exportSettleCsv() {
  const R = settle(counted(), e => BigInt(tw(e))), rows = [['成員', '實際花費(台幣)', '代墊(台幣)', '淨額(正=該收,負=該付)']];
  Object.entries(R.p).forEach(([id, q]) => rows.push([who(id).name, q.cons, q.paid, q.net])); rows.push([], ['轉帳建議', '付款人', '收款人', '金額(台幣)']); R.transfers.forEach(t => rows.push(['', who(t.from).name, who(t.to).name, t.twd]));
  saveFile(`ledger-settlement-${today()}.csv`, rows.map(csvRow).join('\r\n'));
}
export const ms = (x, c) => Math.round(parseFloat(x) * 10 ** dec(c)), mic = x => Math.round(parseFloat(x) * 1e6);
// ---- 優化：備份提醒、複製轉帳、複製上一筆、每日趨勢、自訂分類圖、搜尋 ----
export const normDate = x => { const m = String(x || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2}))?)?/); if (!m) return null; const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return { date: d, ts: Date.parse(`${d}T${(m[4] || '12').padStart(2, '0')}:${m[5] || '00'}:00`) || Date.now() }; };
export function fixDates() {
  let n = 0; S.entries.forEach((e, i) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) { const nd = normDate(e.date); if (nd) { e.date = nd.date; e.ts = nd.ts + i; e.updatedAt = Date.now(); e.by = owner(); n++; } } });
  if (n) { saveAll(); setTimeout(() => toast(`已修正 ${n} 筆日期格式 🛠️`), 800); }
}
