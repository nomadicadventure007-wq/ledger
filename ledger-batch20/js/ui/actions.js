import { exportCsv, exportSettleCsv, exportWalletCsv } from '../features/csv.js';
import { syncNow } from '../features/sync.js';
import { S, isAdmin, payerIds } from '../state.js';
import { renderLog, submit } from './pages/log.js';
import { advSheet } from './sheets/adv.js';
import { backupSheet } from './sheets/backup.js';
import { cloudSheet, delSheet, detachSheet, joinCodeSheet } from './sheets/cloud.js';
import { exSheet } from './sheets/edit.js';
import { recvSheet, sendSheet } from './sheets/filesync.js';
import { importSheet } from './sheets/import.js';
import { curSheet, tripSheet } from './sheets/members.js';
import { $, toast } from './util.js';
import { badSheet } from './sheets/bad.js';

export function act(a) {
  if (!isAdmin() && ['backup', 'csvx', 'csvhist', 'csvw', 'csvs', 'csvi', 'cloud', 'clouddel'].includes(a)) return;
  const f = S.f, ids = payerIds(), mem = S.trip.members.map(m => m.id), fund = S.trip.funds[0].id;
  if (a === 'go') return submit();
  if (a === 'ex') return exSheet();
  if (a === 'adv') return advSheet();
  if (a === 'backup') return backupSheet();
  if (a === 'bad') return badSheet();
  if (a === 'csvx') return exportCsv('expenses', S.entries.filter(e => !e.deleted));
  if (a === 'csvhist') return exportCsv('expenses-filtered', S.histList || []);
  if (a === 'csvw') return exportWalletCsv();
  if (a === 'csvs') return exportSettleCsv();
  if (a === 'csvi') return importSheet();
  if (a === 'cloud') return cloudSheet();
  if (a === 'detach') return detachSheet();
  if (a === 'clouddel') return delSheet();
  if (a === 'joincode') return joinCodeSheet();
  if (a === 'syncnow') { toast('同步中…'); return syncNow(true); }
  if (a === 'send') return sendSheet();
  if (a === 'recv') return recvSheet();
  if (a === 'newtrip') return tripSheet();
  if (a === 'newcur') return curSheet();
  if (a === 'cur') { const c = Object.keys(S.trip.rates); f.cur = c[(c.indexOf(f.cur) + 1) % c.length]; }
  if (a === 'method') { f.method = f.method === 'cash' ? 'credit' : 'cash'; f.pin = ''; }
  if (a === 'payer') { f.payer = ids[(ids.indexOf(f.payer) + 1) % ids.length]; f.shares = [f.payer]; f.pin = ''; }
  if (a === 'shares') f.shares = f.shares.length === 1 && f.shares[0] === f.payer && f.payer !== fund ? [...mem] : f.shares[0] === fund ? [f.payer === fund ? mem[0] : f.payer] : [fund];
  renderLog(); $('#d').focus({ preventScroll: true });
}
