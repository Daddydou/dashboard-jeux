'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return buffer
}

/**
 * Feature C — bouton d'abonnement aux notifications push.
 * Enregistre aussi le service worker (PWA) au montage.
 */
/** Le navigateur sait-il recevoir des push ? Ne change pas en cours de route. */
function pushDisponible(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}
const sansAbonnement = () => () => {}

export default function PushButton() {
  // Lu pendant le rendu plutôt que recopié dans un state depuis un effet.
  // Côté serveur (pré-rendu), `false` : le bouton n'apparaît qu'une fois
  // hydraté dans le navigateur, sans écart d'hydratation.
  const pushSupported = useSyncExternalStore(sansAbonnement, pushDisponible, () => false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Service worker registration + push status check
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(console.error)
    if ('PushManager' in window) {
      navigator.serviceWorker.ready
        .then(reg => reg.pushManager.getSubscription())
        .then(sub => setPushSubscribed(!!sub))
        .catch(() => {})
    }
  }, [])

  async function handleSubscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) { alert('VAPID public key non configurée'); return }
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const subJson = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      })
      if (res.ok) setPushSubscribed(true)
    } catch (err) {
      console.error('Push subscribe error:', err)
    } finally {
      setPushLoading(false)
    }
  }

  if (!pushSupported) return null

  return (
    <button
      onClick={handleSubscribePush}
      disabled={pushSubscribed || pushLoading}
      title={pushSubscribed ? 'Notifications activées' : 'Activer les notifications push'}
      className={[
        'px-3 py-2 rounded-2xl text-sm font-medium transition-colors',
        pushSubscribed
          ? 'bg-slate-800 text-amber-400 cursor-default'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-300',
      ].join(' ')}
    >
      {pushLoading ? '…' : pushSubscribed ? '🔔 Activé' : '🔔 Notifs'}
    </button>
  )
}
