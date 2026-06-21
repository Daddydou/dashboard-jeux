'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/supabase'
import type { GameStatus } from '@/lib/status/types'
import { fetchCdm26PicksStatus } from '@/lib/status/cdm26Picks'
import { fetchCdm26FantasyStatus } from '@/lib/status/cdm26Fantasy'

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  if (diff < 60_000) return rtf.format(-Math.floor(diff / 1_000), 'second')
  if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute')
  if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), 'hour')
  if (diff < 2_592_000_000) return rtf.format(-Math.floor(diff / 86_400_000), 'day')
  return rtf.format(-Math.floor(diff / 2_592_000_000), 'month')
}

function getDomain(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

async function loadStatus(sourceType: string): Promise<GameStatus> {
  if (sourceType === 'cdm26_picks') return fetchCdm26PicksStatus()
  if (sourceType === 'cdm26_fantasy') return fetchCdm26FantasyStatus()
  return { state: 'error' }
}

type FormState = {
  nom: string
  url: string
  description: string
  emoji: string
  categorie: string
  couleur: string
  notes: string
  source_type: string
}

const EMPTY_FORM: FormState = {
  nom: '',
  url: '',
  description: '',
  emoji: '',
  categorie: '',
  couleur: '#6366f1',
  notes: '',
  source_type: '',
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Record<string, GameStatus>>({})
  const statusFetched = useRef(new Set<string>())

  useEffect(() => { loadGames() }, [])

  // Charge les statuts pour les jeux avec source_type pas encore fetchés
  useEffect(() => {
    const todo = games.filter(g => g.source_type && !statusFetched.current.has(g.id))
    if (todo.length === 0) return

    todo.forEach(g => {
      statusFetched.current.add(g.id)
      setStatuses(prev => ({ ...prev, [g.id]: { state: 'loading' } }))
      loadStatus(g.source_type!).then(status => {
        setStatuses(prev => ({ ...prev, [g.id]: status }))
      }).catch(() => {
        setStatuses(prev => ({ ...prev, [g.id]: { state: 'error' } }))
      })
    })
  }, [games])

  async function loadGames() {
    const { data } = await supabase
      .from('dashboard_games')
      .select('*')
      .eq('actif', true)
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setGames(data as Game[])
    setLoading(false)
  }

  function openAdd() {
    setEditingGame(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(game: Game) {
    setEditingGame(game)
    setForm({
      nom: game.nom,
      url: game.url,
      description: game.description ?? '',
      emoji: game.emoji ?? '',
      categorie: game.categorie ?? '',
      couleur: game.couleur ?? '#6366f1',
      notes: game.notes ?? '',
      source_type: game.source_type ?? '',
    })
    setModalOpen(true)
  }

  async function handleDelete(game: Game) {
    if (!confirm(`Supprimer "${game.nom}" ?`)) return
    await supabase.from('dashboard_games').delete().eq('id', game.id)
    setGames(prev => prev.filter(g => g.id !== game.id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    if (editingGame) {
      // Si le source_type a changé, on invalide le statut mis en cache
      const prevSourceType = editingGame.source_type ?? ''
      const nextSourceType = form.source_type
      if (prevSourceType !== nextSourceType) {
        statusFetched.current.delete(editingGame.id)
        setStatuses(prev => {
          const next = { ...prev }
          delete next[editingGame.id]
          return next
        })
      }

      const { data } = await supabase
        .from('dashboard_games')
        .update({
          nom: form.nom,
          url: form.url,
          description: form.description || null,
          emoji: form.emoji || null,
          categorie: form.categorie || null,
          couleur: form.couleur || null,
          notes: form.notes || null,
          source_type: form.source_type || null,
        })
        .eq('id', editingGame.id)
        .select()
        .single()
      if (data) setGames(prev => prev.map(g => g.id === editingGame.id ? data as Game : g))
    } else {
      const maxOrdre = games.reduce((m, g) => Math.max(m, g.ordre ?? 0), 0)
      const { data } = await supabase
        .from('dashboard_games')
        .insert({
          nom: form.nom,
          url: form.url,
          description: form.description || null,
          emoji: form.emoji || null,
          categorie: form.categorie || null,
          couleur: form.couleur || null,
          notes: form.notes || null,
          source_type: form.source_type || null,
          ordre: maxOrdre + 1,
          actif: true,
        })
        .select()
        .single()
      if (data) setGames(prev => [...prev, data as Game])
    }

    setSubmitting(false)
    setModalOpen(false)
  }

  async function handleLinkClick(game: Game) {
    const now = new Date().toISOString()
    supabase.from('dashboard_games').update({ dernier_ouvert: now }).eq('id', game.id)
    setGames(prev => prev.map(g => g.id === game.id ? { ...g, dernier_ouvert: now } : g))
  }

  async function handleDrop(e: React.DragEvent, category: string, targetId: string) {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const catGames = games.filter(g => (g.categorie ?? 'Autres') === category)
    const fromIdx = catGames.findIndex(g => g.id === draggedId)
    const toIdx = catGames.findIndex(g => g.id === targetId)
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const reordered = [...catGames]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const updates = reordered.map((g, i) => ({ id: g.id, ordre: i + 1 }))
    setGames(prev =>
      prev.map(g => {
        const u = updates.find(u => u.id === g.id)
        return u ? { ...g, ordre: u.ordre } : g
      })
    )
    setDraggedId(null)
    setDragOverId(null)

    await Promise.all(
      updates.map(u => supabase.from('dashboard_games').update({ ordre: u.ordre }).eq('id', u.id))
    )
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
        <button
          onClick={openAdd}
          className="bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-2xl font-semibold text-sm"
        >
          + Ajouter
        </button>
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
                {grouped[cat].map(game => {
                  const domain = getDomain(game.url)
                  const status = statuses[game.id]
                  const notesExpanded = expandedNotes.has(game.id)

                  return (
                    <div
                      key={game.id}
                      draggable
                      onDragStart={() => setDraggedId(game.id)}
                      onDragOver={e => { e.preventDefault(); setDragOverId(game.id) }}
                      onDrop={e => handleDrop(e, cat, game.id)}
                      onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
                      className={[
                        'group relative bg-slate-900 rounded-2xl p-4 transition-all duration-150 cursor-grab active:cursor-grabbing',
                        dragOverId === game.id && draggedId !== game.id
                          ? 'ring-2 ring-indigo-400 scale-[1.02]'
                          : '',
                        draggedId === game.id ? 'opacity-40' : 'hover:bg-slate-800',
                      ].join(' ')}
                      style={{ boxShadow: `inset 4px 0 0 ${game.couleur ?? '#6366f1'}` }}
                    >
                      {/* Hover actions */}
                      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(game) }}
                          title="Éditer"
                          className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-xl text-sm transition-colors"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(game) }}
                          title="Supprimer"
                          className="bg-slate-700 hover:bg-red-700 px-2 py-1 rounded-xl text-sm transition-colors"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Zone cliquable principale */}
                      <a
                        href={game.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(game)}
                        className="block select-none"
                      >
                        <div className="flex items-start gap-3">
                          {/* Grand emoji */}
                          {game.emoji && (
                            <span className="text-2xl mt-0.5 leading-none flex-shrink-0">{game.emoji}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            {/* Nom + favicon inline */}
                            <div className="flex items-center gap-1.5 pr-14 mb-0.5">
                              {domain && (
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                  alt=""
                                  width={20}
                                  height={20}
                                  className="w-5 h-5 rounded-sm flex-shrink-0"
                                  onError={e => { e.currentTarget.style.display = 'none' }}
                                />
                              )}
                              <p className="font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                                {game.nom}
                              </p>
                            </div>
                            {game.description && (
                              <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">
                                {game.description}
                              </p>
                            )}
                            <p className="text-slate-600 text-xs mt-1.5 truncate">{game.url}</p>
                          </div>
                        </div>

                        {/* Dernier ouvert */}
                        {game.dernier_ouvert && (
                          <p className="text-slate-500 text-xs mt-2">
                            Ouvert {formatRelativeTime(game.dernier_ouvert)}
                          </p>
                        )}
                      </a>

                      {/* Statut dynamique + notes (hors du lien) */}
                      {(game.source_type || game.notes) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2">

                          {/* Badge statut */}
                          {game.source_type && (
                            <StatusBadge status={status} />
                          )}

                          {/* Bouton notes */}
                          {game.notes && (
                            <button
                              onClick={e => { e.stopPropagation(); toggleNotes(game.id) }}
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              📝
                              <span>{notesExpanded ? 'Masquer' : 'Notes'}</span>
                              <span className="text-[10px]">{notesExpanded ? '▲' : '▼'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Contenu des notes déplié */}
                      {game.notes && notesExpanded && (
                        <div className="mt-2 bg-slate-800/50 rounded-xl px-3 py-2">
                          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {game.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Modal ajout / édition */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-5">
              {editingGame ? 'Modifier' : 'Ajouter un jeu'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Nom *</span>
                <input
                  required
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">URL *</span>
                <input
                  type="url"
                  required
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Description</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-slate-400">Emoji</span>
                  <input
                    value={form.emoji}
                    placeholder="🎮"
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-slate-400">Catégorie</span>
                  <input
                    value={form.categorie}
                    placeholder="Jeux"
                    onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                    className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Couleur du liseré</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.couleur}
                    onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-slate-400 text-sm font-mono">{form.couleur}</span>
                </div>
              </label>

              {/* Feature 2 — Notes */}
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Notes / mémo</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  placeholder="Room code, identifiant, phase, infos utiles…"
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                />
              </label>

              {/* Feature 3 — Statut dynamique */}
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Statut dynamique</span>
                <select
                  value={form.source_type}
                  onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Aucun —</option>
                  <option value="cdm26_picks">CDM26 Picks</option>
                  <option value="cdm26_fantasy">CDM26 Fantasy</option>
                </select>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 rounded-xl font-semibold transition-colors"
                >
                  {submitting ? '…' : editingGame ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: GameStatus | undefined }) {
  if (!status || status.state === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse inline-block" />
        <span>chargement…</span>
      </span>
    )
  }
  if (status.state === 'error') {
    return <span className="text-xs text-slate-600">—</span>
  }
  if (status.state === 'warn') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 bg-orange-950 text-orange-400 text-xs font-medium rounded-full">
        {status.label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-green-950 text-green-400 text-xs font-medium rounded-full">
      {status.label}
    </span>
  )
}
