import { cloudApi } from '../core/cloud.js';
import { S, isAdmin, saveAll, settingsOf } from '../state.js';
import { render } from '../ui/render.js';
import { callAdmin } from './admin.js';
import { toast } from '../ui/util.js';

const PUSH_BATCH = 100;

export const persist = () => { scheduleSync(); return saveAll(); };
export const cl = () => S.dev.cloud?.[S.trip.id], strip = ({ _s, ...x }) => x, dirtyList = () => S.entries.filter(e => e._s !== e.updatedAt);
let syncing = false, syncTimer;
function scheduleSync(ms = 1500) { clearTimeout(syncTimer); if (cl() && !cl().dead) syncTimer = setTimeout(() => syncNow(), ms); }
function softRender() { if (document.querySelector('.scrim')) return; if (S.page === 'log' && (S.f.desc || S.f.amt)) return; render(); }
export async function syncNow(manual) {
  const c = cl(); if (!c || c.dead || syncing) return; syncing = true; const tid = S.trip.id;
  try {
    const dirty = dirtyList(), pushed = new Map(dirty.map(e => [e.id, e.updatedAt])), payload = dirty.map(strip), sj = JSON.stringify(settingsOf(S.trip)), pushSet = isAdmin() && sj !== c.sj, rejected = []; let newRec;
    for (let i = 0; i === 0 || i * PUSH_BATCH < dirty.length; i++) {
      if (!dirty.length && !pushSet) break;
      const r = await cloudApi('POST', `/api/trips/${tid}/push`, { entries: payload.slice(i * PUSH_BATCH, (i + 1) * PUSH_BATCH), ...(i === 0 && pushSet ? { settings: settingsOf(S.trip) } : {}) }, c.token);
      if (r.error) throw r; rejected.push(...r.rejected); if (r.newRecoveryCode) newRec = r.newRecoveryCode; if (i === 0 && pushSet) c.sj = sj;
    }
    const rej = new Set(rejected.map(x => x.id)), got = new Set(); let since = rejected.length ? 0 : Math.max(0, (c.rev || 0) - 20);
    for (;;) {
      const r = await cloudApi('GET', `/api/trips/${tid}/sync?since=${since}`, null, c.token); if (r.error) throw r;
      if (S.trip.id !== tid) return;
      const m = new Map(S.entries.map(e => [e.id, e]));
      for (const e of r.entries) { const l = m.get(e.id); got.add(e.id); if (l && l._s !== l.updatedAt && pushed.get(e.id) !== l.updatedAt && !rej.has(e.id)) continue; m.set(e.id, { ...e, _s: e.updatedAt }); }
      S.entries = [...m.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || (a.id < b.id ? -1 : 1));
      if (r.settings && (!isAdmin() || r.settings.adminId !== S.trip.adminId)) { Object.assign(S.trip, r.settings); c.sj = JSON.stringify(settingsOf(S.trip)); }
      c.rev = r.rev; c.members = r.members; if (!r.more) break; since = r.rev;
    }
    S.entries = S.entries.filter(e => !(rej.has(e.id) && !got.has(e.id)));
    c.err = null; c.last = Date.now(); await saveAll();
    if (rejected.length) toast('⚠️ ' + [...new Set(rejected.map(x => x.reason))].join('、'), undefined, undefined, 5000);
    else if (manual) toast('同步好了 ✅');
    if (newRec) callAdmin('recoverySheet', newRec);
    softRender();
  } catch (e) { c.err = e.error || '同步失敗'; if (e.status === 401) { c.dead = true; c.err = '憑證失效，請重新用邀請碼加入'; } if (manual) toast('⚠️ ' + c.err); if (S.page === 'set') softRender(); }
  finally { syncing = false; }
}
