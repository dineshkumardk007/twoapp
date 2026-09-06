// Service Worker for Two (offline shell & asset caching)
//
// Bumping this name purges every older cache in `activate`. The previous
// version was cache-first for *everything*, index.html included, under a name
// that never changed - so once a device had the shell it kept serving that
// exact build forever. New deploys and new APK builds silently had no effect,
// because the stale index.html kept pointing at the stale bundle sitting
// beside it in the same cache.
const CACHE_NAME = 'two-app-cache-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-maskable.svg'
];

/**
 * Every code-split chunk, read from the build manifest.
 *
 * Screens load on demand, which is what keeps the first paint quick - but a
 * screen you had never opened would then be the one thing that did not work on
 * a train. Pulling the whole set down once at install costs nothing visible,
 * because it happens behind an app that is already usable, and it puts the
 * entire sanctuary back within reach offline.
 */
async function cacheAllChunks(cache) {
  try {
    const response = await fetch('.vite/manifest.json', { cache: 'no-cache' });
    if (!response.ok) return;

    const manifest = await response.json();
    const files = new Set();
    for (const entry of Object.values(manifest)) {
      if (entry.file) files.add(entry.file);
      for (const css of entry.css || []) files.add(css);
    }

    // Individually, so one missing file cannot fail the whole install the way
    // addAll would.
    await Promise.all(
      [...files].map((file) => cache.add(file).catch(() => {}))
    );
  } catch (e) {
    // No manifest means the dev server, or a build without one. The app still
    // works; it just falls back to caching each chunk as it is first opened.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // The shell first, so a slow chunk sweep cannot delay the app being
      // usable offline at all.
      await cache.addAll(STATIC_ASSETS);
      await cacheAllChunks(cache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

function isDevRequest(url) {
  return (
    self.location.port === '3000' ||
    self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1' ||
    url.includes('/@vite/') ||
    url.includes('/@fs/') ||
    url.includes('/src/')
  );
}

/** Build output is content-hashed, so a given filename can never change. */
function isImmutableAsset(url) {
  // Vite emits `name-HASH.ext`, so the hash is preceded by a hyphen, not a dot.
  return url.includes('/assets/') && /[-.][0-9a-zA-Z_-]{8,}\.(js|css)$/.test(url);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (isDevRequest(event.request.url)) return;

  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  // The shell decides which bundle runs, so it must never be pinned. Network
  // first, cache only as an offline fallback.
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Hashed assets are safe to serve from cache indefinitely: a new build emits
  // new filenames rather than replacing these.
  if (isImmutableAsset(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else: serve what we have, but refresh it in the background so a
  // stale copy is never more than one visit old.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            (event.request.url.startsWith(self.location.origin) ||
              event.request.url.includes('fonts.googleapis.com') ||
              event.request.url.includes('fonts.gstatic.com'))
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
