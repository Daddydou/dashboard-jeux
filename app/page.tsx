'use client'

import { useState } from 'react'
import type { Game } from '@/lib/supabase'
import { seDeconnecter } from './login/actions'
import GameCard from '@/components/GameCard'
import GameForm from '@/components/GameForm'
import PushButton from '@/components/PushButton'
import NotifModal from '@/components/NotifModal'
import { useJeux } from '@/hooks/useJeux'
import { useStatuts } from '@/hooks/useStatuts'
import { useModaleJeu } from '@/hooks/useModaleJeu'
import { useModaleNotif } from '@/hooks/useModaleNotif'
import { useGlisserDeposer } from '@/hooks/useGlisserDeposer'

export default function Home() {
  const jeux = useJeux()
  const { games, loading } = jeux
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const { statuses, oublierStatut } = useStatuts(games)
  const modaleJeu = useModaleJeu({ ...jeux, oublierStatut })
  const modaleNotif = useModaleNotif(jeux)
  const glisser = useGlisserDeposer(jeux.deplacer)

  function handleDelete(game: Game) {
    if (!confirm(`Supprimer "${game.nom}" ?`)) return
    jeux.supprimer(game)
  }

  function toggleNotes(gameId: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  const grouped: Record<string, Game[]> = {}
  for (const g of games) {
    const cat = g.categorie ?? 'Autres'
    ;(grouped[cat] ??= []).push(g)
  }
  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Autres') return 1
    if (b === 'Autres') return -1
    return a.localeCompare(b, 'fr')
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <header className="flex items-center justify-between mb-10 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">🎲 Mes jeux</h1>
        <div className="flex items-center gap-2">
          {/* Feature C — bouton push */}
          <PushButton />
          <button
            onClick={modaleJeu.ouvrirAjout}
            className="bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-2xl font-semibold text-sm"
          >
            + Ajouter
          </button>
          <form action={seDeconnecter}>
            <button
              type="submit"
              title="Se déconnecter"
              className="bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-2 rounded-2xl text-sm text-slate-300"
            >
              ⎋
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {loading ? (
          <p className="text-slate-400 text-center py-20">Chargement…</p>
        ) : games.length === 0 ? (
          <p className="text-slate-400 text-center py-20">
            Aucun jeu — clique sur + Ajouter !
          </p>
        ) : (
          categories.map(cat => (
            <section key={cat} className="mb-10">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
                {cat}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[cat].map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    status={statuses[game.id]}
                    done={jeux.estFait(game)}
                    notesExpanded={expandedNotes.has(game.id)}
                    {...glisser.propsCarte(game.id, cat)}
                    onNotif={() => modaleNotif.ouvrir(game)}
                    onEdit={() => modaleJeu.ouvrirEdition(game)}
                    onDelete={() => handleDelete(game)}
                    onOpen={() => jeux.marquerOuvert(game)}
                    onCheck={checked => jeux.basculerFait(game, checked)}
                    onToggleNotes={() => toggleNotes(game.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Modal ajout / édition */}
      {modaleJeu.modalOpen && (
        <GameForm
          editing={modaleJeu.editing}
          form={modaleJeu.form}
          setForm={modaleJeu.setForm}
          submitting={modaleJeu.submitting}
          onSubmit={modaleJeu.enregistrer}
          onClose={modaleJeu.fermer}
        />
      )}

      {/* Feature C — Modale notifications par jeu */}
      {modaleNotif.jeu && (
        <NotifModal
          gameName={modaleNotif.jeu.nom}
          form={modaleNotif.form}
          setForm={modaleNotif.setForm}
          onSave={modaleNotif.enregistrer}
          onClose={modaleNotif.fermer}
        />
      )}
    </div>
  )
}
