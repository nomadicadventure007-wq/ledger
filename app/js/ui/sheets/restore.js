import { save } from '../../core/store.js';
import { fmtT, sheet, html } from '../util.js';

export function restoreSheet(P, o) {
  o?.remove(); const w = sheet(html`<h2>⚠️ 還原備份</h2><div class="item"><div class="t"><div>${P.db.trips.length} 趟旅程，備份於 ${fmtT(P.t)}</div><small>會用備份「覆蓋」這支手機現在的全部資料</small></div></div><button class="save on" id="ro">確定還原</button><button class="pay" id="rn">取消</button>`);
  w.querySelector('#rn').onclick = () => w.remove();
  w.querySelector('#ro').onclick = async () => { for (const id of Object.keys(P.entries)) await save('entries:' + id, P.entries[id]); await save('db', P.db); await save('dev', P.dev); location.reload(); };
}
