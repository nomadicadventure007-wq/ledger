// 「重畫目前這一頁」的接縫。
// 各頁面與面板在改完資料後都會呼叫 render()，但真正決定畫哪一頁的程式（main.js）又依賴所有頁面；
// 為了不讓模組互相繞圈引用，render() 在這裡只是個轉接，main.js 啟動時把真正的實作掛進 hooks。
export const hooks = {};
export const render = (...args) => hooks.render(...args);
