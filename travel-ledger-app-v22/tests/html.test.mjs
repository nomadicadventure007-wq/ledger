// 自動跳脫的 html 模板：資料裡有什麼奇怪的字，都不能變成標籤或跳出屬性。
import assert from 'node:assert/strict'; import { readFileSync, readdirSync, statSync } from 'node:fs'; import path from 'node:path';
import { html, raw, esc, setHtml } from '../js/core/html.js';
const S = x => String(x);
// 基本跳脫（& < > " ' 五個字）
assert.equal(S(html`<b>${`<i>&"'`}</b>`), '<b>&lt;i&gt;&amp;&quot;&#39;</b>'); assert.equal(esc(`a&b<c>"d"'e'`), 'a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;');
// 模板之間可以巢狀、陣列不用 join，而且不會重複跳脫
assert.equal(S(html`<ul>${[1, 2].map(n => html`<li>${n}</li>`)}</ul>`), '<ul><li>1</li><li>2</li></ul>');
assert.equal(S(html`<p>${html`a &amp; b`}</p>`), '<p>a &amp; b</p>', '已經是 html 的不再跳脫第二次');
assert.equal(S(html`${['<b>', html`<i>`]}`), '&lt;b&gt;<i>', '陣列裡的純字串要跳脫，html 不跳脫');
assert.equal(S(html`${raw('<hr>')}`), '<hr>', 'raw 才會原樣放入');
// 純字串即使長得像標籤也是文字
assert.equal(S(html`<div>${'<div class="x">'}</div>`), '<div>&lt;div class=&quot;x&quot;&gt;</div>');
// 和一般模板一致的小細節
assert.equal(S(html`${null}|${undefined}|${0}|${false}|${12.5}`), 'null|undefined|0|false|12.5'); assert.equal(html`x` + '', 'x'); assert.equal(`${html`<b>`}`, '<b>');
// 常見攻擊字串：塞在標籤內容與屬性值裡，都不能多出任何標籤、也不能跳出引號
const PAYLOADS = ['"><img src=x onerror=alert(1)>', "' onmouseover='alert(1)", '<script>alert(1)</script>', '</div><div onclick=x>', '" autofocus onfocus="alert(1)', '<svg/onload=alert(1)>', 'javascript:alert(1)', '&lt;already&gt;', '\u0000<b>'];
for (const p of PAYLOADS) {
  const inner = S(html`<div>${p}</div>`), attr = S(html`<input value="${p}" data-x='${p}'>`);
  assert.equal((inner.match(/</g) || []).length, 2, '內容裡不能多出標籤：' + p); assert.equal((attr.match(/</g) || []).length, 1, '屬性裡不能多出標籤：' + p);
  assert.equal((attr.match(/"/g) || []).length, 2, '屬性值不能跳出雙引號：' + p); assert.equal((attr.match(/'/g) || []).length, 2, '屬性值不能跳出單引號：' + p);
}
// 出口：傳 html 就原樣；傳純字串會被當文字
const el = {}; setHtml(el, html`<b>${'<x>'}</b>`); assert.equal(el.innerHTML, '<b>&lt;x&gt;</b>'); setHtml(el, '<b>純字串</b>'); assert.equal(el.innerHTML, '&lt;b&gt;純字串&lt;/b&gt;');
// ---- 守門：程式碼裡不准繞過這套機制 ----
const base = path.resolve(new URL('../js', import.meta.url).pathname), walk = d => readdirSync(d).flatMap(n => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const files = walk(base).filter(p => !p.includes(path.sep + 'core' + path.sep)); let n = 0;
for (const p of files) { const src = readFileSync(p, 'utf8'), rel = path.relative(base, p);
  assert.ok(!/\.(inner|outer)HTML\s*=[^=]/.test(src), rel + '：請用 setHtml(元素, html`...`)，不要直接指派 innerHTML／outerHTML'); assert.ok(!/insertAdjacentHTML/.test(src), rel + '：不要用 insertAdjacentHTML');
  assert.ok(!/(^|[^\w.])esc\(/.test(src.replace(/^import[^\n]*\n/gm, '')), rel + '：html`` 會自動跳脫，不用再呼叫 esc()（會重複跳脫）'); n++; }
console.log('✓ html 測試通過（%d 種攻擊字串、%d 個程式檔檢查）', PAYLOADS.length, n);
