import { uid } from '../../core/model.js';
import { mic, ms, normDate, parseCsv } from '../../features/csv.js';
import { persist } from '../../features/sync.js';
import { S, cats, metaNew, people } from '../../state.js';
import { render } from '../render.js';
import { opts, sheet, toast, today, html } from '../util.js';

export function importSheet() {
  const o = sheet(html`<h2>⬆︎ 匯入 CSV</h2><label>選擇 CSV 檔<input id="cf" type="file" accept=".csv,text/csv,text/plain"></label>`);
  o.querySelector('#cf').onchange = async e => { const f = e.target.files[0]; if (!f) return; const rows = parseCsv(await f.text()), h = rows[0] || []; o.remove();
    if (h[0] === '日期' && h.includes('編號')) return importOwn(rows); if (h.includes('expenseId') || (h.includes('walletId') && h.includes('ownerUID'))) return legacySheet(rows); toast('⚠️ 不認得這個 CSV 的格式'); };
}
function importOwn(rows) {
  const id = n => people().find(p => p.name === n)?.id, miss = new Set(), add = [], have = new Set(S.entries.map(e => e.id)); let dup = 0;
  for (const c of rows.slice(1)) { const [date, time, kind, catN, desc, amt, cur, rate, twd, p1, p2, , meth, note, , eid] = c; if (!date || !cur && kind !== '結清') continue;
    if (eid && have.has(eid)) { dup++; continue; } const nd = normDate(date), ts = (nd && Date.parse(`${nd.date}T${time || '12:00'}`)) || Date.now();
    if (kind === '換匯') { if (!id(p1)) { miss.add(p1); continue; } add.push({ id: eid || 'e' + uid(), type: 'exchange', owner: id(p1), cur, minor: ms(amt, cur), rate: String(mic(rate)), twdMicro: String(mic(twd)), date, ts }); }
    else if (kind === '結清') { if (!id(p1) || !id(p2)) { miss.add(p1 + '/' + p2); continue; } add.push({ id: eid || 'e' + uid(), type: 'settle', from: id(p1), to: id(p2), twdMicro: String(mic(twd)), date, ts }); }
    else { const sh = (p2 || '').split('|').map(x => x.split(':')), ids = sh.map(x => id(x[0])); if (!id(p1) || ids.some(x => !x)) { miss.add(p1); continue; }
      add.push({ id: eid || 'e' + uid(), type: 'expense', desc, minor: ms(amt, cur), cur, rate: String(mic(rate)), twdMicro: String(mic(twd)), payer: id(p1), shares: ids, wt: Object.fromEntries(sh.map((x, k) => [ids[k], Math.min(40, Math.max(1, Math.round(parseFloat(x[1]) * 2) || 2))])), method: meth === '現金' ? 'cash' : 'credit', cat: cats().find(x => x[2] === catN)?.[0] ?? cats().at(-1)[0], notes: note || '', date, ts, lock: kind === '退款' ? null : null }); } }
  if (miss.size) return toast('⚠️ 找不到成員：' + [...miss].join('、') + '（請先在設定建立同名成員）');
  finishImport(add, dup);
}
function finishImport(add, dup) {
  const w = sheet(html`<h2>預覽</h2><div class="item"><div class="t"><div>➕ 將匯入 ${add.length} 筆</div><div>⏭ 略過重複 ${dup} 筆</div></div></div><button class="save on" id="io" ${add.length ? '' : 'disabled'}>匯入</button><button class="pay" id="in">取消</button>`);
  w.querySelector('#in').onclick = () => w.remove();
  w.querySelector('#io').onclick = () => { for (const e of add) { for (const c of [e.cur]) if (c && !(c in S.trip.rates)) S.trip.rates[c] = parseFloat(e.rate) / 1e6 || 1; S.entries.unshift({ ...metaNew(), ...e }); } S.entries.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)); w.remove(); persist(); render(); toast(`已匯入 ${add.length} 筆 ✅`); };
}
function legacySheet(rows) {
  const isW = !rows[0].includes('expenseId'), uids = [...new Set(rows.slice(1).flatMap(c => isW ? [c[1]] : [c[8], ...(c[9] || '').split('|')]).filter(Boolean))].sort(), P = people(); let n = 0;
  const def = u => u === 'u004' ? S.trip.funds[0]?.id : S.trip.members[n++ % S.trip.members.length].id;
  const w = sheet(html`<h2>舊版 CSV：對應成員</h2>${uids.map(u => html`<label>${u} →<select data-u="${u}">${opts(P.map(p => [p.id, p.name]), def(u))}</select></label>`)}<button class="save on" id="lo">匯入</button>`);
  w.querySelector('#lo').onclick = () => {
    const map = {}; w.querySelectorAll('[data-u]').forEach(x => map[x.dataset.u] = x.value); const add = [], have = new Set(S.entries.map(e => e.id)); let dup = 0;
    for (const c of rows.slice(1)) { const eid = 'l' + c[0]; if (have.has(eid)) { dup++; continue; }
      if (isW) { const cur = c[2], nd = normDate(c[6]); add.push({ id: eid, type: 'exchange', owner: map[c[1]], cur, minor: ms(c[3], cur), rate: String(mic(c[5])), twdMicro: String(mic(parseFloat(c[3]) * parseFloat(c[5]))), date: nd?.date ?? today(), ts: nd?.ts ?? Date.now() }); continue; }
      if (c.length < 10) continue; const nm = (c[2] || '').trim().split(/\s+/).pop(), cur = c[5], tm = mic(c[7]);
      add.push({ id: eid, type: 'expense', desc: c[3], minor: ms(c[4], cur), cur, rate: String(mic(c[6])), twdMicro: String(tm), lock: String(tm), payer: map[c[8]], shares: c[9].split('|').map(u => map[u]), wt: {}, method: c[10] === 'cash' ? 'cash' : 'credit', cat: cats().find(x => x[2] === nm || x[0] === nm)?.[0] ?? cats().at(-1)[0], notes: c[12] || '', date: normDate(c[1])?.date ?? today(), ts: normDate(c[1])?.ts ?? Date.now() }); }
    w.remove(); finishImport(add, dup); };
}
