import { supabase } from '@/lib/supabase'
import type { GameStatus } from './types'
import { MON_PSEUDO } from '@/lib/constants'

type FantasyRpcResult =
  | { rank: number; points: number }
  | { error: string }

export async function fetchCdm26FantasyStatus(): Promise<GameStatus> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_fantasy_status', {
      p_display_name: MON_PSEUDO,
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
