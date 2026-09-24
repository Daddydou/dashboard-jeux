import 'server-only'

/**
 * Santé d'un dépôt GitHub, lue via l'API REST : version de Next.js
 * (package.json), date du dernier push, présence de CLAUDE.md et README.md.
 *
 * GITHUB_TOKEN (facultatif, serveur uniquement) : jeton en lecture seule,
 * nécessaire pour les dépôts privés et pour dépasser 60 requêtes/h. Sans
 * lui, seuls les dépôts publics répondent.
 *
 * 3 requêtes par dépôt, mises en cache 1 h par Next.
 */

export type SanteDepot = {
  depot: string
  /** Version déclarée de `next` (ex. "16.3.6", "^14.2.0"), null si pas de Next. */
  next: string | null
  /** Date ISO du dernier push sur le dépôt. */
  derniereMaj: string | null
  claudeMd: boolean
  readme: boolean
  erreur?: string
}

/** Format accepté pour la colonne `depot` : « propriétaire/dépôt ». */
export const FORMAT_DEPOT = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

const API = 'https://api.github.com'
const CACHE_SECONDES = 3600

async function lireJson(chemin: string): Promise<{ statut: number; corps: unknown }> {
  const entetes: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const jeton = process.env.GITHUB_TOKEN
  if (jeton) entetes.Authorization = `Bearer ${jeton}`

  const res = await fetch(`${API}${chemin}`, { headers: entetes, next: { revalidate: CACHE_SECONDES } })
  return { statut: res.status, corps: res.ok ? await res.json() : null }
}

function messageErreur(statut: number): string {
  if (statut === 404) {
    return process.env.GITHUB_TOKEN ? 'Dépôt introuvable.' : 'Introuvable ou privé (GITHUB_TOKEN absent).'
  }
  if (statut === 401) return 'GITHUB_TOKEN refusé.'
  if (statut === 403 || statut === 429) return 'Quota GitHub dépassé, réessayer plus tard.'
  return `Erreur GitHub (${statut}).`
}

export async function lireSanteDepot(depot: string): Promise<SanteDepot> {
  const vide: SanteDepot = { depot, next: null, derniereMaj: null, claudeMd: false, readme: false }
  if (!FORMAT_DEPOT.test(depot)) return { ...vide, erreur: 'Format attendu : propriétaire/dépôt.' }

  try {
    const [repo, racine] = await Promise.all([lireJson(`/repos/${depot}`), lireJson(`/repos/${depot}/contents/`)])
    if (repo.statut !== 200) return { ...vide, erreur: messageErreur(repo.statut) }

    const derniereMaj = (repo.corps as { pushed_at?: string }).pushed_at ?? null
    const noms = Array.isArray(racine.corps)
      ? (racine.corps as { name: string }[]).map(f => f.name.toLowerCase())
      : []

    let next: string | null = null
    if (noms.includes('package.json')) {
      const pkg = await lireJson(`/repos/${depot}/contents/package.json`)
      const contenu = (pkg.corps as { content?: string } | null)?.content
      if (contenu) {
        const json = JSON.parse(Buffer.from(contenu, 'base64').toString('utf8')) as {
          dependencies?: Record<string, string>
          devDependencies?: Record<string, string>
        }
        next = json.dependencies?.next ?? json.devDependencies?.next ?? null
      }
    }

    return {
      depot,
      next,
      derniereMaj,
      claudeMd: noms.includes('claude.md'),
      readme: noms.includes('readme.md'),
    }
  } catch {
    return { ...vide, erreur: 'GitHub injoignable.' }
  }
}
