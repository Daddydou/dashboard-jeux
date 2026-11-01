import type { Game } from '@/lib/supabase'

export const COULEUR_PAR_DEFAUT = '#5B6B82'

function domaine(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** L'initiale du jeu (ou son emoji) sur un carré de sa couleur. */
export function Monogramme({ jeu, taille = 'grand' }: { jeu: Pick<Game, 'nom' | 'emoji' | 'couleur'>; taille?: 'grand' | 'petit' }) {
  return (
    <span
      aria-hidden="true"
      className={[
        'grid shrink-0 place-items-center font-display font-bold text-white',
        taille === 'grand' ? 'h-12 w-12 rounded-2xl text-2xl' : 'h-9 w-9 rounded-xl text-lg',
      ].join(' ')}
      style={{ background: jeu.couleur ?? COULEUR_PAR_DEFAUT, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
    >
      {jeu.emoji || jeu.nom.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/** Un jeu sans statut en direct : un raccourci, simple et rapide à viser. */
export default function Tuile({ jeu }: { jeu: Game }) {
  return (
    <a
      href={jeu.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[76px] items-center gap-3 rounded-2xl bg-tableau p-3.5 transition-colors hover:bg-releve active:bg-releve"
    >
      <Monogramme jeu={jeu} />
      <span className="min-w-0">
        <span className="block truncate font-display text-lg font-semibold leading-tight">{jeu.nom}</span>
        <span className="block truncate text-[13px] text-brume">{jeu.notes || domaine(jeu.url)}</span>
      </span>
    </a>
  )
}
