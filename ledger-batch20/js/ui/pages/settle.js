import { settle } from '../../core/settle.js';
import { isPending } from '../../core/sync.js';
import { uid } from '../../core/model.js';
import { persist } from '../../features/sync.js';
import { DENY, S, cats, counted, isAdmin, me, owner, tw } from '../../state.js';
import { catDetails, syncNote } from '../blocks.js';
import { render } from '../render.js';
import { app, copyText, ic, toast, today, who, html, setHtml } from '../util.js';

export function renderSettle() {
  const R = settle(counted(), e => BigInt(tw(e))), ids = Object.keys(R.p), nm = id => html`${who(id).avatar} ${who(id).name}`, f = n => Math.abs(n).toLocaleString();
  const sel = ids.includes(S.sel) ? S.sel : null, cs = {};
  (sel ? [R.p[sel]] : Object.values(R.p)).forEach(q => Object.entries(q.cats).forEach(([c, v]) => cs[c] = (cs[c] || 0) + v));
  const rows = Object.entries(cs).sort((a, b) => b[1] - a[1]), sum = rows.reduce((a, r) => a + Math.max(0, r[1]), 0) || 1;
  setHtml(app, html`${html`<div class="two b"><div><h1>我的</h1><div class="item hero"><div class="t"><small>目前總花費</small><div style="font-size:1.9rem">NT$ ${R.total.toLocaleString()}</div></div><span class="ic">🧾</span></div>
   ${budgetBlock(R)}${S.entries.some(e => isPending(e, S.trip)) ? html`<div class="warn">⏳ 另有 ${S.entries.filter(e => isPending(e, S.trip)).length} 筆等管理員確認，還沒有計入下面的結算</div>` : ''}${syncNote()}<div class="day">誰該付給誰</div>`}${(R.transfers.length ? html`${R.transfers.map((t, i) => html`<div class="item"><div class="t"><div style="white-space:normal">${nm(t.from)} → ${nm(t.to)}</div></div><div class="a">NT$ ${f(t.twd)}</div><button class="pay" style="width:auto;margin:0 6px 0 0" data-cptr="${i}" aria-label="複製">📋</button>${isAdmin() ? html`<button class="pay" style="width:auto;margin:0" data-pay="${t.from}|${t.to}|${t.twd}">已結清</button>` : ''}</div>`)}${html`<button class="pay" data-cptr="all">📋 複製全部轉帳（貼到 LINE）</button>`}` : html`<div class="item"><div class="t" style="text-align:center">${ids.length ? '帳已經平囉 🎉' : '還沒有花費，先去記一筆吧'}</div></div>`)}${html`<div class="day">每個人</div>`}${ids.map(id => { const n = R.p[id].net; return html`<div class="item"><span class="ic">${who(id).avatar}</span><div class="t"><div>${who(id).name}</div></div><div class="a ${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '該收' : n < 0 ? '該付' : '打平'} ${n ? 'NT$ ' + f(n) : ''}</div></div>`; })}${html`</div><div>${trendBlock()}<div class="day">花費分類（約）</div><div class="tabs"><button class="${sel ? '' : 'on'}" data-sel="">全部</button>${ids.map(id => html`<button class="${sel === id ? 'on' : ''}" data-sel="${id}">${who(id).avatar} ${who(id).name}</button>`)}</div>`}${(sel ? html`<div class="item"><div class="t"><small>實際花費</small><div>NT$ ${R.p[sel].cons.toLocaleString()}</div></div><div class="t"><small>代墊出去</small><div>NT$ ${R.p[sel].paid.toLocaleString()}</div></div></div>` : '')}${rows.map(([c, v]) => { const k = cats().find(x => x[0] === c) || cats().at(-1);
    return html`<div class="item mc" data-mc="${c}"><div class="mcr">${ic('cat-' + k[0], k[1])}<div class="t"><div>${k[2]} <small>${Math.round(Math.max(0, v) / sum * 100)}%</small></div><div class="meter"><i style="width:${Math.max(0, v) / sum * 100}%;background:${k[3]}"></i></div></div><div class="a">NT$ ${v.toLocaleString()}</div></div>${S.myCat === c ? catDetails(c, sel) : ''}</div>`; })}${reviewBlock(R)}${html`</div></div>`}`);
}
export function pay(from, to, twd) {
  if (!isAdmin()) return toast(DENY);
  S.trip.close = { until: new Date(Date.now() - 864e5).toLocaleDateString('sv'), at: Date.now() };
  S.dev.seq++; S.dev.sqBy[S.trip.id] = (S.dev.sqBy[S.trip.id] || 0) + 1; S.entries.unshift({ id: 'e' + uid(), tripId: S.trip.id, type: 'settle', from, to, twdMicro: String(BigInt(twd) * 1000000n), date: today(), author: me(), deviceId: S.dev.id, seq: S.dev.seq, sq: S.dev.sqBy[S.trip.id], by: owner(), updatedAt: Date.now(), ts: Date.now(), deleted: false });
  persist(); render(); toast('結清囉 🤝');
}
function budgetBlock(R) {
  const b = S.trip.budget; if (!b?.total) return '';
  const left = b.total - R.total, pct = Math.min(100, Math.max(0, R.total / b.total * 100)), ds = counted().map(e => e.date).sort(), n = ds.length ? Math.round((new Date(today()) - new Date(ds[0])) / 864e5) + 1 : 1;
  return html`<div class="item"><div class="t"><small>預算 NT$ ${b.total.toLocaleString()}</small><div class="${left < 0 ? 'neg' : ''}">${left < 0 ? '超支' : '還剩'} NT$ ${Math.abs(left).toLocaleString()} <small>（已用 ${Math.round(pct)}%）</small></div><div class="meter"><i style="width:${pct}%;background:${left < 0 ? '#fb7185' : '#86efac'}"></i></div>${b.days && n < b.days && left > 0 ? html`<small>第 ${n}/${b.days} 天 · 之後每天約可花 NT$ ${Math.round(left / (b.days - n)).toLocaleString()}</small>` : ''}</div></div>`;
}
function reviewBlock(R) {
  const ex = counted().filter(e => e.type === 'expense'); if (ex.length < 3) return '';
  const d = {}; ex.forEach(e => d[e.date] = (d[e.date] || 0) + Number(BigInt(tw(e)) / 1000000n)); const [bd, bv] = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
  const c = {}; Object.values(R.p).forEach(q => Object.entries(q.cats).forEach(([k, v]) => c[k] = (c[k] || 0) + v)); const k = cats().find(x => x[0] === Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]) || cats().at(-1);
  const pm = Object.entries(R.p).sort((a, b) => b[1].paid - a[1].paid)[0];
  return html`<div class="day">旅程回顧 🎞️</div><div class="item hero"><div class="t"><div>📅 最貴的一天：${bd.slice(5).replace('-', '/')}（NT$ ${bv.toLocaleString()}）</div><div>${ic('cat-' + k[0], k[1])} 最燒錢：${k[2]}</div><div>🏆 墊最多：${who(pm[0]).avatar} ${who(pm[0]).name}（NT$ ${pm[1].paid.toLocaleString()}）</div><div>🧾 共 ${ex.length} 筆、${Object.keys(d).length} 天</div></div></div>`;
}
export function copyTransfers(arg) {
  const T = settle(counted(), e => BigInt(tw(e))).transfers, L = arg === 'all' ? T : [T[+arg]].filter(Boolean); if (!L.length) return;
  copyText(`【${S.trip.name} 結算】\n` + L.map(t => `${who(t.from).name} → ${who(t.to).name}　NT$ ${t.twd.toLocaleString()}`).join('\n'));
}
function trendBlock() {
  const ex = counted().filter(e => e.type === 'expense'); if (!ex.length) return '';
  const d = {}; ex.forEach(e => d[e.date] = (d[e.date] || 0) + Number(BigInt(tw(e)) / 1000000n));
  const ds = Object.keys(d).sort(), first = ds[0], last = ds.at(-1) > today() ? ds.at(-1) : today(), days = [];
  for (const t = new Date(first + 'T12:00:00'); t.toLocaleDateString('sv') <= last && days.length < 60; t.setDate(t.getDate() + 1)) { const k = t.toLocaleDateString('sv'); days.push([k, Math.max(0, d[k] || 0)]); }
  const B = S.trip.budget, tl = B?.total && B?.days ? B.total / B.days : 0, mx = Math.max(1, tl, ...days.map(x => x[1])), W = 320, H = 110, step = (W - 8) / days.length, bw = Math.min(28, step - 4), y = v => H - 14 - v / mx * (H - 22);
  const bars = days.map(([k, v], i) => html`<rect x="${(4 + i * step + (step - bw) / 2).toFixed(1)}" y="${(v === 0 ? H - 16 : y(v)).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, v / mx * (H - 22)).toFixed(1)}" rx="${Math.min(6, bw / 2, Math.max(1, v / mx * (H - 22)) / 2).toFixed(1)}" fill="${v === 0 ? '#E5E7EB' : k === today() ? '#8ED1FC' : '#F9A8D4'}"/>`);
  const dd = x => x.slice(5).replace('-', '/'), avg = Math.round(days.reduce((a, x) => a + x[1], 0) / days.length);
  return html`<div class="day">每日花費趨勢</div><div class="item" style="display:block"><div style="display:flex;justify-content:space-between"><small>今天 NT$ ${Math.round(d[today()] || 0).toLocaleString()}</small><small>平均每天 NT$ ${avg.toLocaleString()}</small></div><svg viewBox="0 0 ${W} ${H}" stroke="none" style="width:100%;height:auto;display:block;margin-top:6px" role="img" aria-label="每日花費趨勢">${bars}${tl ? html`<line x1="0" x2="${W}" y1="${y(tl).toFixed(1)}" y2="${y(tl).toFixed(1)}" stroke="#fb7185" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}<g font-size="9" fill="#9ca3af"><text x="4" y="${H - 2}">${dd(days[0][0])}</text><text x="${W - 4}" y="${H - 2}" text-anchor="end">${dd(days.at(-1)[0])}</text><text x="${W - 4}" y="9" text-anchor="end">最高 ${Math.round(mx).toLocaleString()}</text></g></svg>${tl ? html`<small>虛線＝每天預算</small>` : ''}</div>`;
}
