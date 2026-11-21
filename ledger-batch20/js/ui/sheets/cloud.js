import { cloudApi } from '../../core/cloud.js';
import { cl, strip, syncNow } from '../../features/sync.js';
import { doJoin, doRecover } from '../../features/trips.js';
import { DENY, S, isAdmin, saveAll, settingsOf } from '../../state.js';
import { render } from '../render.js';
import { preview } from './filesync.js';
import { recoverySheet } from './recovery.js';
import { copyBtn, esc, sheet, toast, who, html } from '../util.js';

export function cloudSheet() {
  if (!isAdmin()) return toast(DENY);
  const o = sheet(html`<h2>☁️ 搬到雲端</h2><label>建立金鑰<input id="ck" type="password" autocomplete="off"></label><button class="save on" id="cgo">上傳 ☁️</button>`);
  o.querySelector('#cgo').onclick = async () => {
    const key = o.querySelector('#ck').value; if (!key) return; toast('上傳中…');
    const r = await cloudApi('POST', '/api/trips', { settings: settingsOf(S.trip), entries: S.entries.slice(0, 400).map(strip) }, null, key);
    if (r.error) return toast('⚠️ ' + r.error);
    S.dev.cloud[S.trip.id] = { token: r.token, rev: 0, sj: JSON.stringify(settingsOf(S.trip)), last: 0 }; await saveAll(); o.remove(); recoverySheet(r.recoveryCode); syncNow(); render();
  };
}
function confirmSheet(title, text, label, danger, onOk) {
  const o = sheet(html`<h2>${title}</h2><button class="pay" id="cy"${danger ? html` style="background:#fee2e2;color:#be123c"` : ''}>${label}</button><button class="save" id="cn">取消</button>`);
  o.querySelector('#cn').onclick = () => o.remove(); o.querySelector('#cy').onclick = async () => { o.remove(); await onOk(); };
}
const detach = async () => { delete S.dev.cloud[S.trip.id]; await saveAll(); render(); toast('已離開雲端，資料保留在這支手機'); };
export function rvkSheet(mid) {
  confirmSheet('撤銷 ' + who(mid).name, '對方手機的憑證會立刻失效，無法再同步。之後可以重新發邀請碼讓他加入。', '撤銷', true, async () => { const r = await cloudApi('POST', `/api/trips/${S.trip.id}/revoke`, { memberId: mid }, cl().token); toast(r.error ? '⚠️ ' + r.error : '已撤銷 ' + who(mid).name); syncNow(); });
}
export function detachSheet() { confirmSheet('離開雲端', '這支手機會停止同步，但紀錄都還在。之後可以用邀請碼重新加入。其他人不受影響。', '離開雲端', false, detach); }
export function delSheet() {
  const o = sheet(html`<h2>刪除雲端旅程</h2><label>輸入「${S.trip.name}」確認刪除<input id="dn" autocomplete="off"></label><button class="pay" id="dy" style="background:#fee2e2;color:#be123c">永久刪除</button>`);
  o.querySelector('#dy').onclick = async () => { if (o.querySelector('#dn').value.trim() !== S.trip.name) return toast('名稱不對'); const r = await cloudApi('POST', `/api/trips/${S.trip.id}/delete`, {}, cl().token); if (r.error) return toast('⚠️ ' + r.error); o.remove(); await detach(); toast('雲端旅程已刪除'); };
}
export async function inviteSheet(mid) {
  const r = await cloudApi('POST', `/api/trips/${S.trip.id}/invites`, { memberId: mid }, cl().token); if (r.error) return toast('⚠️ ' + r.error);
  const url = location.origin + location.pathname, msg = `加入「${S.trip.name}」的記帳：\n1. 開啟 ${url}\n2. 設定 → 輸入邀請碼\n邀請碼：${r.code}（7 天內有效，只能用一次）`;
  const o = sheet(html`<h2>🎟️ 給 ${who(mid).name} 的邀請碼</h2><div style="font-size:2rem;font-weight:700;text-align:center;letter-spacing:.1em" id="icode">${r.code}</div><button class="save on" id="i1">分享</button><button class="pay" id="i2">複製</button>`);
  o.querySelector('#i1').onclick = async () => { try { await navigator.share({ text: msg }); } catch {} }; copyBtn(o, '#i2', msg);
}
export function joinCodeSheet() {
  const o = sheet(html`<h2>🎟️ 輸入邀請碼</h2><label>邀請碼<input id="jc" autocomplete="off" autocapitalize="characters" placeholder="XXXXX-XXXXX"></label><button class="save on" id="jgo">加入</button>${isAdmin() ? html`<div class="day">管理員找回</div><label>旅程編號<input id="rt" autocomplete="off"></label><label>管理員恢復碼<input id="rk" autocomplete="off" autocapitalize="characters"></label><button class="pay" id="rgo">用恢復碼找回管理員</button>` : ''}`);
  o.querySelector('#jgo').onclick = () => doJoin(o.querySelector('#jc').value, o);
  if (o.querySelector('#rgo')) o.querySelector('#rgo').onclick = () => doRecover(o.querySelector('#rt').value.trim(), o.querySelector('#rk').value, o);
}
export const joinInput = v => { v = String(v || '').trim(); return /^LGR[01]\./.test(v.replace(/\s+/g, '')) ? preview(v, null) : doJoin(v); };
