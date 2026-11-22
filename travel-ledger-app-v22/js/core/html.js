// ---- 預設自動跳脫的 HTML 模板 ----
// 用 html`...` 寫畫面：塞進去的 ${值} 一律當「文字」跳脫（& < > " ' 都會處理），所以資料裡有什麼奇怪的字都不會變成標籤。
// 只有兩種東西會原樣放進去：另一個 html`...` 的結果、以及它們組成的陣列（所以不用再 .join('')）。
// 真的要放一段已確認安全的 HTML 字串，才用 raw()。
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = t => String(t).replace(/[&<>"']/g, c => ESC[c]); // 純文字用（例如 toast）；html`` 裡不用再呼叫它
export const raw = s => new Safe(String(s));
const piece = v => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(piece).join('') : esc(v));
export const html = (strs, ...vals) => new Safe(strs.reduce((o, s, i) => o + s + (i < vals.length ? piece(vals[i]) : ''), ''));
export const setHtml = (el, v) => { el.innerHTML = piece(v); return el; }; // 所有「寫進畫面」的出口都走這裡；傳純字串會被當文字跳脫
