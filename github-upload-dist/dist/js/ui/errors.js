import { S } from '../state.js';
import { app, copyText, html, setHtml, toast } from './util.js';
import { render } from './render.js';

let lastToast = 0;
export function reportError(err, where = '') {
  console.error(where, err);
  const rec = { at: new Date().toISOString(), where, msg: String(err?.message ?? err).slice(0, 300), stack: String(err?.stack ?? '').slice(0, 1500) };
  S.errors = [...(S.errors || []).slice(-9), rec];
  if (Date.now() - lastToast > 4000) { lastToast = Date.now(); toast('⚠️ 剛剛有個小狀況，資料沒有遺失。若一直發生，請到「設定」複製錯誤訊息給我們', undefined, undefined, 6000); }
  return rec;
}
export function installErrorHandlers() {
  addEventListener('error', e => reportError(e.error ?? e.message, 'error'));
  addEventListener('unhandledrejection', e => reportError(e.reason, 'promise'));
}
export function showCrash(err) {
  const rec = reportError(err, 'render'), text = `${rec.msg}\n${rec.stack}`;
  setHtml(app, html`<div class="crash"><h2>這一頁出了點問題 😵</h2><p>你的資料都還在，沒有遺失。可以先回到記帳頁，或重新整理看看。</p><pre>${rec.msg}</pre><button class="save on" id="cr-home">回到記帳頁</button><button class="pay" id="cr-copy">複製錯誤訊息</button><button class="pay" id="cr-reload">重新整理</button></div>`);
  app.querySelector('#cr-home').onclick = () => { S.page = 'log'; render(); };
  app.querySelector('#cr-copy').onclick = () => copyText(text);
  app.querySelector('#cr-reload').onclick = () => location.reload();
}
