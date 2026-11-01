import 'server-only'
import { estSource } from '@/lib/live/types'
import type { ChampsJeu } from './types'

/**
 * Validation des arguments des Server Actions. Une action est un endpoint
 * POST public : le typage TypeScript n'existe pas à l'exécution, donc chaque
 * champ est revérifié ici avant d'écrire.
 */

export function id(v: unknown): string {
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v)) throw new Error('Identifiant invalide.')
  return v
}

function texte(v: unknown, max: number): string {
  if (typeof v !== 'string') throw new Error('Champ invalide.')
  if (v.length > max) throw new Error('Champ trop long.')
  return v.trim()
}

/** Chaîne vide → null. */
function optionnel(v: unknown, max: number): string | null {
  return texte(v, max) || null
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const COULEUR = /^#[0-9a-f]{6}$/i

export function champsJeu(f: ChampsJeu) {
  if (!f || typeof f !== 'object') throw new Error('Formulaire invalide.')

  const nom = texte(f.nom, 80)
  if (!nom) throw new Error('Donne un nom au jeu.')

  const url = texte(f.url, 2000)
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('Adresse invalide : elle doit commencer par https://')

  const couleur = optionnel(f.couleur, 7)
  if (couleur !== null && !COULEUR.test(couleur)) throw new Error('Couleur invalide.')

  const source = optionnel(f.source_type, 32)
  if (source !== null && !estSource(source)) throw new Error('Source inconnue.')

  if (typeof f.notif_active !== 'boolean') throw new Error('Formulaire invalide.')
  const heure = optionnel(f.notif_heure, 8)
  if (heure !== null && !HEURE.test(heure)) throw new Error('Heure du rappel invalide.')
  if (f.notif_active && !heure) throw new Error('Choisis l’heure du rappel.')

  const frequence = optionnel(f.notif_frequence, 16)
  if (frequence !== null && frequence !== 'quotidien' && frequence !== 'hebdo') throw new Error('Fréquence invalide.')

  const debut = optionnel(f.notif_debut, 10)
  const fin = optionnel(f.notif_fin, 10)
  if ((debut && !DATE.test(debut)) || (fin && !DATE.test(fin))) throw new Error('Date invalide.')
  if (debut && fin && fin < debut) throw new Error('La date de fin est avant la date de début.')

  return {
    nom,
    url,
    emoji: optionnel(f.emoji, 16),
    couleur,
    notes: optionnel(f.notes, 2000),
    source_type: source,
    notif_active: f.notif_active,
    notif_heure: heure,
    notif_frequence: f.notif_active ? (frequence ?? 'quotidien') : frequence,
    notif_debut: debut,
    notif_fin: fin,
  }
}
