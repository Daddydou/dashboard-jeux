import 'server-only'
import { supabase } from '@/lib/supabase'
import type { Rangee, ResultatLive, Ton } from './types'
import { libelleTour, nomCourt, origine, picksAttendus } from './tennis'

/**
 * Opti-Pick (l'app tennis) : où en est mon plan de picks sur CHACUN des
 * tournois en cours. Les tables tn_* sont en lecture publique : clé anon,
 * rien d'autre. Mes picks sont ceux sans participant (Laki et Thomas en ont un).
 */

const MAX_TOURNOIS = 8

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

type Tournoi = { id: string; name: string; rounds: string[] | null; start_date: string | null }
type Match = { tournament_id: string; round: string; status: string }
type Pick = { tournament_id: string; round: string }

type Etat = {
  tournoi: Tournoi
  tour: string
  poses: number
  attendus: number
  posesTotal: number
  attendusTotal: number
}

export async function chargerOptiPick(urlJeu: string): Promise<ResultatLive> {
  const { data: tournois, error } = await supabase
    .from('tn_tournaments')
    .select('id, name, rounds, start_date')
    .eq('status', 'running')
    .order('start_date', { ascending: false })
    .limit(MAX_TOURNOIS)
  if (error) return { live: null, note: `Opti-Pick : ${error.message}` }

  const liste = (tournois ?? []) as Tournoi[]
  if (liste.length === 0) {
    return { live: { ton: 'calme', contexte: 'Tennis', titre: 'Pas de tournoi en cours', lignes: [], echeance: null } }
  }

  const ids = liste.map(t => t.id)
  const [matchsRes, picksRes] = await Promise.all([
    supabase.from('tn_matches').select('tournament_id, round, status').in('tournament_id', ids),
    supabase.from('tn_picks').select('tournament_id, round').in('tournament_id', ids).is('participant_id', null),
  ])
  if (matchsRes.error || picksRes.error) return { live: null, note: 'Opti-Pick : lecture des matchs impossible.' }
  const matchs = matchsRes.data as Match[]
  const picks = picksRes.data as Pick[]

  const etats: Etat[] = []
  for (const t of liste) {
    const rounds = t.rounds ?? []
    const aJouer = new Set(matchs.filter(m => m.tournament_id === t.id && m.status === 'scheduled').map(m => m.round))
    // Le tour en cours : le premier qui a encore des matchs à jouer.
    const tour = rounds.find(r => aJouer.has(r))
    if (!tour) continue
    const mes = picks.filter(p => p.tournament_id === t.id)
    etats.push({
      tournoi: t,
      tour,
      poses: mes.filter(p => p.round === tour).length,
      attendus: picksAttendus(tour),
      posesTotal: mes.length,
      attendusTotal: rounds.reduce((n, r) => n + picksAttendus(r), 0),
    })
  }

  if (etats.length === 0) {
    return { live: { ton: 'calme', contexte: 'Tennis', titre: 'Tournois terminés', lignes: [], echeance: null } }
  }

  const base = origine(urlJeu)
  const lienDe = (e: Etat) => (base ? `${base}/tournoi/${e.tournoi.id}/picks` : undefined)

  // À préparer d'abord, puis les tournois à jour.
  etats.sort((a, b) => Number(a.poses >= a.attendus) - Number(b.poses >= b.attendus))
  const rangees: Rangee[] = etats.map(e => {
    const ok = e.poses >= e.attendus
    return {
      titre: nomCourt(e.tournoi.name),
      detail: `${majuscule(libelleTour(e.tour))} · tournoi ${e.posesTotal}/${e.attendusTotal} picks`,
      score: `${e.poses}/${e.attendus}`,
      ton: (ok ? 'ok' : 'afaire') as Ton,
      lien: lienDe(e),
    }
  })

  const manque = etats.reduce((n, e) => n + Math.max(0, e.attendus - e.poses), 0)
  const principal = etats[0]

  return {
    live: {
      ton: manque > 0 ? 'afaire' : 'ok',
      contexte: etats.length > 1 ? `${etats.length} tournois en cours` : nomCourt(principal.tournoi.name),
      titre:
        manque > 0
          ? `${manque} pick${manque > 1 ? 's' : ''} à préparer`
          : etats.length > 1
            ? 'Tous les plans sont à jour'
            : 'Plan à jour',
      lignes: [],
      rangees,
      echeance: null,
      lien: lienDe(principal),
    },
  }
}
