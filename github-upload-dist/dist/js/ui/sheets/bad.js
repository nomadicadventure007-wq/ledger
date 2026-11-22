import { S } from '../../state.js';
import { save } from '../../core/store.js';
import { copyText, html, sheet, toast } from '../util.js';
import { render } from '../render.js';

export function badSheet() {
  const o = sheet(html`<h2>⚠️ 壞掉的資料（${S.bad.length}）</h2><small>這些紀錄格式不對（欄位缺漏或型別錯誤），所以沒有計入結算，也不會顯示在清單裡。原始資料沒有被刪除。</small>${S.bad.slice(-30).map(b => html`<div class="item"><div class="t"><div>${typeof b.e?.desc === 'string' && b.e.desc ? b.e.desc : '（沒有品項）'}</div><small>${b.why} · ${typeof b.e?.date === 'string' ? b.e.date : '日期不明'} · ${b.id}</small></div></div>`)}<button class="pay" id="bc">複製內容（給開發者看）</button><button class="pay" id="bx" style="background:#fee2e2;color:#be123c">清除這份清單</button>`);
  o.querySelector('#bc').onclick = () => copyText(JSON.stringify(S.bad.map(b => ({ why: b.why, entry: b.e })), null, 1));
  o.querySelector('#bx').onclick = () => { S.bad = []; save('bad:' + S.trip.id, S.bad); o.remove(); render(); toast('已清除'); };
}
