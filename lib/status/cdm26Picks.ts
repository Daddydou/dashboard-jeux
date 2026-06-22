import { supabase } from '@/lib/supabase'
import type { GameStatus } from './types'

const MY_USERNAME = 'DaddyKvaratskhelia'

type PicksFullRpcResult =
  | {
      next_match: string | null
      match_date: string | null
      picks_done: boolean | null
      rank: number
      total_points: number
    }
  | { error: string }

export async function fetchCdm26PicksStatus(): Promise<GameStatus> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_picks_full', {
      p_username: MY_USERNAME,
    })

    if (error) return { state: 'error' }

    const result = data as PicksFullRpcResult
    if ('error' in result) return { state: 'error' }

    const pts = Number(result.total_points ?? 0).toFixed(1)
    const rankLabel = `#${result.rank} · ${pts} pts`

    if (result.next_match === null) return { state: 'ok', label: rankLabel, sublabel: '✅ Aucun match' }
    if (!result.picks_done) return { state: 'warn', label: rankLabel, sublabel: '⚠️ Picks à faire' }
    return { state: 'ok', label: rankLabel, sublabel: '✅ À jour' }
  } catch {
    return { state: 'error' }
  }
}
