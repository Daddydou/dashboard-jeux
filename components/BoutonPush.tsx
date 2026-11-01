'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

function cleVapid(base64: string): ArrayBuffer {
  const remplissage = '='.repeat((4 - (base64.length % 4)) % 4)
  const brut = window.atob((base64 + remplissage).replace(/-/g, '+').replace(/_/g, '/'))
  const buffer = new ArrayBuffer(brut.length)
  const octets = new Uint8Array(buffer)
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)
  return buffer
}

/** Le navigateur sait-il recevoir des notifications ? Ne change pas en cours de route. */
function pushDisponible(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}
const sansAbonnement = () => () => {}

/**
 * Abonnement de CET appareil aux rappels. Au pré-rendu serveur, la réponse
 * est « indisponible » : le vrai état n'apparaît qu'une fois hydraté.
 */
export default function BoutonPush() {
  const disponible = useSyncExternalStore(sansAbonnement, pushDisponible, () => false)
  const [abonne, setAbonne] = useState(false)
  const [refuse, setRefuse] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!pushDisponible()) return
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setAbonne(!!sub))
      .catch(() => {})
  }, [])

  async function activer() {
    const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!cle) {
      setErreur('Clé VAPID publique non configurée.')
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setRefuse(true)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid(cle) })
      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, keys }),
      })
      if (res.ok) setAbonne(true)
      else setErreur('Le serveur a refusé l’abonnement (session expirée ?).')
    } catch (err) {
      console.error('Abonnement push :', err)
      setErreur('Abonnement impossible sur cet appareil.')
    } finally {
      setEnCours(false)
    }
  }

  const etat = !disponible
    ? 'Ce navigateur ne reçoit pas de notifications. Installe l’app sur l’écran d’accueil, puis rouvre-la.'
    : abonne
      ? 'Activées : ce téléphone recevra tes rappels.'
      : refuse
        ? 'Bloquées par le navigateur. Autorise-les dans les réglages du site, puis réessaie.'
        : 'Désactivées sur cet appareil.'

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-tableau p-4">
      <div className="min-w-0">
        <p className="font-semibold">Notifications sur cet appareil</p>
        <p className="mt-0.5 text-sm text-brume">{etat}</p>
        {erreur && (
          <p role="alert" className="mt-1 text-sm text-carton">
            {erreur}
          </p>
        )}
      </div>
      {disponible && !abonne && (
        <button
          type="button"
          onClick={activer}
          disabled={enCours}
          className="h-11 shrink-0 rounded-xl bg-balle px-4 text-sm font-semibold text-nuit disabled:opacity-50"
        >
          {enCours ? 'Activation…' : 'Activer'}
        </button>
      )}
    </div>
  )
}
