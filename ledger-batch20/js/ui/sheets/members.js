import { CATS, newTrip, uid } from '../../core/model.js';
import { load, save } from '../../core/store.js';
import { persist } from '../../features/sync.js';
import { switchTrip } from '../../features/trips.js';
import { DENY, S, isAdmin, owner, resetForm, used, loadEntries } from '../../state.js';
import { render } from '../render.js';
import { okPath, sheet, shrink, shrinkPng, toast, html } from '../util.js';

function applyFresh(t, o) {
  const names = o.querySelector('#tm').value.split(/[,，、]/).map(x => x.trim()).filter(Boolean).slice(0, 10), AV = ['🐬', '🌻', '🦊', '🐼', '🐸', '🐙', '🦁', '🐧', '🐰', '🐻'];
  if (names.length) { t.members = names.map((n, i) => ({ id: 'm' + (i + 1), name: n, avatar: AV[i] })); t.adminId = 'm1'; }
  const rates = {}; for (const l of o.querySelector('#tr').value.split('\n')) { const m = l.trim().match(/^([A-Za-z]{2,4})[\s:=,]+([\d.]+)/); if (m && +m[2] > 0) rates[m[1].toUpperCase()] = parseFloat(m[2]); }
  if (Object.keys(rates).length) { rates.TWD = 1; t.rates = rates; }
}
export function personSheet(kind, id) {
  if (!isAdmin()) return toast(DENY);
  const list = S.trip[kind], p = list.find(x => x.id === id) || { id: (kind === 'funds' ? 'f' : 'm') + uid(), name: '', avatar: kind === 'funds' ? '🍔' : '🙂', _new: 1 }; let img = p.img, fromFile = false;
  const o = sheet(html`<h2>${kind === 'funds' ? '公款' : '成員'}</h2><label>名字<input id="pn" value="${p.name}"></label><label>表情符號<input id="pe" value="${p.avatar}"></label><label>照片<input id="pf" type="file" accept="image/*"></label>
   <label>圖片檔名<input id="pi" placeholder="img/smile.png" value="${p.img && !p.img.startsWith('data:') ? p.img : ''}" autocomplete="off"></label>${p.img ? html`<button class="pay" id="pr">移除照片</button>` : ''}<button class="save on" id="pok">存好 ✨</button>${!p._new && kind === 'members' && p.id !== S.trip.adminId ? html`<button class="pay" id="pa">設為管理員 👑</button>` : ''}${!p._new ? html`<button class="pay" id="pd" style="background:#fee2e2;color:#be123c">刪除</button>` : ''}`);
  const q = k => o.querySelector(k), end = m => { persist(); o.remove(); render(); toast(m); };
  q('#pf').onchange = async e => { if (e.target.files[0]) { img = await shrink(e.target.files[0]); fromFile = true; toast('照片好了 📷'); } };
  if (q('#pr')) q('#pr').onclick = () => { img = null; q('#pr').remove(); };
  q('#pok').onclick = () => { const n = q('#pn').value.trim(); if (!n) return; const typed = q('#pi').value.trim(); if (typed && !okPath(typed)) return toast('圖片檔名要像 img/smile.png'); if (!fromFile) { if (typed) img = typed; else if (p.img && !p.img.startsWith('data:')) img = null; } Object.assign(p, { name: n, avatar: q('#pe').value.trim() || '🙂', img: img || undefined }); delete p._new; if (!list.includes(p)) list.push(p); end('存好囉 ✨'); };
  if (q('#pa')) q('#pa').onclick = () => { S.trip.adminId = p.id; end('管理員換人了 👑'); };
  if (q('#pd')) q('#pd').onclick = () => { if (p.id === S.trip.adminId || list.length <= 1) return toast('管理員和最後一個不能刪'); if (used(p.id)) return toast('已有紀錄用到，不能刪'); list.splice(list.indexOf(p), 1); end('刪掉了'); };
}
export function catSheet(id) {
  if (!isAdmin()) return toast(DENY);
  S.trip.cats ||= CATS.map(c => [...c]); const L = S.trip.cats, c = L.find(x => x[0] === id) || ['c' + uid(), '📦', '', '#E5E7EB', 1];
  const o = sheet(html`<h2>分類</h2><label>名字<input id="cn" value="${c[2]}"></label><label>表情符號<input id="ce" value="${c[1]}"></label><label>顏色<input id="cc" type="color" value="${c[3].length === 7 ? c[3] : '#E5E7EB'}"></label><label>圖片<input id="cpf" type="file" accept="image/*"></label><label>圖片檔名<input id="cpi" placeholder="img/food.png" value="${S.trip.catImg?.[c[0]] && !S.trip.catImg[c[0]].startsWith('data:') ? S.trip.catImg[c[0]] : ''}" autocomplete="off"></label>${S.trip.catImg?.[c[0]] ? html`<button class="pay" id="cpr">移除自訂圖片</button>` : ''}<button class="save on" id="cok">存好 ✨</button>${c[4] ? '' : html`<button class="pay" id="cd" style="background:#fee2e2;color:#be123c">刪除（舊紀錄會變「雜支」）</button>`}`);
  let img = S.trip.catImg?.[c[0]], fromFile = false; const end = m => { persist(); o.remove(); render(); toast(m); };
  o.querySelector('#cpf').onchange = async e => { if (e.target.files[0]) { img = await shrinkPng(e.target.files[0]); fromFile = true; toast('圖片好了 🖼️'); } };
  if (o.querySelector('#cpr')) o.querySelector('#cpr').onclick = () => { img = null; o.querySelector('#cpr').remove(); };
  o.querySelector('#cok').onclick = () => { const n = o.querySelector('#cn').value.trim(); if (!n) return; const typed = o.querySelector('#cpi').value.trim(); if (typed && !okPath(typed)) return toast('圖片檔名要像 img/food.png'); if (!fromFile) { if (typed) img = typed; else if (S.trip.catImg?.[c[0]] && !S.trip.catImg[c[0]].startsWith('data:')) img = null; } if (img) (S.trip.catImg ||= {})[c[0]] = img; else if (S.trip.catImg) delete S.trip.catImg[c[0]]; c[1] = o.querySelector('#ce').value.trim() || '📦'; c[2] = n; c[3] = o.querySelector('#cc').value; if (c[4]) { delete c[4]; L.push(c); } end('存好囉 ✨'); };
  if (o.querySelector('#cd')) o.querySelector('#cd').onclick = () => { if (L.length <= 2) return toast('至少留兩個分類'); L.splice(L.indexOf(c), 1); end('刪掉了'); };
}
export function curSheet() {
  const o = sheet(html`<h2>新增幣別</h2><label>代碼<input id="kc" maxlength="4" placeholder="JPY"></label><label>匯率（台幣）<input id="kr" type="number" step="any" inputmode="decimal"></label><button class="save on" id="kok">加進去 ✨</button>`);
  o.querySelector('#kok').onclick = () => { const c = o.querySelector('#kc').value.trim().toUpperCase(), r = +o.querySelector('#kr').value; if (!c || !(r > 0)) return; S.trip.rates[c] = r; persist(); o.remove(); render(); };
}
export function tripSheet(id) {
  const cur = id && S.db.trips.find(x => x.id === id);
  const o = sheet(html`<h2>${cur ? '旅程改名' : '新旅程'}</h2><label>名字<input id="tn" value="${cur ? cur.name : ''}" placeholder="例：波士尼亞 2026"></label>${cur && S.db.trips.length > 1 ? html`<button class="pay" id="trm" style="background:#fee2e2;color:#be123c">從這支手機移除</button>` : ''}${cur ? '' : html`<label class="chk"><input type="checkbox" id="tc" checked> 沿用目前的成員、公款、幣別、分類</label><div id="tf" class="fresh" hidden><label>成員<input id="tm" placeholder="Ann, Bob, Cat" value="Smile, Jiani" autocomplete="off"></label><label>幣別與匯率<textarea id="tr" placeholder="JPY 0.23" rows="4">${Object.entries(S.trip.rates).filter(([c]) => c !== 'TWD').map(([c, r]) => c + ' ' + r).join('\n')}</textarea></label></div>`}<button class="save on" id="tok">${cur ? '存好' : '出發 🧳'}</button>`);
  o.querySelector('#tc')?.addEventListener('change', e => { o.querySelector('#tf').hidden = e.target.checked; });
  if (o.querySelector('#trm')) o.querySelector('#trm').onclick = async e => {
    if (!e.target.dataset.sure) { e.target.dataset.sure = 1; return e.target.textContent = '再按一次確認（只影響這支手機，記得先備份）'; }
    const next = S.db.trips.find(x => x.id !== cur.id); await save('entries:' + cur.id, []); S.db.trips = S.db.trips.filter(x => x.id !== cur.id); delete S.dev.meBy[cur.id]; delete S.dev.ownerBy[cur.id];
    S.trip = next; S.db.cur = next.id; S.entries = await loadEntries(next.id); resetForm(); await persist(); o.remove(); render(); toast('已移除 🗑️');
  };
  o.querySelector('#tok').onclick = async () => {
    const n = o.querySelector('#tn').value.trim() || '新旅程'; if (cur) { cur.name = n; persist(); o.remove(); return render(); }
    const t = newTrip(); t.name = n; if (o.querySelector('#tc').checked) { const c = structuredClone(S.trip); Object.assign(t, { members: c.members, funds: c.funds, rates: c.rates, cats: c.cats, adminId: owner() }); } else applyFresh(t, o); S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = t.adminId;
    S.db.trips.push(t); S.db.trips = S.db.trips.filter(x => !x.ph); o.remove(); await switchTrip(t.id);
  };
}
