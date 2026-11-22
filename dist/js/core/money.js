export const DEC = { EUR: 2, BAM: 2, MKD: 2, ALL: 2, USD: 2, TWD: 0, JPY: 0 };
export const dec = c => DEC[c] ?? 2;
const AMT = /^\s*(\d*)\.?(\d*)(?:[eE]([+-]?\d{1,2}))?\s*$/;
export const isAmt = s => { const m = AMT.exec(String(s ?? '')); return !!m && (m[1] !== '' || m[2] !== '') && (m[1] + m[2]).length <= 30; };
export const toMinor = (s, c) => {
  if (!isAmt(s)) throw new RangeError('金額格式不對');
  const [, i, f, e] = AMT.exec(String(s)), digits = BigInt(i + f), k = i.length + Number(e || 0) - (i + f).length + dec(c);
  if (k >= 0) return digits * 10n ** BigInt(k);
  const p = 10n ** BigInt(-k), q = digits / p;
  return (digits % p) * 2n >= p ? q + 1n : q;
};
export const toMicro = r => BigInt(Math.round(Number(r) * 1e6));
export const twdMicro = (minor, c, rateMicro) => {
  const p = 10n ** BigInt(dec(c));
  return (BigInt(minor) * BigInt(rateMicro) + p / 2n) / p;
};
export const showTwd = m => Number((BigInt(m) + 500000n) / 1000000n).toLocaleString();
export const showAmt = (minor, c) => {
  const d = dec(c), n = Number(minor) / 10 ** d;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: d });
};
export function allocate(total, w) {
  total = BigInt(total); w = w.map(BigInt);
  const S = w.reduce((a, b) => a + b, 0n);
  const out = w.map(x => (total * x) / S);
  let rem = total - out.reduce((a, b) => a + b, 0n);
  const order = w.map((x, i) => [(total * x) % S, i]).sort((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : a[1] - b[1]));
  for (let k = 0; rem > 0n; k++, rem--) out[order[k][1]] += 1n;
  return out;
}
