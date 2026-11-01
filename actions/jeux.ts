'use server'

import { revalidatePath } from 'next/cache'
import { exigerSession } from '@/auth/garde'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { champsJeu, id } from './validation'
import type { ChampsJeu, ResultatAction } from './types'

/**
 * Toutes les écritures du dashboard. Chaque action : session exigée d'abord,
 * arguments validés ensuite, écriture avec la clé service-role en dernier.
 * Aucune ne lève : elle renvoie { ok, erreur } pour que l'écran affiche un
 * message clair (en production, le message d'une exception d'action est masqué).
 */

async function proteger(travail: () => Promise<void>): Promise<ResultatAction> {
  try {
    await travail()
    return { ok: true }
  } catch (err) {
    console.error('Action refusée :', err)
    const message = err instanceof Error ? err.message : 'Erreur inconnue.'
    return { ok: false, erreur: message === 'Non authentifié.' ? 'Session expirée : reconnecte-toi.' : message }
  }
}

function rafraichir() {
  revalidatePath('/')
  revalidatePath('/reglages')
}

/** Création (gameId null) ou modification d'un jeu. */
export async function sauvegarderJeu(gameId: string | null, champs: ChampsJeu): Promise<ResultatAction> {
  return proteger(async () => {
    await exigerSession()
    const valeurs = champsJeu(champs)
    const db = supabaseAdmin()

    if (gameId === null) {
      const { data: dernier } = await db
        .from('dashboard_games')
        .select('ordre')
        .eq('actif', true)
        .order('ordre', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { error } = await db
        .from('dashboard_games')
        .insert({ ...valeurs, ordre: (dernier?.ordre ?? 0) + 1, actif: true })
      if (error) throw new Error(error.message)
    } else {
      const { error } = await db.from('dashboard_games').update(valeurs).eq('id', id(gameId))
      if (error) throw new Error(error.message)
    }
    rafraichir()
  })
}

/**
 * Retire un jeu du dashboard. Il est seulement désactivé (`actif = false`) :
 * rien n'est effacé, il peut revenir.
 */
export async function retirerJeu(gameId: string): Promise<ResultatAction> {
  return proteger(async () => {
    await exigerSession()
    const { error } = await supabaseAdmin()
      .from('dashboard_games')
      .update({ actif: false, notif_active: false })
      .eq('id', id(gameId))
    if (error) throw new Error(error.message)
    rafraichir()
  })
}

/** Échange la place d'un jeu avec son voisin du dessus ou du dessous. */
export async function deplacerJeu(gameId: string, sens: 'haut' | 'bas'): Promise<ResultatAction> {
  return proteger(async () => {
    await exigerSession()
    if (sens !== 'haut' && sens !== 'bas') throw new Error('Sens invalide.')
    const db = supabaseAdmin()
    const { data, error } = await db
      .from('dashboard_games')
      .select('id, ordre')
      .eq('actif', true)
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)

    const liste = data as { id: string; ordre: number }[]
    const i = liste.findIndex(j => j.id === id(gameId))
    const k = sens === 'haut' ? i - 1 : i + 1
    if (i === -1 || k < 0 || k >= liste.length) return

    // Renumérote toute la liste (1, 2, 3…) dans le nouvel ordre : plus
    // jamais d'ex æquo hérité des anciennes versions.
    const ordre = [...liste]
    ;[ordre[i], ordre[k]] = [ordre[k], ordre[i]]
    const resultats = await Promise.all(
      ordre.map((j, n) => (j.ordre === n + 1 ? null : db.from('dashboard_games').update({ ordre: n + 1 }).eq('id', j.id))),
    )
    const echec = resultats.find(r => r?.error)
    if (echec?.error) throw new Error(echec.error.message)
    rafraichir()
  })
}
