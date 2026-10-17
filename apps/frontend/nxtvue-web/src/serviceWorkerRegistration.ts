// ─── Service Worker Registration ─────────────────────────────────────────────

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    if (import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('NXTvue ServiceWorker registered: ', registration.scope)
          })
          .catch((error) => {
            console.warn('NXTvue ServiceWorker registration failed: ', error)
          })
      })
    } else {
      // In development mode, unregister any active service worker to avoid stale asset cache
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
        }
      })
    }
  }
}

export function unregisterServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister()
      })
      .catch((error) => {
        console.error(error.message)
      })
  }
}
