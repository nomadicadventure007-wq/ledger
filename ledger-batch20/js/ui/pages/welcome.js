import { doRecover } from '../../features/trips.js';
import { S } from '../../state.js';
import { joinInput } from '../sheets/cloud.js';
import { tripSheet } from '../sheets/members.js';
import { $, app, html, setHtml } from '../util.js';

export function renderWelcome() {
  setHtml($('#nav'), '');
  setHtml(app, html`<div class="welcome"><div class="cover" id="logo" role="img" aria-label="哆啦記帳"><span class="orbit" aria-hidden="true"></span><img class="cover-img" src="img/ledger-cover.webp" alt="" width="512" height="512" decoding="async" draggable="false"><span class="cover-fb" aria-hidden="true">🐬</span></div><h1 style="text-align:center;margin:8px 0 24px">哆啦記帳</h1><input id="wc" aria-label="邀請碼或同步碼" class="pill" placeholder="邀請碼或同步碼" autocomplete="off" autocapitalize="characters" style="text-align:center"><button class="save on" id="wgo" style="margin-top:12px">加入旅程</button>${S.adm ? html`<div class="day">管理者</div><button class="pay" id="wnew">＋ 建立旅程</button><input id="rt" aria-label="旅程編號" class="pill small" placeholder="旅程編號" autocomplete="off"><input id="rk" aria-label="恢復碼" class="pill small" placeholder="恢復碼" autocomplete="off" autocapitalize="characters"><button class="pay" id="rgo2">用恢復碼找回管理員</button>` : ''}</div>`);
  // 封面圖不在或載入失敗（例如離線第一次開啟）就改顯示放大的 🐬；版面大小不變
  const cover = $('#logo'), img = cover.querySelector('img'), fallback = () => cover.classList.add('fallback');
  img.addEventListener('error', fallback); if (img.complete && !img.naturalWidth) fallback();
  // 連點五下封面才會出現管理者入口（點擊掛在外層，圖片本身不接收點擊）
  $('#logo').onclick = () => { S.hid = (S.hid || 0) + 1; clearTimeout(S.hidT); S.hidT = setTimeout(() => { S.hid = 0; }, 3000); if (S.hid >= 5 && !S.adm) { S.adm = true; renderWelcome(); } };
  $('#wgo').onclick = () => joinInput($('#wc').value); $('#wc').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) joinInput($('#wc').value); };
  $('#wnew')?.addEventListener('click', () => tripSheet()); $('#rgo2')?.addEventListener('click', () => doRecover($('#rt').value.trim(), $('#rk').value));
}
