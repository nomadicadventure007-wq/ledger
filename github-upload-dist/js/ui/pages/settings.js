import { fingerprint, gaps } from '../../core/sync.js';
import { A, adminReady, lockedCard } from '../../features/admin.js';
import { cl, dirtyList } from '../../features/sync.js';
import { S, anyAdmin, isAdmin, me, owner } from '../../state.js';
import { app, fmtT, who, html, setHtml } from '../util.js';
import { badBlock } from '../blocks.js';

function fileSyncBlock() {
  const st = S.dev.syncs[S.trip.id]?.members || {}, g = gaps(S.entries);
  return html`${html`<div class="day">同步</div><div class="item hero"><span class="ic">🔗</span><div class="t"><div>資料指紋 #${fingerprint(S.entries)}</div><small>${S.entries.length} 筆</small></div></div>`}${(g.length ? html`<div class="item"><div class="t"><div>⚠️ 有 ${g.reduce((a, x) => a + x.miss.length, 0)} 筆缺漏</div><small>請 ${g.map(x => who(S.entries.find(e => e.deviceId === x.dev)?.author).name).join('、')} 傳「完整」資料</small></div></div>` : '')}${html`<button class="save on" data-a="send" style="margin:6px 0">📤 傳給對方</button><button class="pay" data-a="recv">📥 收進來</button>`}${S.trip.members.filter(m => m.id !== me()).map(m => html`<div class="item"><span class="ic">${who(m.id).avatar}</span><div class="t"><div>${m.name}</div><small>${st[m.id] ? '上次收到：' + fmtT(st[m.id].t) : '還沒收過 ⚠️'}</small></div></div>`)}`;
}
function cloudBlock(ap) {
  const c = cl(), n = dirtyList().length;
  return html`${html`<div class="day">雲端</div><div class="item hero"><span class="ic">☁️</span><div class="t"><div>${c.dead ? '⚠️ 憑證失效' : c.err ? '離線中' : '已連線'}</div><small>${c.last ? '上次同步 ' + fmtT(c.last) : '尚未同步'}${n ? ' · ' + n + ' 筆待送' : ''}${c.err && !c.dead ? ' · ' + c.err : ''}</small></div></div><button class="save on" data-a="syncnow" style="margin:6px 0">🔄 立即同步</button>`}${ap.cloudMembers ?? ''}${html`<button class="pay" data-a="detach">離開雲端</button>`}${ap.cloudDel ?? ''}`;
}
function syncBlock(ap) {
  if (cl()) return html`${cloudBlock(ap)}${html`<button class="pay" data-a="${isAdmin() ? 'recv' : 'send'}">${isAdmin() ? '📥 收進來' : '📤 傳給對方'}</button>`}`;
  return html`${html`<div class="day">雲端</div>${ap.cloudUp ?? ''}<button class="pay" data-a="joincode">🎟️ 輸入邀請碼加入</button>`}${fileSyncBlock()}`;
}
export function renderSet() {
  const A_ = isAdmin(), t = S.trip, row = (ic, n, at) => html`<div class="item" ${at}><span class="ic">${ic}</span><div class="t"><div>${n}</div></div></div>`;
  const ap = A_ && adminReady() ? A.settingsParts() : {}, locked = A_ && !adminReady() ? lockedCard() : '';
  setHtml(app, html`${html`<h1>設定</h1><div class="cols"><div class="item hero"><span class="ic">${who(owner()).avatar}</span><div class="t"><div>這支手機是 ${who(owner()).name}${me() !== owner() ? '，代 ' + who(me()).name + ' 操作' : ''}</div><small>${A_ ? '👑 管理員' : '成員'}</small></div></div>${ap.top ?? ''}${locked}${syncBlock(ap)}${badBlock()}${ap.mid ?? ''}`}${(A_ || S.db.trips.length > 1 ? html`${html`<div class="day">旅程</div>`}${S.db.trips.map(x => row(x.id === t.id ? '📍' : '🧳', x.name, x.id === t.id && !A_ ? '' : html`data-trip="${x.id}"`))}` : '')}${(anyAdmin() ? ap.newTrip ?? '' : '')}${html`${ap.secs ?? ''}<div class="day">說明</div><a class="item" href="help/user.html" target="_blank" rel="noopener"><span class="ic">📖</span><div class="t"><div>使用說明</div></div></a>${ap.help ?? ''}</div>`}`);
}
