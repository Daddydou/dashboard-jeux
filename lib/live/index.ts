import 'server-only'
import type { Game } from '@/lib/supabase'
import { chargerGameTracker } from './gametracker'
import { chargerOptiPick } from './optipick'
import { chargerTtfl } from './ttfl'
import { SOURCES, estSource, type ResultatLive, type Source } from './types'

/**
 * Interroge en parallèle la source de chaque jeu « à la une », avec un délai
 * maximum. Une source lente ou en panne donne une note, jamais une exception :
 * les autres cartes s'affichent quand même.
 */

const DELAI_MS = 7000

function avecDelai<T>(promesse: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const minuteur = setTimeout(() => reject(new Error('délai dépassé')), DELAI_MS)
    promesse.then(
      v => {
        clearTimeout(minuteur)
        resolve(v)
      },
      e => {
        clearTimeout(minuteur)
        reject(e)
      },
    )
  })
}

function lire(source: Source, jeu: Game, now: Date): Promise<ResultatLive> {
  switch (source) {
    case 'gametracker':
      return chargerGameTracker(now)
    case 'optipick':
      return chargerOptiPick(jeu.url)
    case 'ttfl':
      return chargerTtfl(now, jeu.url)
  }
}

export async function chargerLive(jeux: Game[], now: Date): Promise<Record<string, ResultatLive>> {
  const resultats: Record<string, ResultatLive> = {}
  await Promise.all(
    jeux.map(async jeu => {
      if (!estSource(jeu.source_type)) return
      const source = jeu.source_type
      try {
        resultats[jeu.id] = await avecDelai(lire(source, jeu, now))
      } catch (err) {
        console.error(`Source ${source} :`, err)
        resultats[jeu.id] = { live: null, note: `${SOURCES[source]} : pas de réponse.` }
      }
    }),
  )
  return resultats
}
