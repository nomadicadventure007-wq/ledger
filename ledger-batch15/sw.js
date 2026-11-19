const V = 'ledger-v21', FILES = ['./', './index.html', './manifest.json', './css/app.css', './js/app.js', './js/core/money.js', './js/core/store.js', './js/core/model.js', './js/core/wallet.js', './js/core/settle.js', './js/core/sync.js', './js/core/cloud.js', './fonts/iansui-sub.woff', './icon-192.png', './icon-512.png', './help/user.html', './help/admin.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.allSettled(FILES.map(f => c.add(f))))); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => { if (n.ok) { const c = n.clone(); caches.open(V).then(x => x.put(e.request, c)); } return n; })
    .catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)));
});
