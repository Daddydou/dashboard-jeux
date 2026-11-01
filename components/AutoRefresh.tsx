'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Remet l'accueil à jour sans le recharger : toutes les `secondes` tant
 * qu'il est visible, et dès qu'on revient dessus (retour dans l'app
 * installée, téléphone déverrouillé). Les « dans 1 h 12 » restent justes.
 */
export default function AutoRefresh({ secondes = 60 }: { secondes?: number }) {
  const router = useRouter()

  useEffect(() => {
    const rafraichir = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const minuteur = setInterval(rafraichir, secondes * 1000)
    document.addEventListener('visibilitychange', rafraichir)
    return () => {
      clearInterval(minuteur)
      document.removeEventListener('visibilitychange', rafraichir)
    }
  }, [router, secondes])

  return null
}
