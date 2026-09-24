import type { Dispatch, SetStateAction } from 'react'
import type { Game } from '@/lib/supabase'

export type NotifFormState = {
  notif_active: boolean
  notif_debut: string
  notif_fin: string
  notif_frequence: string
  notif_heure: string
}

export const EMPTY_NOTIF_FORM: NotifFormState = {
  notif_active: false,
  notif_debut: '',
  notif_fin: '',
  notif_frequence: 'quotidien',
  notif_heure: '',
}

/** Réglages pré-remplis avec ceux d'un jeu. */
export function jeuVersNotif(game: Game): NotifFormState {
  return {
    notif_active: game.notif_active ?? false,
    notif_debut: game.notif_debut ?? '',
    notif_fin: game.notif_fin ?? '',
    notif_frequence: game.notif_frequence ?? 'quotidien',
    notif_heure: game.notif_heure ?? '',
  }
}

type Props = {
  gameName: string
  form: NotifFormState
  setForm: Dispatch<SetStateAction<NotifFormState>>
  onSave: () => void
  onClose: () => void
}

/** Feature C — modale de réglage des notifications d'un jeu. */
export default function NotifModal({ gameName, form, setForm, onSave, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold mb-4">🔔 Notifications</h2>
        <p className="text-slate-400 text-sm mb-4 truncate">{gameName}</p>

        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-slate-400">Activer</span>
            <input
              type="checkbox"
              checked={form.notif_active}
              onChange={e => setForm(f => ({ ...f, notif_active: e.target.checked }))}
              className="w-4 h-4 rounded accent-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Heure d&apos;envoi</span>
            <input
              type="time"
              value={form.notif_heure}
              onChange={e => setForm(f => ({ ...f, notif_heure: e.target.value }))}
              className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Fréquence</span>
            <select
              value={form.notif_frequence}
              onChange={e => setForm(f => ({ ...f, notif_frequence: e.target.value }))}
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
                value={form.notif_debut}
                onChange={e => setForm(f => ({ ...f, notif_debut: e.target.value }))}
                className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-400">Fin</span>
              <input
                type="date"
                value={form.notif_fin}
                onChange={e => setForm(f => ({ ...f, notif_fin: e.target.value }))}
                className="bg-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onSave}
              className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-xl font-semibold transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
