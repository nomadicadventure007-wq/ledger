import { A, adminReady, slot, unlockSheet } from '../../features/admin.js';
import { S } from '../../state.js';
import { joinInput } from '../sheets/cloud.js';
import { $, app, html, setHtml } from '../util.js';

export function renderWelcome() {
  setHtml($('#nav'), '');
  setHtml(app, html`<div class="welcome"><div class="sky" aria-hidden="true"><span class="cloud c1">☁️</span><span class="cloud c2">☁️</span><span class="cloud c3">☁️</span><span class="fly"><span class="trail"></span><span class="pl">✈️</span></span></div><div class="cover" id="logo" role="img" aria-label="Travel Ledger"><span class="orbit" aria-hidden="true"></span><img class="cover-img" src="img/ledger-cover.webp" alt="" width="512" height="512" decoding="async" draggable="false"><span class="cover-fb" aria-hidden="true">🐬</span></div><h1 style="text-align:center;margin:8px 0 24px">Travel Ledger</h1><input id="wc" aria-label="邀請碼或同步碼" class="pill" placeholder="邀請碼或同步碼" autocomplete="off" autocapitalize="characters" style="text-align:center"><button class="save on" id="wgo" style="margin-top:12px">加入旅程</button>${S.adm ? slot('welcome') : ''}</div>`);
  // 封面圖不在或載入失敗（例如離線第一次開啟）就改顯示放大的 🐬；版面大小不變
  const cover = $('#logo'), img = cover.querySelector('img'), fallback = () => cover.classList.add('fallback');
  img.addEventListener('error', fallback); if (img.complete && !img.naturalWidth) fallback();
  // 連點五下封面才會出現管理者入口（點擊掛在外層，圖片本身不接收點擊）
  $('#logo').onclick = () => { S.hid = (S.hid || 0) + 1; clearTimeout(S.hidT); S.hidT = setTimeout(() => { S.hid = 0; }, 3000); if (S.hid >= 5 && !S.adm) { const open = () => { S.adm = true; renderWelcome(); }; adminReady() ? open() : unlockSheet(open); } }; // 管理者入口：要先用建立金鑰解鎖（解鎖過的手機會記住）
  $('#wgo').onclick = () => joinInput($('#wc').value); $('#wc').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) joinInput($('#wc').value); };
  if (S.adm) A.bindWelcome?.();
}
