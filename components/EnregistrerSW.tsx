'use client'

import { useEffect } from 'react'

/** Enregistre le service worker (notifications push, mode hors connexion). */
export default function EnregistrerSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker :', err))
    }
  }, [])
  return null
}
