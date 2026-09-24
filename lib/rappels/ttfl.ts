import 'server-only'
import { supabase } from '@/lib/supabase'
import type { ResultatSource } from './types'

const URL_TTFL = 'https://fantasy.trashtalk.co/'

type PickDuJour =
  | { status: 'no_pick_yet'; game_date: string }
  | {
      status: 'ok'
      game_date: string
      player: string
      team: string
      opponent: string
      projection: number | null
      is_urgent: boolean | null
    }

/**
 * TTFL : pick du soir recommandé par le moteur (mes-agents), via la RPC
 * `get_ttfl_pick_du_jour` (SECURITY DEFINER, clé publique). Rien tant que le
 * moteur n'a pas tourné ce jour-là. Pas d'échéance connue : rappel « bientôt ».
 */
export async function rappelsTtfl(): Promise<ResultatSource> {
  const { data, error } = await supabase.rpc('get_ttfl_pick_du_jour')
  if (error) return { rappels: [], note: 'TTFL : pick du jour illisible.' }

  const pick = data as PickDuJour | null
  if (!pick || pick.status !== 'ok') return { rappels: [] }

  const projection = pick.projection === null ? '' : ` · projection ${Math.round(pick.projection)}`
  return {
    rappels: [{
      cle: `ttfl:${pick.game_date}`,
      source: 'ttfl',
      titre: `TTFL : pick du soir, ${pick.player}`,
      detail: `${pick.team} contre ${pick.opponent}${projection}`,
      echeance: null,
      urgence: pick.is_urgent ? 'urgent' : 'bientot',
      fait: false,
      url: URL_TTFL,
    }],
  }
}
