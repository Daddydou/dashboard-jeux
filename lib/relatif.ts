import { FUSEAU, partiesParis } from '@/lib/time'

/**
 * Mise en forme des dates pour l'écran, toujours à l'heure de Paris et
 * toujours par rapport à un `now` passé en argument (jamais `new Date()`
 * ici : le rendu reste prévisible et testable).
 *
 * Module pur : importable partout.
 */

const formatJour = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const formatHeure = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const formatJourCourt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** « Dimanche 1 novembre ». */
export function jourEnToutesLettres(instant: Date): string {
  const texte = formatJour.format(instant)
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** « 19:00 ». */
export function heureParis(instant: Date): string {
  return formatHeure.format(instant)
}

/** « 19:00 » si c'est aujourd'hui, « demain 19:00 », sinon « lun. 3 nov. 19:00 ». */
export function echeanceCourte(echeance: Date, now: Date): string {
  const heure = heureParis(echeance)
  const jour = partiesParis(echeance).date
  if (jour === partiesParis(now).date) return heure
  if (jour === partiesParis(new Date(now.getTime() + 86_400_000)).date) return `demain ${heure}`
  return `${formatJourCourt.format(echeance).replace(',', '')} ${heure}`
}

/**
 * Temps restant avant une échéance : « 45 min », « 1 h 12 », « 2 j ».
 * null si l'échéance est passée.
 */
export function horloge(echeance: Date, now: Date): string | null {
  const minutes = Math.floor((echeance.getTime() - now.getTime()) / 60_000)
  if (minutes < 0) return null
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `${heures} h ${String(minutes % 60).padStart(2, '0')}`
  return `${Math.floor(heures / 24)} j`
}

/** Moins de 2 h avant l'échéance. */
export function presse(echeance: Date | null, now: Date): boolean {
  if (!echeance) return false
  const ecart = echeance.getTime() - now.getTime()
  return ecart >= 0 && ecart < 2 * 3_600_000
}

/** Nombre avec une décimale au plus et la virgule française : 35,6. */
export function nombreFr(valeur: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(valeur)
}

/** 1 → « 1er », 3 → « 3e ». */
export function rangFr(rang: number): string {
  return rang === 1 ? '1er' : `${rang}e`
}
