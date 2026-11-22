// ---- 同步 ----
const b64 = u => { let t = ''; for (let i = 0; i < u.length; i += 8192) t += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(t); };
export async function pack(o) {
  const j = new TextEncoder().encode(JSON.stringify(o));
  if (typeof CompressionStream !== 'undefined') return 'LGR1.' + b64(new Uint8Array(await new Response(new Blob([j]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
  return 'LGR0.' + b64(j);
}
export async function unpack(code) {
  code = code.trim().replace(/\s+/g, ''); const h = code.slice(0, 5), u = Uint8Array.from(atob(code.slice(5)), c => c.charCodeAt(0));
  if (h === 'LGR1.') return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  if (h === 'LGR0.') return JSON.parse(new TextDecoder().decode(u)); throw 0;
}
