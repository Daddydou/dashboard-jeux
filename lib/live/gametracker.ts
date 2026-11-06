import 'server-only'
import { supabase } from '@/lib/supabase'
import { echeanceCourte, horloge, nombreFr, presse, rangFr } from '@/lib/relatif'
import type { Rangee, ResultatLive, Ton } from './types'
import { nomCourt } from './tennis'

/**
 * Pick + Bracket (Game Tracker, l'app de Thomas) : pour CHAQUE tournoi en
 * cours, mon pick du tour ouvert, son heure de verrou et mon classement.
 *
 * Source de vérité : l'API « picks tennis » de Game Tracker, en LECTURE
 * seule (GET), avec la clé GAMETRACKER_PICKS_KEY (la même que l'app tennis,
 * secrète, serveur uniquement). Aucun POST n'existe dans ce fichier.
 * Sans clé : repli sur la copie du bracket de Thomas en base (tn_bracket_externe_*),
 * moins précise (pas de pick, pas de verrou par tour).
 */

const BASE = 'https://bowling-tracker-phi.vercel.app/api/v1/tennis/picks'
const DELAI_MS = 6000
const MAX_TOURNOIS = 6

type Objet = Record<string, unknown>
const objet = (v: unknown): Objet | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Objet) : null)
const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

type TourOuvert = { nom: string; lockAt: string | null }
type TournoiGT = { id: string; nom: string; statut: string | null; tourOuvert: TourOuvert | null }
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
    return o && id && nom ? [{ id, nom, statut: texte(o.statut), tourOuvert: lireTourOuvert(o.tourOuvert) }] : []
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

/** Un tournoi terminé n'a plus rien à montrer. */
const termine = (statut: string | null) => !!statut && /complet|termin|finish|clos|closed/i.test(statut)

const temps = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Infinity)

type Suivi = { t: TournoiGT; etat: EtatGT | null }

function rangeeDe({ t, etat }: Suivi, now: Date): Rangee & { manque: number; verrou: Date | null } {
  const to = etat?.tourOuvert ?? null
  const verrou = to?.lockAt ? new Date(to.lockAt) : t.tourOuvert?.lockAt ? new Date(t.tourOuvert.lockAt) : null
  const manque = to ? Math.max(0, to.attendus - to.poses) : 0
  let ton: Ton = !to ? 'calme' : manque > 0 ? 'afaire' : 'ok'
  if (manque > 0 && presse(verrou, now)) ton = 'urgent'

  const morceaux: string[] = []
  morceaux.push(to?.nom ?? t.tourOuvert?.nom ?? 'aucun tour ouvert')
  if (verrou && verrou.getTime() > now.getTime()) morceaux.push(`verrou ${echeanceCourte(verrou, now)}`)
  if (etat?.moi) morceaux.push(`${etat.moi.rang ? rangFr(etat.moi.rang) : '—'} · ${nombreFr(etat.moi.points)} pts`)

  return {
    titre: nomCourt(t.nom),
    detail: morceaux.join(' · '),
    score: to ? `${to.poses}/${to.attendus}` : undefined,
    ton,
    manque,
    verrou,
  }
}

export async function chargerGameTracker(now: Date): Promise<ResultatLive> {
  if (!process.env.GAMETRACKER_PICKS_KEY) return repliBase()

  let tournois: TournoiGT[]
  try {
    tournois = lireTournois(await lire('/tournois'))
  } catch (e) {
    const repli = await repliBase()
    return { ...repli, note: `Pick + Bracket : ${e instanceof Error ? e.message : 'erreur'}, affichage limité.` }
  }

  const enCours = tournois
    .filter(t => !termine(t.statut))
    .sort((a, b) => temps(a.tourOuvert?.lockAt) - temps(b.tourOuvert?.lockAt))
    .slice(0, MAX_TOURNOIS)
  if (enCours.length === 0) {
    return { live: { ton: 'calme', contexte: 'Tennis', titre: 'Aucun tournoi en cours', lignes: [], echeance: null } }
  }

  const suivis: Suivi[] = await Promise.all(
    enCours.map(async t => {
      try {
        return { t, etat: lireEtat(await lire(`?tournoi=${encodeURIComponent(t.id)}`)) }
      } catch {
        return { t, etat: null }
      }
    }),
  )

  const rangees = suivis.map(s => rangeeDe(s, now))
  // À faire d'abord (le verrou le plus proche en tête), puis le reste.
  const poids: Record<Ton, number> = { urgent: 0, afaire: 1, ok: 2, calme: 3 }
  rangees.sort((a, b) => poids[a.ton] - poids[b.ton] || temps(a.verrou?.toISOString()) - temps(b.verrou?.toISOString()))

  const manque = rangees.reduce((n, r) => n + r.manque, 0)
  const ton = rangees.reduce<Ton>((pire, r) => (poids[r.ton] < poids[pire] ? r.ton : pire), 'calme')
  const prochainVerrou = rangees.find(r => r.manque > 0 && r.verrou)?.verrou ?? null
  const restant = prochainVerrou ? horloge(prochainVerrou, now) : null
  const illisible = suivis.some(s => !s.etat)

  const titre =
    manque > 0
      ? `${manque} pick${manque > 1 ? 's' : ''} à poser`
      : rangees.some(r => r.score)
        ? enCours.length > 1
          ? 'Tous tes picks sont posés'
          : 'Pick posé'
        : 'Aucun tour ouvert'

  return {
    live: {
      ton: ton === 'calme' && rangees.some(r => r.ton === 'ok') ? 'ok' : ton,
      contexte: enCours.length > 1 ? `${enCours.length} tournois en cours` : rangees[0].titre,
      titre,
      lignes: [],
      rangees: rangees.map(({ titre, detail, score, ton }) => ({ titre, detail, score, ton })),
      echeance: restant ? `dans ${restant}` : null,
    },
    note: illisible ? 'Pick + Bracket : un tournoi n’a pas pu être lu.' : undefined,
  }
}

/** Sans clé : les tournois du bracket de Thomas recopiés en base (pas de pick par tour). */
async function repliBase(): Promise<ResultatLive> {
  const { data, error } = await supabase
    .from('tn_bracket_externe_tournois')
    .select('nom, statut, verrouille, lock_at')
    .in('statut', ['UPCOMING', 'ONGOING'])
    .order('lock_at', { ascending: true, nullsFirst: false })
    .limit(MAX_TOURNOIS)
  if (error) return { live: null, note: `Pick + Bracket : ${error.message}` }
  const liste = (data ?? []) as { nom: string; statut: string; verrouille: boolean; lock_at: string | null }[]
  if (liste.length === 0) {
    return { live: { ton: 'calme', contexte: 'Tennis', titre: 'Aucun tournoi ouvert', lignes: [], echeance: null } }
  }
  return {
    live: {
      ton: 'calme',
      contexte: liste.length > 1 ? `${liste.length} tournois` : nomCourt(liste[0].nom),
      titre: 'Ouvre le jeu pour voir tes picks',
      lignes: [{ texte: 'Statut détaillé : clé Game Tracker à ajouter' }],
      rangees: liste.map(t => ({
        titre: nomCourt(t.nom),
        detail: t.statut === 'ONGOING' ? 'en cours' : 'à venir',
        ton: 'calme' as Ton,
      })),
      echeance: null,
    },
  }
}
