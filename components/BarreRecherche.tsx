type Props = {
  valeur: string
  onChange: (valeur: string) => void
  nbAffiches: number
  nbTotal: number
}

/** Filtre global des cartes affichées (nom, catégorie, description, notes, domaine). */
export default function BarreRecherche({ valeur, onChange, nbAffiches, nbTotal }: Props) {
  return (
    <div className="max-w-6xl mx-auto mb-8 flex items-center gap-3">
      <input
        type="search"
        value={valeur}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onChange('') }}
        placeholder="Filtrer les jeux…"
        aria-label="Filtrer les jeux"
        className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
      />
      {valeur ? (
        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap" aria-live="polite">
          {nbAffiches} / {nbTotal}
        </span>
      ) : (
        <kbd className="hidden sm:inline text-xs text-slate-500 border border-slate-700 rounded-md px-1.5 py-0.5 whitespace-nowrap">
          Ctrl K
        </kbd>
      )}
    </div>
  )
}
