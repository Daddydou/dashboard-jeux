import 'server-only'
import { supabase } from '@/lib/supabase'
import { echeanceCourte, horloge, nombreFr, presse, rangFr } from '@/lib/relatif'
import type { Ligne, ResultatLive, Ton } from './types'
import { nomCourt } from './tennis'

/**
 * Pick + Bracket (Game Tracker, l'app de Thomas) : mon pick du tour ouvert,
 * son heure de verrou et mon classement.
 *
 * Source de vérité : l'API « picks tennis » de Game Tracker, en LECTURE
 * seule (GET), avec la clé GAMETRACKER_PICKS_KEY (la même que l'app tennis,
 * secrète, serveur uniquement). Aucun POST n'existe dans ce fichier.
 * Sans clé : repli sur la copie du bracket de Thomas en base (tn_bracket_externe_*),
 * moins précise (pas de pick, pas de verrou par tour).
 */

const BASE = 'https://bowling-tracker-phi.vercel.app/api/v1/tennis/picks'
const DELAI_MS = 6000

type Objet = Record<string, unknown>
const objet = (v: unknown): Objet | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Objet) : null)
const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

type TourOuvert = { nom: string; lockAt: string | null }
type TournoiGT = { id: string; nom: string; tourOuvert: TourOuvert | null }
type EtatGT = {
  tourOuvert: (TourOuvert & { attendus: number; poses: number }) | null
  moi: { rang: number | null; points: number } | null
}

async function lire(chemin: string): Promise<unknown> {
  const cle = process.env.GAMETRACKER_PICKS_KEY
  if (!cle) throw new Error('sans clé')
  let res: Response
  try {
    res = await fetch(`${BASE}${chemin}`, {
      headers: { Authorization: `Bearer ${cle}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(DELAI_MS),
      // Une minute de cache : le rafraîchissement automatique de l'accueil ne
      // doit pas marteler l'API (60 requêtes par minute au maximum).
      next: { revalidate: 60 },
    })
  } catch {
    // L'erreur d'origine peut citer la requête : on ne la reprend jamais.
    throw new Error('Game Tracker injoignable')
  }
  if (!res.ok) throw new Error(res.status === 401 ? 'clé Game Tracker refusée' : `Game Tracker : erreur ${res.status}`)
  return res.json()
}

function lireTourOuvert(v: unknown): TourOuvert | null {
  const o = objet(v)
  const nom = o ? texte(o.nom) : null
  return o && nom ? { nom, lockAt: texte(o.lockAt) } : null
}

function lireTournois(brut: unknown): TournoiGT[] {
  const liste = objet(brut)?.tournois
  if (!Array.isArray(liste)) return []
  return liste.flatMap(t => {
    const o = objet(t)
    const id = o ? texte(o.id) : null
    const nom = o ? texte(o.nom) : null
    return o && id && nom ? [{ id, nom, tourOuvert: lireTourOuvert(o.tourOuvert) }] : []
  })
}

function lireEtat(brut: unknown): EtatGT {
  const r = objet(brut) ?? {}
  const to = objet(r.tourOuvert)
  let tourOuvert: EtatGT['tourOuvert'] = null
  if (to && texte(to.nom)) {
    const attendus = nombre(to.picksAttendus) ?? 2
    const mp = objet(to.monPick) ?? {}
    const poses = (mp.haut ? 1 : 0) + (attendus > 1 && mp.bas ? 1 : 0)
    tourOuvert = { nom: texte(to.nom) as string, lockAt: texte(to.lockAt), attendus, poses }
  }
  const classement = Array.isArray(r.classement) ? r.classement.map(objet) : []
  const ligne = classement.find(c => c?.moi === true)
  return {
    tourOuvert,
    moi: ligne ? { rang: nombre(ligne.rang), points: nombre(ligne.points) ?? 0 } : null,
  }
}

const temps = (iso: string | null) => (iso ? Date.parse(iso) : Infinity)

export async function chargerGameTracker(now: Date): Promise<ResultatLive> {
  if (!process.env.GAMETRACKER_PICKS_KEY) return repliBase()

  let tournois: TournoiGT[]
  try {
    tournois = lireTournois(await lire('/tournois'))
  } catch (e) {
    const repli = await repliBase()
    return { ...repli, note: `Pick + Bracket : ${e instanceof Error ? e.message : 'erreur'}, affichage limité.` }
  }

  const ouverts = tournois.filter(t => t.tourOuvert).sort((a, b) => temps(a.tourOuvert!.lockAt) - temps(b.tourOuvert!.lockAt))
  if (ouverts.length === 0) {
    return { live: { ton: 'calme', contexte: 'Tennis', titre: 'Aucun tour ouvert aux picks', lignes: [], echeance: null } }
  }

  const etats = await Promise.all(
    ouverts.slice(0, 3).map(async t => {
      try {
        return { t, etat: lireEtat(await lire(`?tournoi=${encodeURIComponent(t.id)}`)) }
      } catch {
        return { t, etat: null }
      }
    }),
  )

  const aFaire = (e: (typeof etats)[number]) => !!e.etat?.tourOuvert && e.etat.tourOuvert.poses < e.etat.tourOuvert.attendus
  const principal = etats.find(aFaire) ?? etats[0]
  const to = principal.etat?.tourOuvert ?? null
  const verrou = to?.lockAt ? new Date(to.lockAt) : null
  const manque = aFaire(principal)

  let ton: Ton = manque ? 'afaire' : 'ok'
  if (manque && presse(verrou, now)) ton = 'urgent'
  if (!to) ton = 'calme'

  const lignes: Ligne[] = []
  if (verrou) lignes.push({ texte: `Verrou ${echeanceCourte(verrou, now)}` })
  const moi = principal.etat?.moi
  if (moi) lignes.push({ texte: `Classement : ${moi.rang ? rangFr(moi.rang) : '—'} · ${nombreFr(moi.points)} pts` })
  for (const e of etats.filter(x => x !== principal).slice(0, 1)) {
    const t2 = e.etat?.tourOuvert
    if (t2) {
      lignes.push({
        texte: `${nomCourt(e.t.nom)} · ${t2.nom} : ${t2.poses}/${t2.attendus}${t2.poses >= t2.attendus ? ' ✓' : ''}`,
        ton: t2.poses >= t2.attendus ? 'ok' : 'afaire',
      })
      if (t2.poses < t2.attendus && ton === 'ok') ton = 'afaire'
    }
  }

  const restant = manque && verrou ? horloge(verrou, now) : null
  return {
    live: {
      ton,
      contexte: `${nomCourt(principal.t.nom)} · ${to?.nom ?? principal.t.tourOuvert?.nom ?? ''}`,
      titre: !to ? 'Tour ouvert' : to.poses === 0 ? 'Ton pick est à poser' : manque ? 'Pick incomplet' : 'Pick posé',
      chiffre: to ? { valeur: `${to.poses}/${to.attendus}`, legende: 'picks du tour' } : undefined,
      lignes,
      echeance: restant ? `dans ${restant}` : null,
    },
    note: principal.etat ? undefined : 'Pick + Bracket : état du tournoi illisible.',
  }
}

/** Sans clé : les tournois du bracket de Thomas recopiés en base (pas de pick par tour). */
async function repliBase(): Promise<ResultatLive> {
  const { data, error } = await supabase
    .from('tn_bracket_externe_tournois')
    .select('nom, statut, verrouille, lock_at')
    .in('statut', ['UPCOMING', 'ONGOING'])
    .order('lock_at', { ascending: true, nullsFirst: false })
    .limit(3)
  if (error) return { live: null, note: `Pick + Bracket : ${error.message}` }
  const liste = (data ?? []) as { nom: string; statut: string; verrouille: boolean; lock_at: string | null }[]
  if (liste.length === 0) {
    return { live: { ton: 'calme', contexte: 'Tennis', titre: 'Aucun tournoi ouvert', lignes: [], echeance: null } }
  }
  const [premier, ...autres] = liste
  return {
    live: {
      ton: 'calme',
      contexte: `${nomCourt(premier.nom)} · ${premier.statut === 'ONGOING' ? 'en cours' : 'à venir'}`,
      titre: 'Ouvre le jeu pour voir ton pick',
      lignes: [
        ...autres.map(t => ({ texte: `${nomCourt(t.nom)} · ${t.statut === 'ONGOING' ? 'en cours' : 'à venir'}` })),
        { texte: 'Statut détaillé : clé Game Tracker à ajouter' },
      ],
      echeance: null,
    },
  }
}
