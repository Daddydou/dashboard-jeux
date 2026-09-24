'use client'

import { useEffect, useState } from 'react'
import type { Game } from '@/lib/supabase'
import { rechercher } from '@/lib/recherche'

type Props = {
  games: Game[]
  /** Appelé après l'ouverture de l'onglet (enregistre dernier_ouvert). */
  onOuvrir: (game: Game) => void
}

/**
 * Lanceur au clavier : Ctrl+K (⌘K sur Mac) ouvre une palette, on tape
 * quelques lettres, ↑/↓ pour choisir, Entrée pour ouvrir le jeu dans un
 * nouvel onglet, Échap pour fermer.
 */
export default function PaletteCommandes({ games, onOuvrir }: Props) {
  const [ouverte, setOuverte] = useState(false)
  const [requete, setRequete] = useState('')
  const [selection, setSelection] = useState(0)

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOuverte(o => !o)
        setRequete('')
        setSelection(0)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  if (!ouverte) return null

  const resultats = rechercher(games, requete).slice(0, 8)
  const choisi = Math.min(selection, Math.max(resultats.length - 1, 0))

  function fermer() {
    setOuverte(false)
  }

  function ouvrir(game: Game) {
    // Ouvert pendant l'événement clavier/souris : pas bloqué comme popup.
    window.open(game.url, '_blank', 'noopener,noreferrer')
    onOuvrir(game)
    fermer()
  }

  function surToucheListe(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      fermer()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelection(Math.min(choisi + 1, resultats.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelection(Math.max(choisi - 1, 0))
    } else if (e.key === 'Enter' && resultats[choisi]) {
      e.preventDefault()
      ouvrir(resultats[choisi])
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-[15vh]"
      onClick={e => { if (e.target === e.currentTarget) fermer() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ouvrir un jeu"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <input
          autoFocus
          value={requete}
          onChange={e => { setRequete(e.target.value); setSelection(0) }}
          onKeyDown={surToucheListe}
          placeholder="Ouvrir un jeu…"
          aria-label="Rechercher un jeu à ouvrir"
          aria-controls="palette-resultats"
          aria-activedescendant={resultats[choisi] ? `palette-${resultats[choisi].id}` : undefined}
          className="w-full bg-transparent border-b border-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <ul id="palette-resultats" role="listbox" className="max-h-80 overflow-y-auto py-1">
          {resultats.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">Aucun jeu ne correspond.</li>
          ) : (
            resultats.map((game, i) => (
              <li
                key={game.id}
                id={`palette-${game.id}`}
                role="option"
                aria-selected={i === choisi}
                onMouseEnter={() => setSelection(i)}
                onClick={() => ouvrir(game)}
                className={[
                  'flex items-center gap-3 px-4 py-2 cursor-pointer text-sm',
                  i === choisi ? 'bg-indigo-600 text-white' : 'text-slate-300',
                ].join(' ')}
              >
                <span className="w-5 text-center">{game.emoji ?? '🎮'}</span>
                <span className="flex-1 truncate font-medium">{game.nom}</span>
                {game.categorie && (
                  <span className={i === choisi ? 'text-indigo-200 text-xs' : 'text-slate-500 text-xs'}>
                    {game.categorie}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
          ↑ ↓ choisir · Entrée ouvrir · Échap fermer
        </p>
      </div>
    </div>
  )
}
