// Ball Battle VS: офлайн-кэш. При обновлении игры поменяйте номер версии ниже.
const VERSION = 'ball-battle-v1';
const FILES = ['./', 'index.html', 'style.css', 'game.js', 'manifest.webmanifest', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', function (e) {
    e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
// сначала сеть (чтобы приходили обновления), если её нет — кэш
self.addEventListener('fetch', function (e) {
    if (e.request.method !== 'GET') return;
    e.respondWith(fetch(e.request).then(function (r) {
        const copy = r.clone();
        caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
        return r;
    }).catch(function () { return caches.match(e.request); }));
});
