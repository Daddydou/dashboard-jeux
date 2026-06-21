import { supabase } from '@/lib/supabase'
import type { GameStatus } from './types'

// display_name dans fantasy_participants — ajuster si différent
const MY_DISPLAY_NAME = 'DaddyKvaratskhelia'

type FantasyRpcResult =
  | { rank: number; points: number }
  | { error: string }

export async function fetchCdm26FantasyStatus(): Promise<GameStatus> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_fantasy_status', {
      p_display_name: MY_DISPLAY_NAME,
    })

    if (error) return { state: 'error' }

    const result = data as FantasyRpcResult
    if ('error' in result) return { state: 'error' }

    const pts = Number(result.points).toFixed(1)
    return { state: 'ok', label: `#${result.rank} · ${pts} pts` }
  } catch {
    return { state: 'error' }
  }
}
