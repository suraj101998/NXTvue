// ─── NXTvue Service Worker Self-Destruct & Cache Buster ────────────────────────

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)))
    }).then(() => {
      return self.registration.unregister()
    }).then(() => {
      return self.clients.claim()
    })
  )
})

self.addEventListener('fetch', (event) => {
  // Pass through all requests directly to the network
  return
})
