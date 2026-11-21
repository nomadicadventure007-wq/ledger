import { load, save } from '../../core/store.js';
import { FMT } from '../../core/sync.js';
import { pack } from '../../features/pack.js';
import { persist } from '../../features/sync.js';
import { S } from '../../state.js';
import { fmtT, sheet, toast, html } from '../util.js';

export async function backupSheet() {
  const all = {}; for (const t of S.db.trips) all[t.id] = t.id === S.trip.id ? S.entries : await load('entries:' + t.id, []);
  const code = await pack({ v: FMT, kind: 'backup', db: S.db, dev: S.dev, entries: all, t: Date.now() });
  const o = sheet(html`<h2>💾 備份</h2><textarea readonly rows="3">${code}</textarea><small>${code.length} 字元</small><button class="save on" id="b1">分享檔案（存到「檔案」或 AirDrop）</button><button class="pay" id="b2">複製</button>`);
  const done = () => { S.dev.lastBackup = Date.now(); persist(); };
  o.querySelector('#b1').onclick = async () => { try { const f = new File([code], 'ledger-backup.txt', { type: 'text/plain' }); if (!navigator.canShare?.({ files: [f] })) return toast('這裡不能分享檔案，請用複製'); await navigator.share({ files: [f] }); done(); } catch {} };
  o.querySelector('#b2').onclick = async () => { try { await navigator.clipboard.writeText(code); done(); toast('已複製 📋'); } catch {} };
}
export function restoreSheet(P, o) {
  o?.remove(); const w = sheet(html`<h2>⚠️ 還原備份</h2><div class="item"><div class="t"><div>${P.db.trips.length} 趟旅程，備份於 ${fmtT(P.t)}</div><small>會用備份「覆蓋」這支手機現在的全部資料</small></div></div><button class="save on" id="ro">確定還原</button><button class="pay" id="rn">取消</button>`);
  w.querySelector('#rn').onclick = () => w.remove();
  w.querySelector('#ro').onclick = async () => { for (const id of Object.keys(P.entries)) await save('entries:' + id, P.entries[id]); await save('db', P.db); await save('dev', P.dev); location.reload(); };
}
export function offerBackup() { if (Date.now() - (S.dev.lastBackup || 0) > 864e5) toast('💾 順便備份一下嗎？', backupSheet, '備份', 6000); }
