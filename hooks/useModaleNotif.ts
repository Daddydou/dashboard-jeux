import { useState } from 'react'
import type { Game } from '@/lib/supabase'
import { EMPTY_NOTIF_FORM, jeuVersNotif, type NotifFormState } from '@/components/NotifModal'
import type { useJeux } from './useJeux'

type Deps = Pick<ReturnType<typeof useJeux>, 'enregistrerNotif' | 'surEchecEcriture'>

/** Feature C — modale de réglage des notifications d'un jeu. */
export function useModaleNotif({ enregistrerNotif, surEchecEcriture }: Deps) {
  const [notifModalGame, setNotifModalGame] = useState<Game | null>(null)
  const [notifForm, setNotifForm] = useState<NotifFormState>(EMPTY_NOTIF_FORM)

  function ouvrir(game: Game) {
    setNotifModalGame(game)
    setNotifForm(jeuVersNotif(game))
  }

  function fermer() {
    setNotifModalGame(null)
  }

  async function enregistrer() {
    if (!notifModalGame) return
    try {
      await enregistrerNotif(notifModalGame.id, notifForm)
    } catch (err) {
      surEchecEcriture(err)
    }
    // Fermée dans tous les cas, succès ou échec.
    setNotifModalGame(null)
  }

  return { jeu: notifModalGame, form: notifForm, setForm: setNotifForm, ouvrir, fermer, enregistrer }
}
