// Service worker de Casa LED: permite abrir la app sin señal.
// Los datos (Firestore) los maneja Firebase con su propia caché; aquí solo se guardan los archivos de la app.
const VERSION = 'casaled-v28';
const APP_SHELL = [
  './',
  'index.html',
  'firebase-config.js',
  'factura-pdf.js',
  'compras-parser.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png',
  'icons/favicon.png'
];
const SDK = [
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP_SHELL);
    await Promise.all(SDK.map((u) => cache.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca interceptar Firestore / Auth: Firebase maneja su propia conexión y caché offline.
  if (url.hostname.endsWith('googleapis.com') || url.pathname.startsWith('/__/')) return;

  const mismoSitio = url.origin === self.location.origin;
  const esSDK = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!mismoSitio && !esSDK && !esFuente) return;

  // La página y la configuración: primero red (para recibir actualizaciones), si no hay señal, la copia guardada.
  const esPagina = req.mode === 'navigate' || (mismoSitio && /\/(index\.html|firebase-config\.js)?$/.test(url.pathname));
  if (esPagina) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req.mode === 'navigate' ? 'index.html' : req, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(VERSION);
        return (await cache.match(req)) || (await cache.match('index.html'));
      }
    })());
    return;
  }

  // Fotos, íconos, SDK y fuentes: primero la copia guardada, y se actualiza en segundo plano.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const red = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || red;
  })());
});
