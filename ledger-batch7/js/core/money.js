// 金額一律用整數：minor=最小單位(分)，rate=微單位(1e-6)，twdMicro=台幣微單位。全程 BigInt，不用浮點數。
export const DEC = { EUR: 2, BAM: 2, MKD: 2, ALL: 2, USD: 2, TWD: 0, JPY: 0 };
export const dec = c => DEC[c] ?? 2;
export const toMinor = (s, c) => {
  const d = dec(c), [i, f = ''] = String(s).trim().split('.');
  return BigInt(i || 0) * 10n ** BigInt(d) + BigInt((f + '0'.repeat(d)).slice(0, d) || 0);
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
// 最大餘數法：total 依權重分給每人，整數、總和必定等於 total。
export function allocate(total, w) {
  total = BigInt(total); w = w.map(BigInt);
  const S = w.reduce((a, b) => a + b, 0n);
  const out = w.map(x => (total * x) / S);
  let rem = total - out.reduce((a, b) => a + b, 0n);
  const order = w.map((x, i) => [(total * x) % S, i]).sort((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : a[1] - b[1]));
  for (let k = 0; rem > 0n; k++, rem--) out[order[k][1]] += 1n;
  return out;
}
