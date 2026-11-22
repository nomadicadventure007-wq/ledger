import { S, owner, saveAll } from '../state.js';
import { toast } from '../ui/util.js';

// 把舊資料裡奇怪的日期格式整理成 YYYY-MM-DD
export const normDate = x => { const m = String(x || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2}))?)?/); if (!m) return null; const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return { date: d, ts: Date.parse(`${d}T${(m[4] || '12').padStart(2, '0')}:${m[5] || '00'}:00`) || Date.now() }; };
export function fixDates() {
  let n = 0; S.entries.forEach((e, i) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) { const nd = normDate(e.date); if (nd) { e.date = nd.date; e.ts = nd.ts + i; e.updatedAt = Date.now(); e.by = owner(); n++; } } });
  if (n) { saveAll(); setTimeout(() => toast(`已修正 ${n} 筆日期格式 🛠️`), 800); }
}
