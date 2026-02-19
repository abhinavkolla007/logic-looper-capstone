const APP_SHELL_CACHE = 'logic-looper-shell-v2'
const RUNTIME_CACHE = 'logic-looper-runtime-v2'
const APP_SHELL_URLS = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isSameOriginGet(request) {
  const url = new URL(request.url)
  return request.method === 'GET' && url.origin === self.location.origin
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (!isSameOriginGet(request)) return

  // Navigation: network-first with app-shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const runtimeMatch = await caches.match(request)
          if (runtimeMatch) return runtimeMatch
          const shellMatch = await caches.match('/index.html')
          return (
            shellMatch ||
            new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          )
        })
    )
    return
  }

  // Static assets/api same-origin GET: cache-first, then network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const copy = response.clone()
        void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
        return response
      })
    })
  )
})

self.addEventListener('sync', (event) => {
  if (event.tag !== 'flush-sync') return

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'FLUSH_SYNC' })
      }
    })
  )
})
