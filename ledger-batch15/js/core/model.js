// 資料模型：每筆紀錄都帶 id/裝置/序號/修改時間/墓碑，為日後同步預留。
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const newTrip = () => ({
  id: 't' + uid(), name: '新旅程', adminId: 'm1', closedUntil: null,
  rates: { EUR: 36.41, BAM: 18.48, MKD: 0.59, ALL: 0.38, TWD: 1 },
  members: [{ id: 'm1', name: 'Smile', avatar: '🐬' }, { id: 'm2', name: 'Jiani', avatar: '🌻' }],
  funds: [{ id: 'f1', name: '公款', avatar: '🍔' }],
});
export const CATS = [
  ['food', '🍴', '餐飲', '#F9A8D4'], ['transport', '🚄', '交通', '#8ED1FC'], ['stay', '🏠', '住宿', '#FDE68A'], ['tip', '💰', '小費', '#FDE68A'],
  ['supply', '🛒', '超市', '#DDD6FE'], ['activity', '🎁', '活動', '#FBCFE8'], ['gear', '🧦', '裝備', '#BBF7D0'], ['other', '📦', '雜支', '#E5E7EB'],
];
// 自繪的金色硬幣（不靠 emoji，舊電腦也能顯示）。想換成自己的圖：放進 img/ 並填檔名，例：'cat-food': 'img/cat-food.png'
const COIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='f' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#FFE680'/><stop offset='.55' stop-color='#FFC619'/><stop offset='1' stop-color='#F29D00'/></linearGradient><linearGradient id='e' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#E8A200'/><stop offset='1' stop-color='#B26A00'/></linearGradient></defs><ellipse cx='32' cy='59' rx='19' ry='3' fill='#000' opacity='.14'/><circle cx='32' cy='36' r='25' fill='url(#e)'/><circle cx='32' cy='30' r='25' fill='url(#f)' stroke='#D98E00' stroke-width='2'/><circle cx='32' cy='30' r='19' fill='none' stroke='#FFF3B0' stroke-width='2' stroke-dasharray='2.2 2.2'/><circle cx='32' cy='30' r='15' fill='#FFD43B' stroke='#E8A200' stroke-width='1.5'/><path d='M32 20.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5-4.8-4.6 6.6-.9z' fill='#F29D00'/><path d='M14 22a20 20 0 0 1 12-11' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round' opacity='.7'/></svg>`;
export const IMAGES = { 'cat-tip': 'data:image/svg+xml,' + encodeURIComponent(COIN) };
