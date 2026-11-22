import { doJoin } from '../../features/trips.js';
import { A, slot } from '../../features/admin.js';
import { S, saveAll } from '../../state.js';
import { render } from '../render.js';
import { preview } from './filesync.js';
import { sheet, toast, html } from '../util.js';

export function confirmSheet(title, text, label, danger, onOk) {
  const o = sheet(html`<h2>${title}</h2><button class="pay" id="cy"${danger ? html` style="background:#fee2e2;color:#be123c"` : ''}>${label}</button><button class="save" id="cn">取消</button>`);
  o.querySelector('#cn').onclick = () => o.remove(); o.querySelector('#cy').onclick = async () => { o.remove(); await onOk(); };
}
export const detach = async () => { delete S.dev.cloud[S.trip.id]; await saveAll(); render(); toast('已離開雲端，資料保留在這支手機'); };
export function detachSheet() { confirmSheet('離開雲端', '這支手機會停止同步，但紀錄都還在。之後可以用邀請碼重新加入。其他人不受影響。', '離開雲端', false, detach); }
export function joinCodeSheet() {
  const o = sheet(html`<h2>🎟️ 輸入邀請碼</h2><label>邀請碼<input id="jc" autocomplete="off" autocapitalize="characters" placeholder="XXXXX-XXXXX"></label><button class="save on" id="jgo">加入</button>${slot('joinExtra')}`);
  o.querySelector('#jgo').onclick = () => doJoin(o.querySelector('#jc').value, o);
  A.bindJoinExtra?.(o);
}
export const joinInput = v => { v = String(v || '').trim(); return /^LGR[01]\./.test(v.replace(/\s+/g, '')) ? preview(v, null) : doJoin(v); };
