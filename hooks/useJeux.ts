import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/supabase'
import { jourDeCycle, maintenant } from '@/lib/time'
import { categorieDe } from '@/lib/categories'
import { statsUsage, type Ouverture } from '@/lib/stats'
import {
  basculerFait as basculerFaitServeur,
  creerJeu,
  enregistrerNotif as enregistrerNotifServeur,
  marquerOuvert as marquerOuvertServeur,
  modifierJeu,
  reordonner,
  supprimerJeu,
} from '@/app/actions'
import type { FormState } from '@/components/GameForm'
import type { NotifFormState } from '@/components/NotifModal'

type Lecture = {
  games: Game[] | null
  doneMap: Record<string, string | null> | null
  ouvertures: Ouverture[] | null
}

/** Supabase renvoie au plus 1 000 lignes par requête : on lit page par page. */
const TAILLE_PAGE = 1000

async function lireOuvertures(): Promise<Ouverture[] | null> {
  const toutes: Ouverture[] = []
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await supabase
      .from('dashboard_ouvertures')
      .select('game_id, opened_at')
      .order('id', { ascending: true })
      .range(debut, debut + TAILLE_PAGE - 1)
    if (error || !data) return null
    toutes.push(...(data as Ouverture[]))
    if (data.length < TAILLE_PAGE) return toutes
  }
}

/** Lit les jeux actifs et les coches. `null` : lecture échouée, on garde l'existant. */
async function lire(): Promise<Lecture> {
  const [gamesRes, doneRes, ouvertures] = await Promise.all([
    supabase
      .from('dashboard_games')
      .select('*')
      .eq('actif', true)
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('dashboard_done').select('game_id, done_at'),
    lireOuvertures(),
  ])

  let doneMap: Record<string, string | null> | null = null
  if (doneRes.data) {
    doneMap = {}
    for (const r of doneRes.data as { game_id: string; done_at: string }[]) {
      doneMap[r.game_id] = r.done_at
    }
  }
  return { games: (gamesRes.data as Game[] | null) ?? null, doneMap, ouvertures }
}

/**
 * Les jeux et leurs coches « Fait » : lecture Supabase (clé publique) et
 * toutes les écritures (Server Actions).
 *
 * L'écran est mis à jour tout de suite (optimiste) ; si le serveur refuse,
 * `surEchecEcriture` prévient et recharge depuis la base.
 *
 * `ajouter`, `modifier` et `enregistrerNotif` LÈVENT en cas d'échec : elles
 * sont appelées par une modale qui remet son propre état avant d'appeler
 * `surEchecEcriture`. Les autres opérations gèrent l'échec elles-mêmes.
 */
export function useJeux() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  // Feature B — coche "fait"
  const [doneMap, setDoneMap] = useState<Record<string, string | null>>({})
  // Stats d'usage : une ligne par ouverture
  const [ouvertures, setOuvertures] = useState<Ouverture[]>([])

  function appliquer({ games, doneMap, ouvertures }: Lecture) {
    if (games) setGames(games)
    if (doneMap) setDoneMap(doneMap)
    if (ouvertures) setOuvertures(ouvertures)
    setLoading(false)
  }

  function charger() {
    return lire().then(appliquer)
  }

  // Chargement initial : l'état n'est modifié que dans le callback, une fois
  // la lecture terminée (règle react-hooks/set-state-in-effect).
  useEffect(() => { lire().then(appliquer) }, [])

  // Écriture refusée (session expirée, erreur réseau…) : on prévient et on
  // resynchronise l'affichage optimiste avec la base.
  function surEchecEcriture(err: unknown) {
    console.error('Écriture refusée :', err)
    alert('Enregistrement impossible (session expirée ?). Rechargement des données.')
    charger()
  }

  // Feature B — coche "fait" : valable jusqu'au prochain reset_heure, à
  // Paris (et non à l'heure du téléphone).
  function estFait(game: Game): boolean {
    const doneAt = doneMap[game.id]
    if (!doneAt) return false
    if (!game.reset_heure) return true
    return jourDeCycle(new Date(doneAt), game.reset_heure) === jourDeCycle(maintenant(), game.reset_heure)
  }

  async function basculerFait(game: Game, checked: boolean) {
    setDoneMap(prev => ({ ...prev, [game.id]: checked ? new Date().toISOString() : null }))
    try {
      const doneAt = await basculerFaitServeur(game.id, checked)
      setDoneMap(prev => ({ ...prev, [game.id]: doneAt }))
    } catch (err) {
      surEchecEcriture(err)
    }
  }

  async function ajouter(form: FormState) {
    const data = await creerJeu(form)
    setGames(prev => [...prev, data])
  }

  async function modifier(gameId: string, form: FormState) {
    const data = await modifierJeu(gameId, form)
    setGames(prev => prev.map(g => g.id === gameId ? data : g))
  }

  async function enregistrerNotif(gameId: string, notif: NotifFormState) {
    const data = await enregistrerNotifServeur(gameId, notif)
    setGames(prev => prev.map(g => g.id === gameId ? data : g))
  }

  async function supprimer(game: Game) {
    try {
      await supprimerJeu(game.id)
      setGames(prev => prev.filter(g => g.id !== game.id))
    } catch (err) {
      surEchecEcriture(err)
    }
  }

  function marquerOuvert(game: Game) {
    const now = new Date().toISOString()
    setGames(prev => prev.map(g => g.id === game.id ? { ...g, dernier_ouvert: now } : g))
    setOuvertures(prev => [...prev, { game_id: game.id, opened_at: now }])
    // Pas d'alerte ici : l'utilisateur vient de quitter l'onglet pour le jeu.
    marquerOuvertServeur(game.id).catch(err => console.error('dernier_ouvert non enregistré :', err))
  }

  /**
   * Déplace `deId` à la place de `versId` dans la catégorie, puis renumérote
   * la catégorie (1, 2, 3…). Sans effet si l'un des deux n'y est pas.
   */
  async function deplacer(categorie: string, deId: string, versId: string) {
    const catGames = games.filter(g => categorieDe(g) === categorie)
    const fromIdx = catGames.findIndex(g => g.id === deId)
    const toIdx = catGames.findIndex(g => g.id === versId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...catGames]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const updates = reordered.map((g, i) => ({ id: g.id, ordre: i + 1 }))
    setGames(prev =>
      prev.map(g => {
        const u = updates.find(u => u.id === g.id)
        return u ? { ...g, ordre: u.ordre } : g
      })
    )

    try {
      await reordonner(updates)
    } catch (err) {
      surEchecEcriture(err)
    }
  }

  return {
    games,
    loading,
    stats: statsUsage(ouvertures, maintenant()),
    estFait,
    surEchecEcriture,
    basculerFait,
    ajouter,
    modifier,
    enregistrerNotif,
    supprimer,
    marquerOuvert,
    deplacer,
  }
}
