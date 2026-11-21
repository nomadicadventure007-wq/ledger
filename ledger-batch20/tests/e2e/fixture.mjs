// 測試資料：刻意在每個文字欄位塞滿 & < > " ' 與看起來像攻擊的內容，涵蓋各種紀錄類型與狀態。
export const T = 'tFIX', NOW = Date.UTC(2026, 1, 3, 2, 0, 0);
const base = (o) => ({ tripId: T, deviceId: 'dFIX', seq: 1, sq: 1, by: 'm1', updatedAt: NOW - 5000, ts: NOW - 5000, sts: NOW - 5000, deleted: false, ...o });
const X = (id, o) => base({ id, type: 'expense', desc: '午餐', minor: 1000, cur: 'EUR', rate: '36410000', twdMicro: '364100000', payer: 'm1', shares: ['m1', 'm2'], wt: {}, method: 'credit', cat: 'food', notes: '', date: '2026-02-01', author: 'm1', lock: null, ...o });
export const trip = { id: T, name: `Trip <&> "Q" 'a'`, adminId: 'm1', closedUntil: null, rates: { EUR: 36.41, BAM: 18.48, MKD: 0.59, ALL: 0.38, TWD: 1 },
  members: [{ id: 'm1', name: 'Smile & <b>Co</b>', avatar: '🐬' }, { id: 'm2', name: 'Jiani "J"', avatar: '🌻' }, { id: 'm3', name: "O'Neil <x>", avatar: '🦊', img: 'img/o.png' }],
  funds: [{ id: 'f1', name: '公款 <fund> & co', avatar: '🍔' }],
  cats: [['food', '🍴', '餐飲', '#F9A8D4'], ['stay', '🏠', '住宿', '#FDE68A'], ['tip', '💰', '小費', '#FDE68A'], ['c1', '📦', '雜<支>&"', '#E5E7EB'], ['other', '📦', '雜支', '#E5E7EB']],
  budget: { total: 60000, days: 14 }, close: { until: '2026-02-01', at: 1000 } };
export const entries = [
  base({ id: 'x1', type: 'exchange', owner: 'm1', cur: 'EUR', minor: 50000, rate: '36000000', twdMicro: '18000000000', date: '2026-01-30', author: 'm1' }),
  base({ id: 'x2', type: 'exchange', owner: 'm2', cur: 'BAM', minor: 20000, rate: '18500000', twdMicro: '3700000000', date: '2026-01-30', author: 'm2', by: 'm2' }),
  base({ id: 'x3', type: 'exchange', owner: 'm2', cur: 'EUR', minor: 10000, rate: '60000000', twdMicro: '6000000000', date: '2026-01-31', author: 'm2', by: 'm2', review: 'rate', approved: false }),
  X('e1', { desc: '拉麵 <img src=x onerror=window.__xss=1> & "q" \'s\'', minor: 2500, method: 'cash', pin: 'x1', shares: ['m1', 'm2', 'm3'], wt: { m1: 2, m2: 4, m3: 2 }, notes: '備註 <b>粗</b> "引" \'a\' &amp; &lt;', date: '2026-02-01' }),
  X('e2', { desc: 'Hotel</b><u>', cur: 'BAM', rate: '18480000', twdMicro: '1848000000', minor: 10000, payer: 'm2', author: 'm2', by: 'm2', cat: 'stay', date: '2026-01-31' }),
  X('e3', { desc: '退款', minor: -500, method: 'cash', pin: 'x1', date: '2026-02-02' }),
  X('e4', { desc: '小費 & 謝謝', payer: 'f1', shares: ['m1', 'm2', 'm3'], cat: 'tip', minor: 300, twdMicro: '109230000', date: '2026-02-02' }),
  X('e5', { desc: '標記的 lock', author: 'm2', by: 'm2', payer: 'm2', twdMicro: '437000000', review: 'lock', approved: false, date: '2026-02-02' }),
  X('e6', { id: 'e6" onmouseover="window.__xss=2', desc: '引號 id', date: '2026-02-02' }),
  X('e7', { desc: '已刪除', deleted: true }),
  X('e8', { desc: '自訂分類', cat: 'c1', approved: true, minor: 1234, twdMicro: '449300000', date: '2026-02-02', notes: "x'y" }),
  X('e9', { desc: '怪幣別', cur: '<i>', twdMicro: '100000000', rate: '1000000', minor: 100, date: '2026-02-02' }),
  X('e10', { desc: '不明付款人', payer: 'zz', shares: ['m1'], date: '2026-02-02' }),
  X('e11', { desc: '結清後補記', author: 'm2', by: 'm2', payer: 'm2', date: '2026-01-31', ts: NOW, sts: NOW, updatedAt: NOW }),
  X('e12', { desc: '現金日圓<br>', cur: 'BAM', rate: '18480000', twdMicro: '184800000', minor: 1000, method: 'cash', pin: 'x2', payer: 'm2', author: 'm2', by: 'm2', date: '2026-02-02', lock: '184800000' }),
  X('e13', { desc: '會執行的幣別', cur: '<img src=x onerror=window.__xss=3>', twdMicro: '100000000', rate: '1000000', minor: 100, date: '2026-02-02' }),
  base({ id: 's1', type: 'settle', from: 'm2', to: 'm1', twdMicro: '500000000', date: '2026-02-02', author: 'm1' }),
];
export const dev = (me) => ({ id: 'dFIX', seq: 30, sqBy: { [T]: 30 }, meBy: { [T]: me }, ownerBy: { [T]: me }, cloud: {}, syncs: {}, lastBackup: NOW - 1000 });

// 無害版：把所有字串裡的 & < > " ' 換成底線（其餘一模一樣）。用來證明「重構本身」沒有改變任何畫面。
const clean = v => typeof v === 'string' ? v.replace(/[&<>"']/g, '_') : Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [clean(k), clean(x)])) : v;
export const benign = o => clean(o);
