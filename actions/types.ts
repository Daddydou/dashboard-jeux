/** Types partagés entre le formulaire (navigateur) et les Server Actions. */

export type ChampsJeu = {
  nom: string
  url: string
  emoji: string
  couleur: string
  notes: string
  /** '' (aucune), 'gametracker', 'optipick' ou 'ttfl' : le jeu passe « à la une ». */
  source_type: string
  notif_active: boolean
  notif_heure: string
  notif_frequence: string
  notif_debut: string
  notif_fin: string
}

/** Une action ne lève pas : elle dit si ça a marché, et sinon pourquoi. */
export type ResultatAction = { ok: true } | { ok: false; erreur: string }
