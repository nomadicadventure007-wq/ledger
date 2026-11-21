import { fingerprint, gaps } from '../../core/sync.js';
import { RATE_FACTOR, tolOf } from '../../core/rules.js';
import { cl, dirtyList } from '../../features/sync.js';
import { S, anyAdmin, cats, isAdmin, me, owner } from '../../state.js';
import { app, fmtT, ic, opts, who, html, setHtml } from '../util.js';
import { badBlock } from '../blocks.js';

function fileSyncBlock() {
  const st = S.dev.syncs[S.trip.id]?.members || {}, g = gaps(S.entries);
  return html`${html`<div class="day">同步</div><div class="item hero"><span class="ic">🔗</span><div class="t"><div>資料指紋 #${fingerprint(S.entries)}</div><small>${S.entries.length} 筆</small></div></div>`}${(g.length ? html`<div class="item"><div class="t"><div>⚠️ 有 ${g.reduce((a, x) => a + x.miss.length, 0)} 筆缺漏</div><small>請 ${g.map(x => who(S.entries.find(e => e.deviceId === x.dev)?.author).name).join('、')} 傳「完整」資料</small></div></div>` : '')}${html`<button class="save on" data-a="send" style="margin:6px 0">📤 傳給對方</button><button class="pay" data-a="recv">📥 收進來</button>`}${S.trip.members.filter(m => m.id !== me()).map(m => html`<div class="item"><span class="ic">${who(m.id).avatar}</span><div class="t"><div>${m.name}</div><small>${st[m.id] ? '上次收到：' + fmtT(st[m.id].t) : '還沒收過 ⚠️'}</small></div></div>`)}`;
}
function backupBlock() {
  const t = S.dev.lastBackup;
  return html`<div class="day">備份</div><div class="item"><div class="t"><div>${t ? '上次備份：' + fmtT(t) : '還沒備份過'}</div></div></div><button class="pay" data-a="backup">💾 備份（全部旅程）</button>`;
}
function cloudBlock() {
  const c = cl(), n = dirtyList().length, A = isAdmin(), ms = c.members || [];
  return html`${html`<div class="day">雲端</div><div class="item hero"><span class="ic">☁️</span><div class="t"><div>${c.dead ? '⚠️ 憑證失效' : c.err ? '離線中' : '已連線'}</div><small>${c.last ? '上次同步 ' + fmtT(c.last) : '尚未同步'}${n ? ' · ' + n + ' 筆待送' : ''}${c.err && !c.dead ? ' · ' + c.err : ''}</small></div></div><button class="save on" data-a="syncnow" style="margin:6px 0">🔄 立即同步</button>`}${(A ? html`${S.trip.members.filter(m => m.id !== owner()).map(m => { const x = ms.find(y => y.id === m.id); return html`<div class="item"><span class="ic">${who(m.id).avatar}</span><div class="t"><div>${m.name}</div><small>${x?.joined ? (x.lastSeen ? '上次上線 ' + fmtT(x.lastSeen) : '已加入') : '還沒加入'}</small></div><button class="pay" style="width:auto;margin:0" data-inv="${m.id}">邀請碼</button><button class="pay" style="width:auto;margin:0 0 0 6px;background:#fee2e2;color:#be123c" data-rvk="${m.id}">撤銷</button></div>`; })}${html`<div class="item"><div class="t"><small>旅程編號</small><div style="word-break:break-all">${S.trip.id}</div></div></div>`}` : '')}${html`<button class="pay" data-a="detach">離開雲端</button>`}${(A ? html`<button class="pay" data-a="clouddel" style="background:#fee2e2;color:#be123c">刪除雲端旅程</button>` : '')}`;
}
function syncBlock() {
  if (cl()) return html`${cloudBlock()}${html`<button class="pay" data-a="${isAdmin() ? 'recv' : 'send'}">${isAdmin() ? '📥 收進來' : '📤 傳給對方'}</button>`}`;
  return html`${html`<div class="day">雲端</div>${isAdmin() ? html`<button class="save on" data-a="cloud" style="margin:6px 0">☁️ 把這趟旅程搬到雲端</button>` : ''}<button class="pay" data-a="joincode">🎟️ 輸入邀請碼加入</button>`}${fileSyncBlock()}`;
}
function csvBlock() {
  return html`<div class="day">CSV 匯出／匯入</div><button class="save on" data-a="csvx" style="margin-bottom:8px">⬇︎ 匯出帳目 CSV</button><div class="r1" style="grid-template-columns:1fr 1fr;margin:0"><button class="pay" data-a="csvw">⬇︎ 錢包</button><button class="pay" data-a="csvs">⬇︎ 結算</button></div><button class="pay" data-a="csvi">⬆︎ 匯入 CSV（本 App 或舊版）</button>`;
}
export function renderSet() {
  const A = isAdmin(), t = S.trip, row = (ic, n, at) => html`<div class="item" ${at}><span class="ic">${ic}</span><div class="t"><div>${n}</div></div></div>`;
  const ppl = k => html`${t[k].map(m => row(who(m.id).avatar, m.name + (m.id === t.adminId ? ' 👑' : ''), html`data-pp="${k}|${m.id}"`))}${html`<button class="pay" data-pp="${k}|">＋ 新增</button>`}`;
  const adminSecs = A ? html`${html`<div class="day">成員</div>${ppl('members')}<div class="day">公款</div>${ppl('funds')}<div class="day">分類</div>`}${cats().map(c => row(ic('cat-' + c[0], c[1]), c[2], html`data-cc="${c[0]}"`))}${html`<button class="pay" data-cc="">＋ 新增</button><div class="day">匯率</div>`}${Object.entries(t.rates).map(([c, r]) => html`<div class="item"><div class="t"><div>${c}</div></div>${c === 'TWD' ? html`<div class="a">${r}</div>` : html`<input class="rate" type="number" step="any" data-rate="${c}" value="${r}" aria-label="${c} 的匯率">`}</div>`)}${html`<button class="pay" data-a="newcur">＋ 幣別</button><div class="day">預算</div>`}${row('💰', t.budget?.total ? `NT$ ${t.budget.total.toLocaleString()} · ${t.budget.days || '?'} 天` : '還沒設定', html`data-bud=""`)}${html`<div class="day">待確認的容許範圍</div><div class="item"><div class="t"><div>台幣金額差距超過就請管理員確認</div><small>匯率放寬為 ${tolOf(t) * RATE_FACTOR}%</small></div><input class="rate" type="number" step="any" min="0" max="50" inputmode="decimal" data-tol="1" value="${tolOf(t)}" aria-label="容許百分比"><div class="a">%</div></div>`}` : '';
  setHtml(app, html`${html`<h1>設定</h1><div class="cols"><div class="item hero"><span class="ic">${who(owner()).avatar}</span><div class="t"><div>這支手機是 ${who(owner()).name}${me() !== owner() ? '，代 ' + who(me()).name + ' 操作' : ''}</div><small>${A ? '👑 管理員' : '成員'}</small></div></div>${A ? html`<label class="field">代誰操作<select id="meSel">${opts(t.members.map(m => [m.id, m.name]), me())}</select></label>` : ''}${syncBlock()}${badBlock()}${A ? [backupBlock(), csvBlock()] : ''}`}${(A || S.db.trips.length > 1 ? html`${html`<div class="day">旅程</div>`}${S.db.trips.map(x => row(x.id === t.id ? '📍' : '🧳', x.name, x.id === t.id && !A ? '' : html`data-trip="${x.id}"`))}` : '')}${(anyAdmin() ? html`<button class="pay" data-a="newtrip">＋ 新旅程</button>` : '')}${html`${adminSecs}<div class="day">說明</div><a class="item" href="help/user.html" target="_blank" rel="noopener"><span class="ic">📖</span><div class="t"><div>使用說明</div></div></a>${A ? html`<a class="item" href="help/admin.html" target="_blank" rel="noopener"><span class="ic">🛠️</span><div class="t"><div>管理者說明</div></div></a>` : ''}</div>`}`);
}
