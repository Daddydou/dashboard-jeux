'use client'

import { useState } from 'react'
import type { Game } from '@/lib/supabase'
import { seDeconnecter } from './login/actions'
import GameCard from '@/components/GameCard'
import GameForm from '@/components/GameForm'
import PushButton from '@/components/PushButton'
import NotifModal, { EMPTY_NOTIF_FORM, type NotifFormState } from '@/components/NotifModal'
import { useJeux } from '@/hooks/useJeux'
import { useStatuts } from '@/hooks/useStatuts'
import { useModaleJeu } from '@/hooks/useModaleJeu'

export default function Home() {
  const jeux = useJeux()
  const { games, loading } = jeux
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const { statuses, oublierStatut } = useStatuts(games)
  const modaleJeu = useModaleJeu({ ...jeux, oublierStatut })

  // Feature C — notifications push
  const [notifModalGame, setNotifModalGame] = useState<Game | null>(null)
  const [notifForm, setNotifForm] = useState<NotifFormState>(EMPTY_NOTIF_FORM)

  function openNotifModal(game: Game) {
    setNotifModalGame(game)
    setNotifForm({
      notif_active: game.notif_active ?? false,
      notif_debut: game.notif_debut ?? '',
      notif_fin: game.notif_fin ?? '',
      notif_frequence: game.notif_frequence ?? 'quotidien',
      notif_heure: game.notif_heure ?? '',
    })
  }

  async function handleNotifSave() {
    if (!notifModalGame) return
    try {
      await jeux.enregistrerNotif(notifModalGame.id, notifForm)
    } catch (err) {
      jeux.surEchecEcriture(err)
    }
    setNotifModalGame(null)
  }

  function handleDelete(game: Game) {
    if (!confirm(`Supprimer "${game.nom}" ?`)) return
    jeux.supprimer(game)
  }

  function handleDrop(e: React.DragEvent, category: string, targetId: string) {
    e.preventDefault()
    const deId = draggedId
    setDraggedId(null)
    setDragOverId(null)
    if (!deId || deId === targetId) return
    jeux.deplacer(category, deId, targetId)
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
                    isDragged={draggedId === game.id}
                    isDragOver={dragOverId === game.id}
                    onDragStart={() => setDraggedId(game.id)}
                    onDragOver={() => setDragOverId(game.id)}
                    onDrop={e => handleDrop(e, cat, game.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
                    onNotif={() => openNotifModal(game)}
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
      {notifModalGame && (
        <NotifModal
          gameName={notifModalGame.nom}
          form={notifForm}
          setForm={setNotifForm}
          onSave={handleNotifSave}
          onClose={() => setNotifModalGame(null)}
        />
      )}
    </div>
  )
}
