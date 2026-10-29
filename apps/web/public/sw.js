/*
 * Service worker PWA : met en cache l'app shell et les icônes pour l'installation,
 * réseau d'abord avec repli sur le cache. Changer CACHE_NAME purge le cache chez
 * tous les utilisateurs (v5 le 2026-10-10 : icônes renommées en *.v2.png).
 * Ne jamais précacher une ressource dont l'URL ne change pas quand son contenu change.
 * L'API (autre origine en prod, ou /api) ne passe JAMAIS par ce SW (2026-10-29 : elle y passait, données manquantes).
 */
const CACHE_NAME = 'spok-v5';

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/icon-192.v2.png',
        '/icon-512.v2.png',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls: never through the service worker. En prod l'API est sur un AUTRE domaine (api.spok.space, chemins
  // /spaces/…) : le seul test '/api' ne l'attrapait pas, toutes les données passaient par fetch() du SW et un échec
  // y renvoyait « Network error » 503 — éléments manquants jusqu'à un rechargement forcé (F5 passe encore par le SW).
  // Corrigé le 2026-10-29 : toute requête d'une autre origine est laissée au navigateur.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  // Static assets and app shell: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response('Network error', { status: 503 })))
  );
});
