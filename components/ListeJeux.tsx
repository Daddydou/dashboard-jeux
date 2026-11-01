'use client'

import { useState, useTransition } from 'react'
import { deplacerJeu } from '@/actions/jeux'
import type { Game } from '@/lib/supabase'
import FeuilleJeu from './FeuilleJeu'
import { IconeBas, IconeCrayon, IconeHaut, IconePlus } from './icones'
import { Monogramme } from './Tuile'

type Props = {
  jeux: Game[]
  sources: { id: string; libelle: string }[]
}

/** Mes jeux, dans l'ordre de l'accueil : modifier, monter, descendre, ajouter. */
export default function ListeJeux({ jeux, sources }: Props) {
  const [feuille, setFeuille] = useState<{ jeu: Game | null } | null>(null)
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  function deplacer(id: string, sens: 'haut' | 'bas') {
    demarrer(async () => {
      const r = await deplacerJeu(id, sens)
      setErreur(r.ok ? null : r.erreur)
    })
  }

  return (
    <div>
      {erreur && (
        <p role="alert" className="mb-3 rounded-xl bg-carton/15 px-3 py-2.5 text-sm text-carton">
          {erreur}
        </p>
      )}
      <ul className={['flex flex-col gap-2', enCours ? 'opacity-60' : ''].join(' ')}>
        {jeux.map((jeu, i) => (
          <li key={jeu.id} className="flex items-center gap-3 rounded-2xl bg-tableau py-2 pl-3 pr-1">
            <Monogramme jeu={jeu} taille="petit" />
            <button
              type="button"
              onClick={() => setFeuille({ jeu })}
              className="min-w-0 flex-1 py-1.5 text-left"
            >
              <span className="block truncate font-semibold">{jeu.nom}</span>
              <span className="block truncate text-sm text-brume">
                {jeu.source_type ? 'À la une' : 'Raccourci'}
                {jeu.notif_active && jeu.notif_heure ? ` · rappel ${jeu.notif_heure.slice(0, 5)}` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => deplacer(jeu.id, 'haut')}
              disabled={i === 0 || enCours}
              aria-label={`Monter ${jeu.nom}`}
              className="grid h-11 w-10 place-items-center text-craie disabled:text-brume/25"
            >
              <IconeHaut className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => deplacer(jeu.id, 'bas')}
              disabled={i === jeux.length - 1 || enCours}
              aria-label={`Descendre ${jeu.nom}`}
              className="grid h-11 w-10 place-items-center text-craie disabled:text-brume/25"
            >
              <IconeBas className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setFeuille({ jeu })}
              aria-label={`Modifier ${jeu.nom}`}
              className="grid h-11 w-11 place-items-center text-brume hover:text-craie"
            >
              <IconeCrayon className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setFeuille({ jeu: null })}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 font-semibold text-craie hover:bg-tableau"
      >
        <IconePlus className="h-5 w-5" />
        Ajouter un jeu
      </button>

      {feuille && (
        <FeuilleJeu
          key={feuille.jeu?.id ?? 'nouveau'}
          jeu={feuille.jeu}
          sources={sources}
          onFermer={() => setFeuille(null)}
        />
      )}
    </div>
  )
}
