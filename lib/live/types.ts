/**
 * Ce qu'une carte « à la une » affiche, tel que le calcule son connecteur.
 * Tous les textes sont prêts à afficher (heure de Paris, français) : la
 * carte ne fait aucun calcul.
 *
 * Module pur : importable partout.
 */

/**
 * - `urgent` : une action m'attend et ça presse (moins de 2 h, ou un échec)
 * - `afaire` : une action m'attend
 * - `ok` : tout est en ordre
 * - `calme` : rien à faire pour l'instant (pas de tournoi, pas de soirée…)
 */
export type Ton = 'urgent' | 'afaire' | 'ok' | 'calme'

export type Ligne = { texte: string; ton?: Ton }

/** Une rangée par tournoi (ou par élément suivi) quand il y en a plusieurs en même temps. */
export type Rangee = {
  titre: string
  detail: string
  /** « 2/2 », à droite de la rangée. */
  score?: string
  ton: Ton
  /** Lien direct vers cet élément (sinon : le lien de la carte). */
  lien?: string
}

export type Live = {
  ton: Ton
  /** Contexte court : « Bercy · 32es ». */
  contexte: string
  /** Ce qu'il faut retenir : « Ton pick est à poser ». */
  titre: string
  /** Le chiffre clé, en grand : « 0/2 », « 36 ». */
  chiffre?: { valeur: string; legende: string }
  /** Deux ou trois précisions, une par ligne. */
  lignes: Ligne[]
  /** Plusieurs tournois en même temps : une rangée chacun, sous le titre. */
  rangees?: Rangee[]
  /** « dans 1 h 12 » ou « à 23:10 », null si rien ne presse. */
  echeance: string | null
  /** Lien direct vers le bon écran du jeu (sinon : le site du jeu). */
  lien?: string
}

/** Une panne devient une note, jamais une exception : une carte ne casse pas la page. */
export type ResultatLive = { live: Live | null; note?: string }

export const SOURCES = {
  gametracker: 'Pick + Bracket (Game Tracker)',
  optipick: 'Opti-Pick (plan de picks tennis)',
  ttfl: 'TTFL (pick du soir et robot)',
} as const

export type Source = keyof typeof SOURCES

export function estSource(v: unknown): v is Source {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SOURCES, v)
}
