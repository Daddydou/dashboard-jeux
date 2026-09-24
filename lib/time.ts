/**
 * Heure de référence : Europe/Paris. Jamais l'heure du serveur (Vercel tourne
 * en UTC), ni celle du téléphone (qui peut être réglé sur un autre fuseau).
 *
 * Même principe que lib/time.ts de TVTFL : deux fonctions jumelles, utilisées
 * à l'identique par le cron (serveur) et par la page (navigateur) —
 * `maintenant()` dit QUAND on est, `partiesParis()` dit QUELLE HEURE il est à
 * Paris à cet instant. Aucun autre fichier ne recalcule l'heure de son côté.
 *
 * Module pur (ni Next ni Supabase) : importable partout.
 */

export const FUSEAU = 'Europe/Paris'

const MINUTES_PAR_JOUR = 24 * 60

const format = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * Maintenant, ou la date simulée DASHBOARD_FAKE_NOW (ISO 8601 avec fuseau,
 * ex. `2026-09-24T08:02:00+02:00`) pour tester les notifications à la main.
 * Ignorée en production Vercel. Variable serveur uniquement : dans le
 * navigateur, c'est toujours la vraie heure.
 */
export function maintenant(): Date {
  const simulee = process.env.DASHBOARD_FAKE_NOW
  if (simulee && process.env.VERCEL_ENV !== 'production') {
    const d = new Date(simulee)
    if (Number.isNaN(d.getTime())) throw new Error(`DASHBOARD_FAKE_NOW invalide : ${simulee}`)
    return d
  }
  return new Date()
}

/** Date (AAAA-MM-JJ) et minutes écoulées depuis minuit, à Paris, d'un instant. */
export function partiesParis(instant: Date): { date: string; minutes: number } {
  const p = Object.fromEntries(format.formatToParts(instant).map((x) => [x.type, x.value]))
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  }
}

/** « HH:MM » ou « HH:MM:SS » (colonne `time` de Postgres) → minutes depuis minuit. */
export function minutesDepuisMinuit(heure: string): number {
  const [hh, mm] = heure.split(':').map(Number)
  return hh * 60 + mm
}

/** Veille d'une date AAAA-MM-JJ (calcul calendaire pur, sans fuseau). */
function veille(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/**
 * Minutes écoulées (0 à 1439) depuis le dernier passage de `heure` à Paris.
 * Passe minuit sans accroc : à 00:03, un rappel de 23:58 est à 5 min.
 */
export function minutesDepuis(instant: Date, heure: string): number {
  const ecart = partiesParis(instant).minutes - minutesDepuisMinuit(heure)
  return (ecart + MINUTES_PAR_JOUR) % MINUTES_PAR_JOUR
}

/**
 * Jour « de cycle » d'un instant pour une heure de bascule : la date à Paris,
 * ou la veille si l'heure de bascule n'est pas encore passée ce jour-là.
 * Deux instants ont le même jour de cycle s'ils tombent entre les deux mêmes
 * bascules — changements d'heure compris, puisqu'on raisonne en heure murale.
 */
export function jourDeCycle(instant: Date, heureBascule: string): string {
  const { date, minutes } = partiesParis(instant)
  return minutes >= minutesDepuisMinuit(heureBascule) ? date : veille(date)
}

const formatCourt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** « jeu. 25/09 01:00 » : jour et heure d'un instant, à Paris. */
export function formatParis(instant: Date): string {
  return formatCourt.format(instant).replace(',', '')
}
