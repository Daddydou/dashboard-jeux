// Service worker : notifications push + mode hors connexion.
//
// Hors connexion : la dernière version vue de chaque page est rejouée
// (réseau d'abord, copie en secours). Les fichiers de l'app (_next/static)
// sont servis depuis la copie : ils ne changent jamais sous le même nom.
// Les écritures (POST) et /api ne passent jamais par le cache.

const CACHE = 'mes-jeux-v3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        copie =>
          copie ||
          fetch(req).then(res => {
            if (res.ok) {
              const double = res.clone()
              caches.open(CACHE).then(c => c.put(req, double))
            }
            return res
          })
      )
    )
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Une redirection (vers /login par exemple) ne remplace pas la page en cache.
          if (res.ok && !res.redirected) {
            const double = res.clone()
            caches.open(CACHE).then(c => c.put(req, double))
          }
          return res
        })
        .catch(() => caches.match(req).then(copie => copie || caches.match('/')))
    )
  }
})

self.addEventListener('push', event => {
  let data = { title: 'Mes jeux', body: '', url: '/' }
  try { data = Object.assign(data, event.data?.json()) } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
