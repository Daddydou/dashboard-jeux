import type { GameStatus } from '@/lib/status/types'

export default function StatusBadge({ status }: { status: GameStatus | undefined }) {
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
