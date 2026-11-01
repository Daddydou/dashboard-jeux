/**
 * Petits outils partagés par les cartes tennis (Opti-Pick, Pick + Bracket).
 * Module pur.
 */

const TOURS: Record<string, string> = {
  R128: '64es',
  R64: '32es',
  R32: '16es',
  R16: '8es',
  QF: 'quarts',
  SF: 'demies',
  F: 'finale',
}

/** « R64 » → « 32es », « F » → « finale ». */
export function libelleTour(round: string): string {
  return TOURS[round] ?? round
}

/** 2 picks par tour (un par moitié de tableau), 1 seul en demie et en finale. */
export function picksAttendus(round: string): number {
  return round === 'SF' || round === 'F' ? 1 : 2
}

/**
 * « Paris 2026 » → « Paris », « ATP Masters 1000 Bercy » → « Bercy »,
 * « Vieil ATP 250 Lyon » → « Lyon ».
 */
export function nomCourt(nom: string): string {
  const net = nom
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/^\s*(vieil\s+)?(atp|wta)\s+(masters\s+)?(\d{3,4}\s+)?/i, '')
    .trim()
  return net || nom
}

/** Origine d'une URL (« https://site.app »), ou null si l'URL est invalide. */
export function origine(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}
