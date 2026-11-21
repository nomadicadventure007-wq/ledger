import { S } from '../../state.js';
import { copyBtn, sheet, html } from '../util.js';

export function recoverySheet(code) {
  const o = sheet(html`<h2>🔑 管理員恢復碼</h2><div style="font-size:1.4rem;text-align:center;word-break:break-all;padding:8px" id="rcode">${code}</div><div class="item"><div class="t"><small>旅程編號</small><div id="rtid" style="word-break:break-all">${S.trip.id}</div></div></div><button class="pay" id="rc1">複製恢復碼</button><button class="save on" id="rc2">我已經存好了</button>`);
  copyBtn(o, '#rc1', code); o.querySelector('#rc2').onclick = () => o.remove();
}
