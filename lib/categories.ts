import type { Game } from '@/lib/supabase'

/** Catégorie d'affichage d'un jeu : « Autres » s'il n'en a pas. */
export const AUTRES = 'Autres'

export function categorieDe(game: Game): string {
  return game.categorie ?? AUTRES
}

/**
 * Jeux regroupés par catégorie, dans leur ordre d'origine. Catégories triées
 * par ordre alphabétique français, « Autres » toujours en dernier.
 */
export function grouperParCategorie(games: Game[]): { categories: string[]; parCategorie: Record<string, Game[]> } {
  const parCategorie: Record<string, Game[]> = {}
  for (const g of games) {
    (parCategorie[categorieDe(g)] ??= []).push(g)
  }
  const categories = Object.keys(parCategorie).sort((a, b) => {
    if (a === AUTRES) return 1
    if (b === AUTRES) return -1
    return a.localeCompare(b, 'fr')
  })
  return { categories, parCategorie }
}
