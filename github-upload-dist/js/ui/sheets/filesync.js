import { FMT, dupIds, fingerprint, gaps, isPending, merge } from '../../core/sync.js';
import { save } from '../../core/store.js';
import { pack, unpack } from '../../features/pack.js';
import { cloudApi } from '../../core/cloud.js';
import { signWith } from '../../core/hmac.js';
import { cl, persist, syncNow } from '../../features/sync.js';
import { switchTrip } from '../../features/trips.js';
import { S, isAdmin, owner, settingsOf } from '../../state.js';
import { render } from '../render.js';
import { restoreSheet } from './restore.js';
import { opts, sheet, toast, html } from '../util.js';

export async function sendSheet() {
  const o = sheet(html`<h2>📤 傳給對方</h2><label class="chk"><input type="checkbox" id="inc"> 只傳上次之後新的（較短，但對方要收齊每一包）</label><textarea id="code" readonly rows="4"></textarea><small id="len"></small>
   <button class="save on" id="s1">分享文字碼（LINE）</button><button class="pay" id="s2">分享檔案（AirDrop）</button><button class="pay" id="s3">複製文字碼</button>`);
  const q = k => o.querySelector(k); let code = '';
  const build = async () => { const since = q('#inc').checked ? S.dev.syncs[S.trip.id]?.lastExport || 0 : 0; const es = S.entries.filter(e => e.updatedAt > since), tk = cl()?.token, head = { v: FMT, me: owner(), t: Date.now(), trip: settingsOf(S.trip) }, ej = JSON.stringify(es); code = await pack(tk ? { ...head, ej, sig: await signWith(tk, ej) } : { ...head, entries: es }); q('#code').value = code; q('#len').textContent = `${code.length} 字元` + (code.length > 9000 ? '，LINE 可能放不下，請改用「檔案」' : ''); };
  const done = () => { (S.dev.syncs[S.trip.id] ||= { members: {} }).lastExport = Date.now(); persist(); };
  q('#inc').onchange = build; await build();
  q('#s1').onclick = async () => { try { navigator.share ? await navigator.share({ text: code }) : await navigator.clipboard.writeText(code); done(); } catch {} };
  q('#s2').onclick = async () => { try { const f = new File([code], 'ledger-sync.txt', { type: 'text/plain' }); if (!navigator.canShare?.({ files: [f] })) return toast('這裡不能分享檔案，請用複製'); await navigator.share({ files: [f] }); done(); } catch {} };
  q('#s3').onclick = async () => { try { await navigator.clipboard.writeText(code); done(); toast('已複製 📋'); } catch { q('#code').select(); } };
}
export function recvSheet() {
  const o = sheet(html`<h2>📥 收進來</h2><textarea id="rc" rows="4" placeholder="把對方傳來的文字碼貼在這裡"></textarea><button class="pay" id="rp">📋 從剪貼簿貼上</button><label class="field">或選擇檔案<input id="rf" type="file" accept=".txt,text/plain"></label><button class="save on" id="rok">預覽</button>`);
  const q = k => o.querySelector(k);
  q('#rp').onclick = async () => { try { q('#rc').value = await navigator.clipboard.readText(); } catch { toast('請長按輸入框貼上'); } };
  q('#rf').onchange = async e => { if (e.target.files[0]) q('#rc').value = await e.target.files[0].text(); };
  q('#rok').onclick = () => preview(q('#rc').value, o);
}
export async function preview(code, o) {
  let P; try { P = await unpack(code); } catch { return toast('這個碼讀不懂，請對方重傳 😢'); }
  if (P?.ej && !P.entries) { try { P.entries = JSON.parse(P.ej); } catch { return toast('這個碼讀不懂，請對方重傳 😢'); } }
  if (P?.kind === 'backup' && P.v === FMT) return restoreSheet(P, o);
  if (P?.v !== FMT || !P.trip) return toast('版本不同，請兩邊都更新 App');
  if (!S.db.trips.some(t => t.id === P.trip.id)) return joinSheet(P, o);
  if (P.trip.id !== S.trip.id) await switchTrip(P.trip.id);
  const useSet = P.me === P.trip.adminId && (!isAdmin() || P.trip.adminId !== S.trip.adminId), adm = useSet ? P.trip.adminId : S.trip.adminId;
  const r = merge(S.entries, P.entries, { adminId: adm }), tmp = { ...S.trip, ...(useSet ? P.trip : {}) }, pend = r.entries.filter(e => isPending(e, tmp) && !isPending(e, S.trip)).length, g = gaps(r.entries);
  const from = S.trip.members.find(m => m.id === P.me)?.name || '對方';
  o?.remove(); const w = sheet(html`<h2>預覽：${from} 的資料</h2><div class="item"><div class="t"><div>➕ 新增 ${r.stats.added} 筆</div><div>✏️ 更新 ${r.stats.updated} 筆</div><div>⚔️ 兩邊都改過 ${r.stats.conflicts} 筆</div><div>⏳ 待管理員確認 ${pend} 筆</div><div>⚠️ 可能重複 ${dupIds(r.entries).size} 筆</div>${useSet ? html`<small>※ 成員、匯率、分類會以管理員為準</small>` : ''}${g.length ? html`<small>⚠️ 還缺 ${g.reduce((a, x) => a + x.miss.length, 0)} 筆，請對方傳「完整」資料</small>` : ''}</div></div><button class="save on" id="mok">合併 ✨</button><button class="pay" id="mno">取消</button>`);
  w.querySelector('#mno').onclick = () => w.remove();
  w.querySelector('#mok').onclick = async () => {
    if (cl() && isAdmin()) {
      if (!P.sig) return toast('這包沒有簽章（舊版，或對方沒連雲端），雲端旅程不收。請對方更新後重傳');
      toast('送出中…'); const x = await cloudApi('POST', `/api/trips/${S.trip.id}/push`, { import: { member: P.me, ej: P.ej, sig: P.sig } }, cl().token);
      if (x.error) return toast('⚠️ ' + x.error);
      w.remove(); await syncNow(); return toast(`收進 ${x.accepted.length} 筆` + (x.rejected.length ? `，${x.rejected.length} 筆被擋：${x.rejected[0].reason}` : ''));
    }
    S.entries = r.entries; if (useSet) Object.assign(S.trip, P.trip);
    const sy = (S.dev.syncs[S.trip.id] ||= { members: {} }); sy.members[P.me] = { t: Date.now(), n: P.entries.length };
    persist(); w.remove(); render(); toast('合併好囉 🔗 #' + fingerprint(S.entries));
  };
}
function joinSheet(P, o) {
  o?.remove(); const w = sheet(html`<h2>加入「${P.trip.name}」</h2><label>你是誰？<select id="js">${opts(P.trip.members.map(m => [m.id, m.name]), '')}</select></label><button class="save on" id="jok">加入 🧳</button>`);
  w.querySelector('#jok').onclick = async () => {
    const t = P.trip; S.db.trips.push(t); S.db.trips = S.db.trips.filter(x => !x.ph); S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = w.querySelector('#js').value; await save('entries:' + t.id, P.entries);
    (S.dev.syncs[t.id] = { members: { [P.me]: { t: Date.now(), n: P.entries.length } } }); w.remove(); await switchTrip(t.id);
  };
}
