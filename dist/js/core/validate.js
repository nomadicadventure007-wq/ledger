const DATE = /^\d{4}-\d{2}-\d{2}$/, DIG = /^\d{1,17}$/, SIGNED = /^-?\d{1,17}$/, CUR = /^[A-Za-z0-9]{1,8}$/;
const str = v => typeof v === 'string', opt = (v, f) => v === undefined || v === null || f(v);
export function entryProblem(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return '不是一筆紀錄';
  if (!str(e.id) || !e.id || e.id.length > 64) return '編號不對';
  if (e.type !== 'expense' && e.type !== 'exchange' && e.type !== 'settle') return '類型不明';
  if (!str(e.date) || !DATE.test(e.date)) return '日期不對';
  if (e.type === 'settle') return !str(e.from) || !str(e.to) ? '結清的對象不對' : !str(e.twdMicro) || !DIG.test(e.twdMicro) ? '結清金額不對' : '';
  if (!str(e.cur) || !CUR.test(e.cur)) return '幣別不對';
  if (!Number.isSafeInteger(e.minor) || Math.abs(e.minor) > 1e12) return '金額不對';
  if (!str(e.rate) || !DIG.test(e.rate)) return '匯率不對';
  if (!str(e.twdMicro) || !SIGNED.test(e.twdMicro)) return '台幣金額不對';
  if (e.type === 'exchange') return !str(e.owner) ? '換匯的持有人不對' : e.minor <= 0 ? '換匯金額要大於 0' : '';
  if (!str(e.desc)) return '品項不對';
  if (!str(e.payer)) return '付款人不對';
  if (!Array.isArray(e.shares) || !e.shares.length || e.shares.length > 30 || !e.shares.every(str)) return '分攤對象不對';
  if (!opt(e.method, v => v === 'cash' || v === 'credit')) return '付款方式不對';
  if (!opt(e.wt, v => typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => Number.isInteger(x) && x >= 1 && x <= 40))) return '份數不對';
  if (!opt(e.lock, v => str(v) && SIGNED.test(v))) return '鎖定金額不對';
  if (!opt(e.pin, str) || !opt(e.cat, str) || !opt(e.notes, str)) return '欄位型別不對';
  return '';
}
