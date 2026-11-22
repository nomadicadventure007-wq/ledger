# 字型

`iansui-sub.woff2` 是 **芫荽 Iansui**（https://github.com/ButTaiwan/iansui ，版本 1.012）的子集：保留 5,655 個字元（常用字、標點、全形英數，以及 App 畫面用到的字），轉成 woff2（約 1.5 MB）。

- 授權：SIL Open Font License 1.1。授權聲明已經留在字型檔本身的資訊裡（name 表），散布時建議也附上上游專案的 `OFL.txt`。
- 沒有收錄的字（例如旅伴輸入的冷僻字）會自動改用系統字型顯示，不會缺字。
- 想增加收錄的字，需要完整字型 `Iansui-Regular.woff2`（上游專案的 releases 可下載）；用 fontTools 的 `pyftsubset` 重新產生子集即可。
