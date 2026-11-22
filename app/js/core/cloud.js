// 雲端 API 呼叫。網址可用 window.LEDGER_API 覆蓋（測試用）。
export const API = 'https://ledger.nomadic1103.workers.dev';
export async function cloudApi(method, path, body, token, key) {
  let r;
  try { r = await fetch((window.LEDGER_API || API) + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(key ? { 'x-setup-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch { return { error: '連不上伺服器', status: 0, offline: true }; }
  const j = await r.json().catch(() => ({}));
  return r.ok ? j : { ...j, error: j.error || '伺服器錯誤', status: r.status };
}
