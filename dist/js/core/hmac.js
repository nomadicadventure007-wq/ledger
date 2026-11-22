const enc = new TextEncoder(), hex = u => Array.from(new Uint8Array(u), b => b.toString(16).padStart(2, '0')).join('');
export const sha256Hex = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export async function hmacHex(keyStr, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
export const signWith = async (token, msg) => hmacHex(await sha256Hex(token), msg);
