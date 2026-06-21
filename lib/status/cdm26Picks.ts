import { supabase } from '@/lib/supabase'
import type { GameStatus } from './types'

const MY_USERNAME = 'DaddyKvaratskhelia'

type PicksRpcResult = {
  next_match: string | null
  match_date: string | null
  picks_done: boolean | null
} | { error: string }

export async function fetchCdm26PicksStatus(): Promise<GameStatus> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_picks_status', {
      p_username: MY_USERNAME,
    })

    if (error) return { state: 'error' }

    const result = data as PicksRpcResult
    if ('error' in result) return { state: 'error' }

    // Pas de match à venir
    if (result.next_match === null) return { state: 'ok', label: '✅ Aucun match' }

    if (!result.picks_done) return { state: 'warn', label: '⚠️ Picks à faire' }
    return { state: 'ok', label: '✅ À jour' }
  } catch {
    return { state: 'error' }
  }
}
