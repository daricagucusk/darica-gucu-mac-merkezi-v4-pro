/* Darıca Gücü Maç Merkezi — service worker
 * Sürüm değişince CACHE_VERSION artırılır; eski önbellekler activate sırasında silinir.
 * Strateji:
 *  - Gezinme: ağ öncelikli, çevrimdışıysa önbellekteki uygulama kabuğu ("/").
 *  - /assets/* (içerik özetli dosyalar): önbellek öncelikli, değişmez.
 *  - /api/live ve /api/source-status: ağ öncelikli, çevrimdışıysa SON DOĞRULANMIŞ kopya.
 *  - Diğer tüm /api/* (onay, AI, bildirim, indirme, oyuncu, oyuncu fotoğrafı, hava): asla önbelleğe alınmaz.
 * Yeni sürüm kendiliğinden devreye girmez; kullanıcı "Yenile" deyince SKIP_WAITING gelir.
 */
const CACHE_VERSION = 'v6-1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const DATA_PATHS = ['/api/live', '/api/source-status'];
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

function cachePolicy(url, request) {
  if (request.method !== 'GET') return 'network-only';
  if (url.origin !== self.location.origin) return 'network-only';
  if (request.mode === 'navigate') return 'shell';
  if (DATA_PATHS.includes(url.pathname)) return 'data';
  if (url.pathname.startsWith('/api/')) return 'network-only';
  if (url.pathname.startsWith('/assets/')) return 'asset';
  if (SHELL_URLS.includes(url.pathname)) return 'asset';
  return 'network-only';
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE, DATA_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(fallbackKey || request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey || request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const policy = cachePolicy(url, event.request);
  if (policy === 'network-only') return;
  if (policy === 'shell') {
    event.respondWith(networkFirst(event.request, SHELL_CACHE, '/').catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Çevrimdışı</title><body style="font-family:system-ui;background:#101820;color:#f1f5f7;padding:32px"><h1>Çevrimdışısın</h1><p>Bağlantı gelince uygulama yeniden açılır.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )));
    return;
  }
  if (policy === 'data') { event.respondWith(networkFirst(event.request, DATA_CACHE)); return; }
  event.respondWith(cacheFirst(event.request, ASSET_CACHE));
});

if (typeof globalThis.__SW_TEST__ !== 'undefined') globalThis.__SW_TEST__.cachePolicy = cachePolicy;

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Darıca Gücü', body: event.data ? event.data.text() : 'Yeni bir kulüp bildirimi var.' };
  }

  const title = typeof payload.title === 'string' ? payload.title.slice(0, 100) : 'Darıca Gücü';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'Kulüp merkezinde yeni bir bildirim var.';
  const href = typeof payload.href === 'string' ? payload.href : 'dashboard';
  const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId : '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: notificationId || undefined,
      renotify: false,
      data: { href, notificationId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = typeof event.notification.data?.href === 'string'
    ? event.notification.data.href.replace(/^#?\/?/, '')
    : 'dashboard';
  const target = new URL('/?screen=' + encodeURIComponent(href), self.location.origin).toString();

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        const focused = await client.focus();
        if ('navigate' in focused) await focused.navigate(target);
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
