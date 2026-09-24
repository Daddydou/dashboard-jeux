'use server'

import { exigerSession } from '@/auth/garde'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Game } from '@/lib/supabase'
import { FORMAT_DEPOT, lireSanteDepot, type SanteDepot } from '@/lib/github'

/**
 * Toutes les écritures du dashboard. Une Server Action est un endpoint POST
 * public : chacune vérifie la session PUIS valide ses arguments (le typage
 * TypeScript n'existe pas à l'exécution), avant d'écrire avec la clé
 * service-role.
 */

export type ChampsJeu = {
  nom: string
  url: string
  description: string
  emoji: string
  categorie: string
  couleur: string
  notes: string
  source_type: string
  reset_heure: string
  depot: string
}

export type ChampsNotif = {
  notif_active: boolean
  notif_debut: string
  notif_fin: string
  notif_frequence: string
  notif_heure: string
}

// --- Validation ------------------------------------------------------------

function id(v: unknown): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 64) throw new Error('Identifiant invalide.')
  return v
}

function texte(v: unknown, max = 2000): string {
  if (typeof v !== 'string') throw new Error('Champ invalide.')
  if (v.length > max) throw new Error('Champ trop long.')
  return v.trim()
}

/** Chaîne vide → null, comme le faisait le client. */
function optionnel(v: unknown, max?: number): string | null {
  return texte(v, max) || null
}

function obligatoire(v: unknown, nomChamp: string, max?: number): string {
  const s = texte(v, max)
  if (!s) throw new Error(`${nomChamp} requis.`)
  return s
}

function champsJeu(f: ChampsJeu) {
  if (!f || typeof f !== 'object') throw new Error('Formulaire invalide.')
  const url = obligatoire(f.url, 'URL')
  if (!/^https?:\/\//i.test(url)) throw new Error('URL invalide (http/https).')
  // `?? ''` : un onglet resté ouvert sur l'ancienne version n'envoie pas ce champ.
  const depot = optionnel(f.depot ?? '', 200)
  if (depot !== null && !FORMAT_DEPOT.test(depot)) throw new Error('Dépôt GitHub invalide (propriétaire/dépôt).')
  return {
    nom: obligatoire(f.nom, 'Nom', 200),
    url,
    description: optionnel(f.description),
    emoji: optionnel(f.emoji, 32),
    categorie: optionnel(f.categorie, 100),
    couleur: optionnel(f.couleur, 32),
    notes: optionnel(f.notes, 10_000),
    source_type: optionnel(f.source_type, 64),
    reset_heure: optionnel(f.reset_heure, 8),
    depot,
  }
}

// --- dashboard_games -------------------------------------------------------

export async function creerJeu(f: ChampsJeu): Promise<Game> {
  await exigerSession()
  const db = supabaseAdmin()

  // L'ordre est calculé côté serveur : le client n'a pas à le fournir.
  const { data: dernier } = await db
    .from('dashboard_games')
    .select('ordre')
    .eq('actif', true)
    .order('ordre', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await db
    .from('dashboard_games')
    .insert({ ...champsJeu(f), ordre: (dernier?.ordre ?? 0) + 1, actif: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Game
}

export async function modifierJeu(gameId: string, f: ChampsJeu): Promise<Game> {
  await exigerSession()
  const { data, error } = await supabaseAdmin()
    .from('dashboard_games')
    .update(champsJeu(f))
    .eq('id', id(gameId))
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Game
}

export async function supprimerJeu(gameId: string): Promise<void> {
  await exigerSession()
  const { error } = await supabaseAdmin().from('dashboard_games').delete().eq('id', id(gameId))
  if (error) throw new Error(error.message)
}

export async function enregistrerNotif(gameId: string, n: ChampsNotif): Promise<Game> {
  await exigerSession()
  if (!n || typeof n !== 'object' || typeof n.notif_active !== 'boolean') {
    throw new Error('Formulaire invalide.')
  }
  const frequence = optionnel(n.notif_frequence, 16)
  if (frequence !== null && frequence !== 'quotidien' && frequence !== 'hebdo') {
    throw new Error('Fréquence invalide.')
  }
  const { data, error } = await supabaseAdmin()
    .from('dashboard_games')
    .update({
      notif_active: n.notif_active,
      notif_debut: optionnel(n.notif_debut, 10),
      notif_fin: optionnel(n.notif_fin, 10),
      notif_frequence: frequence,
      notif_heure: optionnel(n.notif_heure, 8),
    })
    .eq('id', id(gameId))
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Game
}

/**
 * Horodatage serveur, renvoyé au client pour qu'il affiche la même valeur.
 * Met à jour `dernier_ouvert` ET ajoute une ligne à l'historique des
 * ouvertures (stats d'usage).
 */
export async function marquerOuvert(gameId: string): Promise<string> {
  await exigerSession()
  const maintenant = new Date().toISOString()
  const gid = id(gameId)
  const db = supabaseAdmin()
  const [maj, historique] = await Promise.all([
    db.from('dashboard_games').update({ dernier_ouvert: maintenant }).eq('id', gid),
    db.from('dashboard_ouvertures').insert({ game_id: gid, opened_at: maintenant }),
  ])
  const erreur = maj.error ?? historique.error
  if (erreur) throw new Error(erreur.message)
  return maintenant
}

export async function reordonner(ordres: { id: string; ordre: number }[]): Promise<void> {
  await exigerSession()
  if (!Array.isArray(ordres) || ordres.length > 500) throw new Error('Liste invalide.')
  const propres = ordres.map((o) => {
    if (!o || !Number.isInteger(o.ordre) || o.ordre < 0) throw new Error('Ordre invalide.')
    return { id: id(o.id), ordre: o.ordre }
  })
  const db = supabaseAdmin()
  const resultats = await Promise.all(
    propres.map((o) => db.from('dashboard_games').update({ ordre: o.ordre }).eq('id', o.id)),
  )
  const echec = resultats.find((r) => r.error)
  if (echec?.error) throw new Error(echec.error.message)
}

// --- dashboard_done --------------------------------------------------------

/** Coche/décoche. Renvoie le `done_at` enregistré (null si décoché). */
export async function basculerFait(gameId: string, fait: boolean): Promise<string | null> {
  await exigerSession()
  if (typeof fait !== 'boolean') throw new Error('Valeur invalide.')
  const db = supabaseAdmin()
  const gid = id(gameId)

  if (!fait) {
    const { error } = await db.from('dashboard_done').delete().eq('game_id', gid)
    if (error) throw new Error(error.message)
    return null
  }

  const doneAt = new Date().toISOString()
  const { error } = await db
    .from('dashboard_done')
    .upsert({ game_id: gid, done_at: doneAt }, { onConflict: 'game_id' })
  if (error) throw new Error(error.message)
  return doneAt
}

// --- Santé du portfolio (lecture) -------------------------------------------

export type SanteJeu = { gameId: string; nom: string; sante: SanteDepot | null }

/**
 * Santé du dépôt GitHub de chaque jeu actif (`sante: null` : pas de dépôt,
 * site externe). Server Action pour garder GITHUB_TOKEN côté serveur ;
 * session exigée car elle révèle des infos de dépôts privés.
 */
export async function lireSantePortfolio(): Promise<SanteJeu[]> {
  await exigerSession()
  const { data, error } = await supabaseAdmin()
    .from('dashboard_games')
    .select('id, nom, depot')
    .eq('actif', true)
    .order('ordre', { ascending: true })
  if (error) throw new Error(error.message)

  const jeux = data as { id: string; nom: string; depot: string | null }[]
  return Promise.all(
    jeux.map(async j => ({
      gameId: j.id,
      nom: j.nom,
      sante: j.depot ? await lireSanteDepot(j.depot) : null,
    })),
  )
}
