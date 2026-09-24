import type { Game } from '@/lib/supabase'
import type { GameStatus } from '@/lib/status/types'
import StatusBadge from '@/components/StatusBadge'

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

type Props = {
  game: Game
  status: GameStatus | undefined
  done: boolean
  notesExpanded: boolean
  isDragged: boolean
  isDragOver: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onNotif: () => void
  onEdit: () => void
  onDelete: () => void
  onOpen: () => void
  onCheck: (checked: boolean) => void
  onToggleNotes: () => void
}

/** Carte d'un jeu. Le glisser-déposer et les données sont gérés par la page. */
export default function GameCard({
  game,
  status,
  done,
  notesExpanded,
  isDragged,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onNotif,
  onEdit,
  onDelete,
  onOpen,
  onCheck,
  onToggleNotes,
}: Props) {
  const domain = getDomain(game.url)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        'group relative bg-slate-900 rounded-2xl p-4 transition-all duration-150 cursor-grab active:cursor-grabbing',
        isDragOver && !isDragged
          ? 'ring-2 ring-indigo-400 scale-[1.02]'
          : '',
        isDragged ? 'opacity-40' : 'hover:bg-slate-800',
      ].join(' ')}
      style={{ boxShadow: `inset 4px 0 0 ${game.couleur ?? '#6366f1'}` }}
    >
      {/* Hover actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={e => { e.stopPropagation(); onNotif() }}
          title="Notifications"
          className={[
            'bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-xl text-sm transition-colors',
            game.notif_active ? 'text-amber-400' : '',
          ].join(' ')}
        >
          🔔
        </button>
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          title="Éditer"
          className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-xl text-sm transition-colors"
        >
          ✏️
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
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
        onClick={onOpen}
        className="block select-none"
      >
        <div className="flex items-start gap-3">
          {game.emoji && (
            <span className="text-2xl mt-0.5 leading-none flex-shrink-0">{game.emoji}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 pr-14 mb-0.5">
              {domain && (
                // <img> voulu : favicon externe de 20 px. next/image la ferait
                // transiter par l'optimiseur d'images Vercel (quota, config
                // remotePatterns) sans rien gagner à cette taille.
                // eslint-disable-next-line @next/next/no-img-element
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
            onChange={e => onCheck(e.target.checked)}
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
            onClick={e => { e.stopPropagation(); onToggleNotes() }}
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
}
