# 程式結構

`main.js` 是入口（`index.html` 只載入它）。其餘模組**一層一層往下依賴**：上層可以用下層，不能反過來，所以沒有循環引用。

```
main.js            啟動、事件分派（click／change）、決定現在畫哪一頁
ui/actions.js      記帳頁各個按鈕（data-a）要做什麼
ui/pages/          一個畫面一個檔：log、ledger、wallet、settle、settings、welcome
ui/sheets/         各種面板（點開來的小視窗）：edit、money、members、cloud、recovery、filesync、backup、import、adv
ui/blocks.js       不只一個畫面會用到的區塊（同步狀態列、分類明細）
ui/nav.js          下方導覽列
features/          沒有畫面的功能：sync（雲端同步）、trips（切換／加入旅程）、csv、pack（同步碼打包）、reminders
ui/util.js         小工具：$、esc、toast、sheet、who、ic、opts…
ui/render.js       「重畫目前這頁」的接縫（見下）
state.js           共用狀態 S，以及「我是誰、能不能操作」這類判斷
core/              純運算，不碰畫面也不碰網路：金額、錢包重播、結算、合併、規則、html 跳脫、紀錄檢查（有單元測試）
```

## 幾個慣例
- **改完資料要更新畫面：呼叫 `render()`**（來自 `ui/render.js`）。它只是個轉接，真正的實作由 `main.js` 啟動時掛進去，這樣各頁面與面板不必反過來依賴 `main.js`。
- **要存檔並排程同步：呼叫 `persist()`**（`features/sync.js`）。
- **新增一個畫面或面板**：放進對應資料夾，在 `ui/actions.js` 或 `main.js` 的事件分派裡接上；不用手動改離線快取清單。
- **發佈前（或改了任何檔案後）執行 `node tools/build-sw.mjs`**：它會追蹤 `main.js` 的 import，自動產生 `sw.js` 的離線快取清單與版本號。`tests/sw.test.mjs` 會檢查它是不是最新的，忘了跑測試會提醒你。

## 寫畫面一律用 html`...`
```js
setHtml(app, html`<div class="item">${e.desc}<small>${who(e.payer).name}</small></div>`);
```
- `${值}` **自動跳脫**（& < > " '），資料裡有什麼字都不會變成標籤或跳出屬性。**不要再呼叫 `esc()`**，會重複跳脫（測試會擋）。
- 要放進去的是另一個 `html`...``，或它們組成的陣列（`items.map(i => html`<li>${i}</li>`)`，不用 `.join('')`），才會原樣保留。
- 傳給 `sheet()`、`setHtml()`、`toast()` 的純字串一律當文字處理；真的要放一段已確認安全的 HTML 字串才用 `raw()`。
- 不要直接指派 `.innerHTML`（`tests/html.test.mjs` 會檢查）。

## 壞資料與錯誤
- 紀錄讀進來時會用 `core/validate.js` 檢查；格式壞掉（缺欄位、型別錯）的不會被刪，而是移到「隔離區」（`S.bad`，存在手機的 `bad:旅程編號`），不計入結算、也不會讓畫面崩潰。設定頁會提醒，可以查看與複製。
- 某一頁畫不出來時，`main.js` 的 `renderNow` 會改顯示說明卡（`ui/errors.js`），不會整頁空白。

## 封面圖、圖示、字型
- **封面圖**：`img/ledger-cover.webp`（目前是 512×512、約 40 KB）。要更換時，把新圖放成同樣的檔名（建議正方形、主角在正中央、約 512×512、100 KB 以內）。沒有這個檔案（或載入失敗，例如離線第一次開啟）時，會自動顯示放大的 🐬，版面大小不變。圖會被裁成圓形；主角不在正中間的話，在 `css/app.css` 的 `.cover` 加上 `--cover-pos: 50% 30%;`（水平 垂直）調整位置。換圖之後請執行一次 `node tools/build-sw.mjs`，離線時才看得到新圖。
- **App 圖示**：`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`（主角要在中央約 60% 的範圍內，系統會裁掉邊緣）、`apple-touch-icon.png`（180×180）。目前是預設的粉彩底 🐬，換成自己的圖時覆蓋這四個檔案、再跑一次 `node tools/build-sw.mjs`。
- **字型**：`fonts/iansui-sub.woff2`，說明與授權見 `fonts/README.md`。
- 顏色：淺色模式 `#F8FAFC`、深色模式 `#0f172a`（`index.html` 的 `theme-color`，與 `manifest.json` 一致）。

## 測試
- `npm test`：單元測試（金額、錢包、結算、合併、規則、html 跳脫、紀錄檢查、離線快取清單）。不需要瀏覽器，幾秒鐘。
- `npm run e2e`：端對端測試（真瀏覽器 + 真後端），`tests/e2e/`：
  - `flow`：管理員與成員各一支手機的完整流程（付款人限制、換匯打錯 → 待確認 → 同意、容許範圍、現金鎖定、把每個畫面的每種按鈕都點一遍）
  - `harden`：壞紀錄隔離、畫面崩潰與啟動失敗的說明卡、漏接錯誤只提醒一次
  - `sync`：離線記帳、被伺服器拒絕、兩支手機同時改同一筆、同步進行中又編輯、憑證撤銷、一千多筆資料分頁
  - `ui`：封面（有圖／沒圖／裁切／動畫）、圖示與 manifest、字型、無障礙
  - 第一次要先 `npm install` 與 `npx playwright install chromium`；專案裡要有 `worker/` 資料夾（測試會用它在本機啟動一個後端）。只跑其中幾個：`node tests/e2e/run.mjs sync ui`。
- `npm run test:all`：兩種都跑。

## 指令
```
npm run sw        更新離線快取清單與版本號（= node tools/build-sw.mjs）
npm test          跑單元測試
npm run e2e       跑端對端測試
npm run format    （選用）用 Prettier 統一排版；原本有些行很長，格式化後會變成多行
```
