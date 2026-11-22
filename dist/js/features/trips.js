import { load, save } from '../core/store.js';
import { cloudApi } from '../core/cloud.js';
import { fixDates } from './dates.js';
import { persist, syncNow } from './sync.js';
import { S, resetForm, saveAll, settingsOf, loadEntries } from '../state.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/util.js';

export async function attachTrip(tripId, settings, memberId, token) {
  let t = S.db.trips.find(x => x.id === tripId); if (!t) { t = settings; S.db.trips.push(t); await save('entries:' + t.id, []); } else Object.assign(t, settings);
  S.dev.ownerBy[t.id] = S.dev.meBy[t.id] = memberId; S.dev.cloud[t.id] = { token, rev: 0, sj: JSON.stringify(settingsOf(t)), last: 0 };
  S.db.trips = S.db.trips.filter(x => !x.ph); await switchTrip(t.id);
}
export async function doJoin(code, o) {
  if (!String(code || '').trim()) return; const r = await cloudApi('POST', '/api/join', { code }); if (r.error) return toast('⚠️ ' + r.error);
  o?.remove(); await attachTrip(r.tripId, r.settings, r.memberId, r.token); syncNow(true);
}
export async function cleanupLeftover() {
  if (!S.db.trips.some(t => S.dev.cloud[t.id] && S.dev.ownerBy[t.id] !== t.adminId)) return;
  for (const t of [...S.db.trips]) if (!S.dev.cloud[t.id] && (t.ph || (t.name === '新旅程' && S.dev.ownerBy[t.id] === t.adminId))) { const es = t.id === S.trip.id ? S.entries : await load('entries:' + t.id, []); if (!es.length) S.db.trips = S.db.trips.filter(x => x !== t); }
  if (!S.db.trips.some(t => t.id === S.trip.id)) { S.trip = S.db.trips[0]; S.db.cur = S.trip.id; S.entries = await loadEntries(S.trip.id); } await saveAll();
}
export async function switchTrip(id) {
  await persist(); S.db.cur = id; S.trip = S.db.trips.find(t => t.id === id); S.entries = await loadEntries(id); fixDates(); resetForm(); await persist(); S.page = 'set'; render(); toast('已切換 🧳');
}
