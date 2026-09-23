import type { Dispatch, SetStateAction } from 'react'

export type FormState = {
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

export const EMPTY_FORM: FormState = {
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

type Props = {
  editing: boolean
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

/** Modale d'ajout / édition d'un jeu. L'état du formulaire vit dans la page. */
export default function GameForm({ editing, form, setForm, submitting, onSubmit, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-5">
          {editing ? 'Modifier' : 'Ajouter un jeu'}
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 rounded-xl font-semibold transition-colors"
            >
              {submitting ? '…' : editing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
