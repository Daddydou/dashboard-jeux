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

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return buffer
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
  reset_heure: string
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
  reset_heure: '',
}

type NotifFormState = {
  notif_active: boolean
  notif_debut: string
  notif_fin: string
  notif_frequence: string
  notif_heure: string
}

const EMPTY_NOTIF_FORM: NotifFormState = {
  notif_active: false,
  notif_debut: '',
  notif_fin: '',
  notif_frequence: 'quotidien',
  notif_heure: '',
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

  // Feature B — coche "fait"
  const [doneMap, setDoneMap] = useState<Record<string, string | null>>({})

  // Feature C — notifications push
  const [notifModalGame, setNotifModalGame] = useState<Game | null>(null)
  const [notifForm, setNotifForm] = useState<NotifFormState>(EMPTY_NOTIF_FORM)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => { loadGames() }, [])

  // Service worker registration + push status check
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(console.error)
    if ('PushManager' in window) {
      setPushSupported(true)
      navigator.serviceWorker.ready
        .then(reg => reg.pushManager.getSubscription())
        .then(sub => setPushSubscribed(!!sub))
        .catch(() => {})
    }
  }, [])

  // Load statuses for games with source_type
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
    const [gamesRes, doneRes] = await Promise.all([
      supabase
        .from('dashboard_games')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('dashboard_done').select('game_id, done_at'),
    ])

    if (gamesRes.data) setGames(gamesRes.data as Game[])
    if (doneRes.data) {
      const map: Record<string, string | null> = {}
      for (const r of doneRes.data as { game_id: string; done_at: string }[]) {
        map[r.game_id] = r.done_at
      }
      setDoneMap(map)
    }
    setLoading(false)
  }

  // Feature B — is the checkbox "done" (respects reset_heure)
  function isActuallyDone(game: Game): boolean {
    const doneAt = doneMap[game.id]
    if (!doneAt) return false
    if (!game.reset_heure) return true
    const now = new Date()
    const [hh, mm] = game.reset_heure.split(':').map(Number)
    const todayReset = new Date(now)
    todayReset.setHours(hh, mm, 0, 0)
    // If today's reset time hasn't passed yet, use yesterday's reset time
    const lastReset = todayReset <= now
      ? todayReset
      : new Date(todayReset.getTime() - 86_400_000)
    return new Date(doneAt) > lastReset
  }

  async function handleCheck(game: Game, checked: boolean) {
    if (checked) {
      const doneAt = new Date().toISOString()
      setDoneMap(prev => ({ ...prev, [game.id]: doneAt }))
      await supabase
        .from('dashboard_done')
        .upsert({ game_id: game.id, done_at: doneAt }, { onConflict: 'game_id' })
    } else {
      setDoneMap(prev => ({ ...prev, [game.id]: null }))
      await supabase.from('dashboard_done').delete().eq('game_id', game.id)
    }
  }

  // Feature C — push subscribe
  async function handleSubscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) { alert('VAPID public key non configurée'); return }
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const subJson = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      })
      if (res.ok) setPushSubscribed(true)
    } catch (err) {
      console.error('Push subscribe error:', err)
    } finally {
      setPushLoading(false)
    }
  }

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
    const { data } = await supabase
      .from('dashboard_games')
      .update({
        notif_active: notifForm.notif_active,
        notif_debut: notifForm.notif_debut || null,
        notif_fin: notifForm.notif_fin || null,
        notif_frequence: notifForm.notif_frequence || null,
        notif_heure: notifForm.notif_heure || null,
      })
      .eq('id', notifModalGame.id)
      .select()
      .single()
    if (data) setGames(prev => prev.map(g => g.id === notifModalGame.id ? data as Game : g))
    setNotifModalGame(null)
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
      reset_heure: game.reset_heure ?? '',
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
          reset_heure: form.reset_heure || null,
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
          reset_heure: form.reset_heure || null,
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
        <div className="flex items-center gap-2">
          {/* Feature C — bouton push */}
          {pushSupported && (
            <button
              onClick={handleSubscribePush}
              disabled={pushSubscribed || pushLoading}
              title={pushSubscribed ? 'Notifications activées' : 'Activer les notifications push'}
              className={[
                'px-3 py-2 rounded-2xl text-sm font-medium transition-colors',
                pushSubscribed
                  ? 'bg-slate-800 text-amber-400 cursor-default'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300',
              ].join(' ')}
            >
              {pushLoading ? '…' : pushSubscribed ? '🔔 Activé' : '🔔 Notifs'}
            </button>
          )}
          <button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-2xl font-semibold text-sm"
          >
            + Ajouter
          </button>
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
                {grouped[cat].map(game => {
                  const domain = getDomain(game.url)
                  const status = statuses[game.id]
                  const notesExpanded = expandedNotes.has(game.id)
                  const done = isActuallyDone(game)

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
                          onClick={e => { e.stopPropagation(); openNotifModal(game) }}
                          title="Notifications"
                          className={[
                            'bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-xl text-sm transition-colors',
                            game.notif_active ? 'text-amber-400' : '',
                          ].join(' ')}
                        >
                          🔔
                        </button>
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
                          {game.emoji && (
                            <span className="text-2xl mt-0.5 leading-none flex-shrink-0">{game.emoji}</span>
                          )}
                          <div className="min-w-0 flex-1">
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

                      {/* Bas de carte : coche + statut + notes */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
                        {/* Feature B — checkbox "Fait" */}
                        <label
                          className="flex items-center gap-1.5 cursor-pointer select-none"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={e => handleCheck(game, e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-indigo-500"
                          />
                          <span className={`text-xs transition-colors ${done ? 'text-indigo-400' : 'text-slate-500'}`}>
                            {done ? 'Fait ✓' : 'Fait'}
                          </span>
                        </label>

                        {/* Badge statut dynamique */}
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

              {/* Feature B — heure de reset de la coche */}
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Heure de reset de la coche (HH:MM)</span>
                <input
                  type="time"
                  value={form.reset_heure}
                  onChange={e => setForm(f => ({ ...f, reset_heure: e.target.value }))}
                  placeholder="ex: 08:00"
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-600">Laisser vide = pas de reset automatique</span>
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

      {/* Feature C — Modale notifications par jeu */}
      {notifModalGame && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setNotifModalGame(null) }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-4">🔔 Notifications</h2>
            <p className="text-slate-400 text-sm mb-4 truncate">{notifModalGame.nom}</p>

            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-400">Activer</span>
                <input
                  type="checkbox"
                  checked={notifForm.notif_active}
                  onChange={e => setNotifForm(f => ({ ...f, notif_active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Heure d&apos;envoi</span>
                <input
                  type="time"
                  value={notifForm.notif_heure}
                  onChange={e => setNotifForm(f => ({ ...f, notif_heure: e.target.value }))}
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Fréquence</span>
                <select
                  value={notifForm.notif_frequence}
                  onChange={e => setNotifForm(f => ({ ...f, notif_frequence: e.target.value }))}
                  className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="quotidien">Quotidien</option>
                  <option value="hebdo">Hebdomadaire</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-slate-400">Début</span>
                  <input
                    type="date"
                    value={notifForm.notif_debut}
                    onChange={e => setNotifForm(f => ({ ...f, notif_debut: e.target.value }))}
                    className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-slate-400">Fin</span>
                  <input
                    type="date"
                    value={notifForm.notif_fin}
                    onChange={e => setNotifForm(f => ({ ...f, notif_fin: e.target.value }))}
                    className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNotifModalGame(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleNotifSave}
                  className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-xl font-semibold transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>
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

  const colorClass = status.state === 'warn'
    ? 'bg-orange-950 text-orange-400'
    : 'bg-green-950 text-green-400'

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {/* Label principal (ex: #2 · 18.5 pts ou libellé court) */}
      <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-full">
        {status.label}
      </span>
      {/* Sous-label optionnel (ex: ✅ À jour / ⚠️ Picks à faire) */}
      {status.sublabel && (
        <span className={`inline-flex items-center px-2 py-0.5 ${colorClass} text-xs font-medium rounded-full`}>
          {status.sublabel}
        </span>
      )}
    </span>
  )
}
