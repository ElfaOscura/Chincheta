/* Service worker: guarda la app en el navegador para que abra sin internet.
   Estrategia: responde al instante desde la copia guardada y, en segundo plano,
   la actualiza. Si cambias los archivos, los verás en la siguiente apertura.
   Si algún día algo no se actualiza, sube el número de CACHE (v1 -> v2). */
const CACHE = 'chincheta-v13';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './alerts.js',
  './draw.js',
  './lucide.js',
  './links.js',
  './search.js',
  './tools.js',
  './dock.js',
  './notes.js',
  './i18n.js',
  './i18n/es.js',
  './i18n/en.js',
  './i18n/zh.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // imágenes de enlaces: que las cargue el navegador

  const network = fetch(req)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    })
    .catch(() => null);

  event.waitUntil(network);
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || network.then((res) => res || caches.match('./index.html'))
    )
  );
});

/* Al tocar una notificación de alerta (o uno de sus botones) se abre Chincheta y se avisa a la página */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const id = event.notification.data?.id;
  const action = event.action || 'open';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    let client = all[0];
    if (client) await client.focus?.();
    else client = await self.clients.openWindow('./index.html');
    client?.postMessage({ type: 'alert-action', action, id });
  })());
});