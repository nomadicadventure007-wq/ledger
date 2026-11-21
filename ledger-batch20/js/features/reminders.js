import { exportCsv } from './csv.js';
import { S, isAdmin, saveAll } from '../state.js';
import { backupSheet } from '../ui/sheets/backup.js';
import { sheet, today, html } from '../ui/util.js';

export function tripEndCheck() {
  if (!isAdmin() || S.trip.ph) return;
  const b = S.trip.budget, ds = S.entries.filter(e => !e.deleted).map(e => e.date).sort(); if (!b?.days || !ds.length) return; S.dev.endAsked ||= {};
  const end = new Date(new Date(ds[0] + 'T12:00:00').getTime() + (b.days - 1) * 864e5).toLocaleDateString('sv'); if (today() < end || S.dev.endAsked[S.trip.id]) return;
  S.dev.endAsked[S.trip.id] = 1; saveAll();
  const o = sheet(html`<h2>🎉 旅程結束了</h2><button class="save on" id="te1">⬇︎ 匯出帳目 CSV</button><button class="pay" id="te2">💾 備份</button><button class="pay" id="te3">稍後</button>`);
  o.querySelector('#te1').onclick = () => { o.remove(); exportCsv('expenses', S.entries.filter(e => !e.deleted)); }; o.querySelector('#te2').onclick = () => { o.remove(); backupSheet(); }; o.querySelector('#te3').onclick = () => o.remove();
}
