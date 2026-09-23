'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/supabase'
import type { GameStatus } from '@/lib/status/types'
import { fetchCdm26PicksStatus } from '@/lib/status/cdm26Picks'
import { fetchCdm26FantasyStatus } from '@/lib/status/cdm26Fantasy'
import {
  basculerFait,
  creerJeu,
  enregistrerNotif,
  marquerOuvert,
  modifierJeu,
  reordonner,
  supprimerJeu,
} from './actions'
import { seDeconnecter } from './login/actions'
import GameCard from '@/components/GameCard'
import GameForm, { EMPTY_FORM, type FormState } from '@/components/GameForm'
import NotifModal, { EMPTY_NOTIF_FORM, type NotifFormState } from '@/components/NotifModal'

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

  // Écriture refusée (session expirée, erreur réseau…) : on prévient et on
  // resynchronise l'affichage optimiste avec la base.
  function surEchecEcriture(err: unknown) {
    console.error('Écriture refusée :', err)
    alert('Enregistrement impossible (session expirée ?). Rechargement des données.')
    loadGames()
  }

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
    setDoneMap(prev => ({ ...prev, [game.id]: checked ? new Date().toISOString() : null }))
    try {
      const doneAt = await basculerFait(game.id, checked)
      setDoneMap(prev => ({ ...prev, [game.id]: doneAt }))
    } catch (err) {
      surEchecEcriture(err)
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
    try {
      const data = await enregistrerNotif(notifModalGame.id, notifForm)
      setGames(prev => prev.map(g => g.id === notifModalGame.id ? data : g))
    } catch (err) {
      surEchecEcriture(err)
    }
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
    try {
      await supprimerJeu(game.id)
      setGames(prev => prev.filter(g => g.id !== game.id))
    } catch (err) {
      surEchecEcriture(err)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
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
  
        const data = await modifierJeu(editingGame.id, form)
        setGames(prev => prev.map(g => g.id === editingGame.id ? data : g))
      } else {
        const data = await creerJeu(form)
        setGames(prev => [...prev, data])
      }
    } catch (err) {
      setSubmitting(false)
      surEchecEcriture(err)
      return
    }

    setSubmitting(false)
    setModalOpen(false)
  }

  async function handleLinkClick(game: Game) {
    const now = new Date().toISOString()
    setGames(prev => prev.map(g => g.id === game.id ? { ...g, dernier_ouvert: now } : g))
    // Pas d'alerte ici : l'utilisateur vient de quitter l'onglet pour le jeu.
    marquerOuvert(game.id).catch(err => console.error('dernier_ouvert non enregistré :', err))
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

    try {
      await reordonner(updates)
    } catch (err) {
      surEchecEcriture(err)
    }
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
                    done={isActuallyDone(game)}
                    notesExpanded={expandedNotes.has(game.id)}
                    isDragged={draggedId === game.id}
                    isDragOver={dragOverId === game.id}
                    onDragStart={() => setDraggedId(game.id)}
                    onDragOver={() => setDragOverId(game.id)}
                    onDrop={e => handleDrop(e, cat, game.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
                    onNotif={() => openNotifModal(game)}
                    onEdit={() => openEdit(game)}
                    onDelete={() => handleDelete(game)}
                    onOpen={() => handleLinkClick(game)}
                    onCheck={checked => handleCheck(game, checked)}
                    onToggleNotes={() => toggleNotes(game.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Modal ajout / édition */}
      {modalOpen && (
        <GameForm
          editing={editingGame !== null}
          form={form}
          setForm={setForm}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={() => setModalOpen(false)}
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
