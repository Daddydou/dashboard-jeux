import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { echeanceCourte, horloge, nombreFr, presse } from '@/lib/relatif'
import type { Ligne, ResultatLive, Ton } from './types'

/**
 * TTFL : pick du soir calculé par le moteur, et saisie du robot sur les
 * comptes de l'équipe.
 *
 * Les tables ttfl_* sont privées (RLS « propriétaire ») : on les LIT avec la
 * clé service-role, côté serveur uniquement, quelques colonnes seulement.
 * Aucune écriture ici.
 */

type Run = { game_date: string; mode: string }
type Pick = { player: string; team: string; opponent: string; projection: number | null }
type Envoi = { compte: string; statut: string }
type Match = { abbr_dom: string; abbr_ext: string; commence_time: string }

const formatSoiree = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' })

export async function chargerTtfl(now: Date, lien: string): Promise<ResultatLive> {
  const db = supabaseAdmin()

  const { data: run, error: errRun } = await db
    .from('ttfl_latest_run')
    .select('game_date, mode')
    .eq('mode', 'regular')
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle<Run>()
  if (errRun) return { live: null, note: `TTFL : ${errRun.message}` }
  if (!run) {
    return { live: { ton: 'calme', contexte: 'Saison NBA', titre: 'Pas encore de soirée calculée', lignes: [], echeance: null, lien } }
  }

  const [pickRes, envoisRes, matchsRes] = await Promise.all([
    db
      .from('ttfl_latest_projections')
      .select('player, team, opponent, projection')
      .eq('mode', run.mode)
      .eq('game_date', run.game_date)
      .eq('is_pick', true)
      .order('computed_at', { ascending: false })
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle<Pick>(),
    db.from('ttfl_envois').select('compte, statut').eq('mode', run.mode).eq('pick_date', run.game_date),
    db.from('ttfl_vainqueurs_matchs').select('abbr_dom, abbr_ext, commence_time').eq('game_date', run.game_date),
  ])

  const pick = pickRes.data
  const envois = (envoisRes.data ?? []) as Envoi[]
  const matchs = (matchsRes.data ?? []) as Match[]

  const soiree = formatSoiree.format(new Date(`${run.game_date}T12:00:00Z`))
  const lignes: Ligne[] = []
  let echeance: Date | null = null

  if (pick) {
    const match = matchs.find(m => m.abbr_dom === pick.opponent || m.abbr_ext === pick.opponent)
    if (match) {
      const equipe = match.abbr_dom === pick.opponent ? match.abbr_ext : match.abbr_dom
      echeance = new Date(match.commence_time)
      lignes.push({ texte: `${equipe} – ${pick.opponent} · ${echeanceCourte(echeance, now)}` })
    } else {
      lignes.push({ texte: `${pick.team} contre ${pick.opponent}` })
    }
  }

  // Le robot : combien de comptes ont un pick confirmé pour la soirée.
  const confirmes = envois.filter(e => e.statut === 'confirme').length
  const echecs = envois.filter(e => e.statut === 'echec').length
  let ton: Ton = 'ok'
  if (envois.length === 0) {
    ton = pick ? 'afaire' : 'calme'
    if (pick) lignes.push({ texte: 'Robot : aucun compte saisi', ton: 'afaire' })
  } else if (echecs > 0) {
    ton = 'urgent'
    lignes.push({ texte: `Robot : ${echecs} en échec sur ${envois.length}`, ton: 'urgent' })
  } else {
    lignes.push({ texte: `Robot : ${confirmes}/${envois.length} comptes confirmés`, ton: 'ok' })
  }
  if (ton === 'afaire' && presse(echeance, now)) ton = 'urgent'

  const restant = echeance && ton !== 'ok' ? horloge(echeance, now) : null

  return {
    live: {
      ton,
      contexte: `Soirée du ${soiree}`,
      titre: pick ? pick.player : 'Pick du soir pas encore choisi',
      chiffre: pick?.projection != null ? { valeur: nombreFr(Math.round(pick.projection)), legende: 'projection' } : undefined,
      lignes,
      echeance: restant ? `dans ${restant}` : null,
      lien,
    },
    note: pickRes.error || envoisRes.error ? 'TTFL : lecture partielle.' : undefined,
  }
}
