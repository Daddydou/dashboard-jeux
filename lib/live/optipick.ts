import 'server-only'
import { supabase } from '@/lib/supabase'
import type { Ligne, ResultatLive } from './types'
import { libelleTour, nomCourt, origine, picksAttendus } from './tennis'

/**
 * Opti-Pick (l'app tennis) : où en est mon plan de picks sur les tournois en
 * cours. Les tables tn_* sont en lecture publique : clé anon, rien d'autre.
 * Mes picks sont ceux sans participant (Laki et Thomas en ont un).
 */

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
    .limit(4)
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

  // À la une : le premier tournoi où il manque des picks, sinon le plus récent.
  const principal = etats.find(e => e.poses < e.attendus) ?? etats[0]
  const manque = principal.poses < principal.attendus
  const autres = etats.filter(e => e !== principal)

  const lignes: Ligne[] = [{ texte: `Tournoi : ${principal.posesTotal}/${principal.attendusTotal} picks posés` }]
  for (const e of autres.slice(0, 2)) {
    const ok = e.poses >= e.attendus
    lignes.push({
      texte: `${nomCourt(e.tournoi.name)} · ${libelleTour(e.tour)} : ${e.poses}/${e.attendus}${ok ? ' ✓' : ''}`,
      ton: ok ? 'ok' : 'afaire',
    })
  }

  const base = origine(urlJeu)
  return {
    live: {
      ton: manque || autres.some(e => e.poses < e.attendus) ? 'afaire' : 'ok',
      contexte: `${nomCourt(principal.tournoi.name)} · ${libelleTour(principal.tour)}`,
      titre: manque ? 'Picks du tour à préparer' : 'Plan à jour',
      chiffre: { valeur: `${principal.poses}/${principal.attendus}`, legende: 'picks du tour' },
      lignes,
      echeance: null,
      lien: base ? `${base}/tournoi/${principal.tournoi.id}/picks` : undefined,
    },
  }
}
