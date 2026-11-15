// 儲存層：優先 IndexedDB，失敗自動退回 localStorage。
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open('ledger', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const req = (mode, fn) => open().then(db => new Promise((res, rej) => {
  const q = fn(db.transaction('kv', mode).objectStore('kv')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
}));
export async function load(k, def) {
  try { return (await req('readonly', s => s.get(k))) ?? def; }
  catch { const v = localStorage.getItem('l_' + k); return v ? JSON.parse(v) : def; }
}
export async function save(k, v) {
  try { await req('readwrite', s => s.put(v, k)); }
  catch { localStorage.setItem('l_' + k, JSON.stringify(v)); }
  try { navigator.storage?.persist?.(); } catch {}
}
