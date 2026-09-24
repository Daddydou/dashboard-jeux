import { partiesParis } from '@/lib/time'

/**
 * Stats d'usage par jeu, calculées depuis dashboard_ouvertures. Les jours
 * sont des jours calendaires à Paris. Module pur : testable seul.
 */

export type Ouverture = { game_id: string; opened_at: string }

export type StatsJeu = {
  total: number
  /** Ouvertures sur les 7 derniers jours (aujourd'hui compris). */
  semaine: number
  /** Ouvertures sur les 30 derniers jours (aujourd'hui compris). */
  mois: number
  /** Jours consécutifs avec au moins une ouverture, jusqu'à aujourd'hui ou hier. */
  serie: number
}

/** Numéro de jour (jours depuis 1970) d'une date AAAA-MM-JJ, sans fuseau. */
function numeroJour(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function statsUsage(ouvertures: Ouverture[], maintenant: Date): Record<string, StatsJeu> {
  const aujourdhui = numeroJour(partiesParis(maintenant).date)
  const joursParJeu = new Map<string, number[]>()
  for (const o of ouvertures) {
    const jour = numeroJour(partiesParis(new Date(o.opened_at)).date)
    const liste = joursParJeu.get(o.game_id) ?? []
    liste.push(jour)
    joursParJeu.set(o.game_id, liste)
  }

  const stats: Record<string, StatsJeu> = {}
  for (const [gameId, jours] of joursParJeu) {
    const actifs = new Set(jours)
    // La série compte encore si on n'a pas (encore) joué aujourd'hui.
    let jour = actifs.has(aujourdhui) ? aujourdhui : aujourdhui - 1
    let serie = 0
    while (actifs.has(jour)) {
      serie++
      jour--
    }
    stats[gameId] = {
      total: jours.length,
      semaine: jours.filter(j => aujourdhui - j < 7 && j <= aujourdhui).length,
      mois: jours.filter(j => aujourdhui - j < 30 && j <= aujourdhui).length,
      serie,
    }
  }
  return stats
}
