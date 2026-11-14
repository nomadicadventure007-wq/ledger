// 資料模型：每筆紀錄都帶 id/裝置/序號/修改時間/墓碑，為日後同步預留。
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const newTrip = () => ({
  id: 't' + uid(), name: '新旅程', adminId: 'm1', closedUntil: null,
  rates: { EUR: 36.41, BAM: 18.48, MKD: 0.59, ALL: 0.38, TWD: 1 },
  members: [{ id: 'm1', name: 'Smile', avatar: '🐬' }, { id: 'm2', name: 'Jiani', avatar: '🌻' }],
  funds: [{ id: 'f1', name: '公款', avatar: '🍔' }],
});
export const CATS = [
  ['food', '🍴', '餐飲', '#F9A8D4'], ['transport', '🚄', '交通', '#8ED1FC'], ['stay', '🏠', '住宿', '#FDE68A'], ['tip', '🪙', '小費', '#FDE68A'],
  ['supply', '🛒', '超市', '#DDD6FE'], ['activity', '🎁', '活動', '#FBCFE8'], ['gear', '🧦', '裝備', '#BBF7D0'], ['other', '📦', '雜支', '#E5E7EB'],
];
// 想換成自己的圖：放進 img/，在此填檔名。例：{ food: 'img/cat-food.png' }；沒填就用 emoji。
export const IMAGES = {};
