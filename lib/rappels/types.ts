/**
 * Rappel agrégé depuis une app connectée (boîte 📬). Calculé à la demande,
 * jamais stocké.
 */
export type Rappel = {
  /** Identifiant stable pour la journée (sert à « marquer comme vu »). */
  cle: string
  source: 'tvtfl' | 'ttfl'
  titre: string
  detail?: string
  /** Échéance ISO (fermeture des picks…), null si inconnue. */
  echeance: string | null
  urgence: 'info' | 'bientot' | 'urgent'
  /** Vrai si l'app sait que c'est fait (ex. pick TVTFL posé). */
  fait: boolean
  url: string
}

/** Résultat d'une source : ses rappels, ou une note si elle n'a pas pu répondre. */
export type ResultatSource = { rappels: Rappel[]; note?: string }

/** Moins de 2 h : urgent ; moins de 24 h : bientôt ; sinon : info. */
export function urgenceDe(echeance: Date, maintenant: Date): Rappel['urgence'] {
  const heures = (echeance.getTime() - maintenant.getTime()) / 3_600_000
  if (heures < 2) return 'urgent'
  if (heures < 24) return 'bientot'
  return 'info'
}
