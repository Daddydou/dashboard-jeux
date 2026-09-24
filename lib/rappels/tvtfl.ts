import 'server-only'
import { supabase } from '@/lib/supabase'
import { formatParis } from '@/lib/time'
import { urgenceDe, type ResultatSource } from './types'

const URL_TVTFL = 'https://tvtfl.vercel.app/'

type Badge = { deck_date: string | null; lock_at: string | null; has_pick: boolean; is_locked: boolean }

/**
 * TVTFL : prochain deck ouvert et pick fait ou non, via la RPC
 * `tvtfl_dashboard_badge(p_token)` (SECURITY DEFINER, projet TVTFL).
 * Le jeton TVTFL_DASHBOARD_TOKEN est secret : cet appel reste côté serveur.
 */
export async function rappelsTvtfl(maintenant: Date): Promise<ResultatSource> {
  const jeton = process.env.TVTFL_DASHBOARD_TOKEN
  if (!jeton) return { rappels: [], note: 'TVTFL : jeton non configuré (TVTFL_DASHBOARD_TOKEN).' }

  const { data, error } = await supabase.rpc('tvtfl_dashboard_badge', { p_token: jeton })
  if (error) return { rappels: [], note: 'TVTFL : lecture refusée (jeton ?).' }

  const badge = (data as Badge[] | null)?.[0]
  if (!badge || badge.is_locked || !badge.deck_date || !badge.lock_at) return { rappels: [] }

  const fermeture = new Date(badge.lock_at)
  const [, mois, jour] = badge.deck_date.split('-')
  return {
    rappels: [{
      cle: `tvtfl:${badge.deck_date}`,
      source: 'tvtfl',
      titre: badge.has_pick ? 'TVTFL : pick fait' : 'TVTFL : pick à faire',
      detail: `Deck du ${jour}/${mois} · ferme ${formatParis(fermeture)}`,
      echeance: badge.lock_at,
      urgence: urgenceDe(fermeture, maintenant),
      fait: badge.has_pick,
      url: URL_TVTFL,
    }],
  }
}
