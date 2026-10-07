const V = 'wg-v42';
const SHELL = V + '-shell', LIBS = 'wg-libs-v1', FONTS = 'wg-fonts-v1';
const KEEP = [SHELL, LIBS, FONTS];
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const LIB_URLS = [
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/docx-preview/0.3.2/docx-preview.min.js',
  'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'tessdata.projectnaptha.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await Promise.allSettled(SHELL_FILES.map(f => shell.add(new Request(f, { cache: 'reload' }))));
    if (!(await shell.match('index.html'))) throw new Error('index.html could not be cached');
    const libs = await caches.open(LIBS);
    await Promise.allSettled(LIB_URLS.map(async u => {
      if (await libs.match(u)) return;
      const r = await fetch(u);
      if (r.ok) await libs.put(u, r);
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

async function swr(e, cacheName, key) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(key || e.request);
  const net = fetch(e.request).then(r => {
    if (r.ok) cache.put(key || e.request, r.clone());
    return r;
  }).catch(() => null);
  e.waitUntil(net);
  return cached || (await net) || Response.error();
}

async function cacheFirst(e, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(e.request);
  if (cached) return cached;
  try {
    const r = await fetch(e.request.url);
    if (r.ok) cache.put(e.request, r.clone());
    return r;
  } catch (err) {
    return fetch(e.request);
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(swr(e, SHELL, 'index.html'));
  } else if (url.origin === location.origin) {
    e.respondWith(swr(e, SHELL));
  } else if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(e, LIBS));
  } else if (url.hostname === 'fonts.googleapis.com') {
    e.respondWith(swr(e, FONTS));
  } else if (url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(e, FONTS));
  }
});
