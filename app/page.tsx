'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/supabase'

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  if (diff < 60_000) return rtf.format(-Math.floor(diff / 1_000), 'second')
  if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute')
  if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), 'hour')
  if (diff < 2_592_000_000) return rtf.format(-Math.floor(diff / 86_400_000), 'day')
  return rtf.format(-Math.floor(diff / 2_592_000_000), 'month')
}

type FormState = {
  nom: string
  url: string
  description: string
  emoji: string
  categorie: string
  couleur: string
}

const EMPTY_FORM: FormState = {
  nom: '',
  url: '',
  description: '',
  emoji: '',
  categorie: '',
  couleur: '#6366f1',
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

  useEffect(() => { loadGames() }, [])

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
      const { data } = await supabase
        .from('dashboard_games')
        .update({
          nom: form.nom,
          url: form.url,
          description: form.description || null,
          emoji: form.emoji || null,
          categorie: form.categorie || null,
          couleur: form.couleur || null,
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
                {grouped[cat].map(game => (
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

                    <a
                      href={game.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick(game)}
                      className="block select-none"
                    >
                      <div className="flex items-start gap-3">
                        {game.emoji && (
                          <span className="text-2xl mt-0.5 leading-none">{game.emoji}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-100 truncate pr-14 group-hover:text-indigo-300 transition-colors">
                            {game.nom}
                          </p>
                          {game.description && (
                            <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                              {game.description}
                            </p>
                          )}
                          <p className="text-slate-600 text-xs mt-2 truncate">{game.url}</p>
                        </div>
                      </div>
                      {game.dernier_ouvert && (
                        <p className="text-slate-500 text-xs mt-3">
                          Ouvert {formatRelativeTime(game.dernier_ouvert)}
                        </p>
                      )}
                    </a>
                  </div>
                ))}
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
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
