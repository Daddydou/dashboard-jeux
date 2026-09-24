import type { Game } from '@/lib/supabase'

/**
 * Recherche dans les jeux, partagée par la barre de filtre et le lanceur
 * Ctrl+K. Insensible à la casse et aux accents (« echecs » trouve
 * « Échecs »). Module pur : importable partout.
 */

/** Minuscules, sans accents ni espaces superflus. */
export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** Tout le texte cherchable d'un jeu : nom, catégorie, description, notes et domaine. */
function texteCherchable(game: Game): string {
  let domaine = ''
  try {
    domaine = new URL(game.url).hostname
  } catch {
    // URL invalide : on cherche sans le domaine.
  }
  return normaliser([game.nom, game.categorie, game.description, game.notes, domaine].filter(Boolean).join(' '))
}

/** Vrai si chaque mot de la requête apparaît quelque part dans le jeu. Requête vide : tout correspond. */
export function correspond(game: Game, requete: string): boolean {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean)
  if (mots.length === 0) return true
  const texte = texteCherchable(game)
  return mots.every(mot => texte.includes(mot))
}

/**
 * Jeux qui correspondent, les plus pertinents d'abord : nom qui commence par
 * la requête, puis nom qui la contient, puis le reste (ordre d'origine
 * conservé à pertinence égale).
 */
export function rechercher(games: Game[], requete: string): Game[] {
  const q = normaliser(requete)
  const score = (g: Game) => {
    const nom = normaliser(g.nom)
    if (!q) return 0
    if (nom.startsWith(q)) return 0
    if (nom.includes(q)) return 1
    return 2
  }
  return games
    .filter(g => correspond(g, requete))
    .map((g, i) => ({ g, i, s: score(g) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(x => x.g)
}
