import { useState, useEffect, useRef } from 'react'
import type { Game } from '@/lib/supabase'
import type { GameStatus } from '@/lib/status/types'
import { fetchCdm26PicksStatus } from '@/lib/status/cdm26Picks'
import { fetchCdm26FantasyStatus } from '@/lib/status/cdm26Fantasy'

async function loadStatus(sourceType: string): Promise<GameStatus> {
  if (sourceType === 'cdm26_picks') return fetchCdm26PicksStatus()
  if (sourceType === 'cdm26_fantasy') return fetchCdm26FantasyStatus()
  return { state: 'error' }
}

/**
 * Statuts dynamiques (CDM26…) des jeux qui ont un `source_type` : chargés une
 * seule fois par jeu. `oublierStatut` force un nouveau chargement (ex. quand
 * le `source_type` d'un jeu change).
 */
export function useStatuts(games: Game[]) {
  const [statuses, setStatuses] = useState<Record<string, GameStatus>>({})
  const statusFetched = useRef(new Set<string>())

  // Load statuses for games with source_type
  useEffect(() => {
    const todo = games.filter(g => g.source_type && !statusFetched.current.has(g.id))
    if (todo.length === 0) return
    todo.forEach(g => {
      statusFetched.current.add(g.id)
      setStatuses(prev => ({ ...prev, [g.id]: { state: 'loading' } }))
      loadStatus(g.source_type!).then(status => {
        setStatuses(prev => ({ ...prev, [g.id]: status }))
      }).catch(() => {
        setStatuses(prev => ({ ...prev, [g.id]: { state: 'error' } }))
      })
    })
  }, [games])

  function oublierStatut(gameId: string) {
    statusFetched.current.delete(gameId)
    setStatuses(prev => {
      const next = { ...prev }
      delete next[gameId]
      return next
    })
  }

  return { statuses, oublierStatut }
}
