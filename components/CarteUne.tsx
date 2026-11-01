import type { Game } from '@/lib/supabase'
import type { ResultatLive, Ton } from '@/lib/live/types'
import { IconeCoche } from './icones'
import { TracesCourt, TracesRaquette } from './Terrain'

/** Chaque source a la matière de son terrain. */
const MATIERE: Record<string, { surface: string; traces: 'court' | 'raquette' }> = {
  gametracker: { surface: 'surface-dur', traces: 'court' },
  optipick: { surface: 'surface-gazon', traces: 'court' },
  ttfl: { surface: 'surface-parquet', traces: 'raquette' },
}

function Pastille({ ton, echeance }: { ton: Ton; echeance: string | null }) {
  if (ton === 'urgent' || ton === 'afaire') {
    return (
      <span
        className={[
          'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold',
          ton === 'urgent' ? 'bg-carton text-white' : 'bg-balle text-nuit',
        ].join(' ')}
      >
        {ton === 'urgent' ? 'Urgent' : 'À faire'}
        {echeance && <span className="font-medium opacity-80">· {echeance}</span>}
      </span>
    )
  }
  if (ton === 'ok') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold">
        <IconeCoche className="h-3.5 w-3.5" />À jour
      </span>
    )
  }
  return null
}

function Puce({ ton }: { ton?: Ton }) {
  if (ton === 'urgent') return <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-carton ring-2 ring-white/70" />
  if (ton === 'afaire') return <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-balle" />
  return <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-white/35" />
}

/**
 * Carte d'un jeu « à la une » : tout ce qu'il faut savoir sans ouvrir le jeu,
 * et un appui ouvre directement le bon écran.
 */
export default function CarteUne({ jeu, resultat }: { jeu: Game; resultat: ResultatLive | undefined }) {
  const matiere = MATIERE[jeu.source_type ?? '']
  const live = resultat?.live ?? null
  const ton: Ton = live?.ton ?? 'calme'

  return (
    <a
      href={live?.lien ?? jeu.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'group relative isolate flex min-h-[196px] flex-col overflow-hidden rounded-[28px] p-5 text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition-transform active:scale-[0.985]',
        matiere?.surface ?? 'surface-unie',
      ].join(' ')}
    >
      {matiere?.traces === 'court' && <TracesCourt />}
      {matiere?.traces === 'raquette' && <TracesRaquette />}

      <div className="relative flex items-start justify-between gap-3">
        <p className="font-display text-lg font-semibold leading-tight tracking-wide">
          {jeu.emoji && <span aria-hidden="true">{jeu.emoji} </span>}
          {jeu.nom}
        </p>
        <Pastille ton={ton} echeance={live?.echeance ?? null} />
      </div>

      {live ? (
        <div className="relative mt-auto flex items-end justify-between gap-4 pt-6">
          <div className="min-w-0">
            <p className="truncate text-[15px] text-white/75">{live.contexte}</p>
            <p className="mt-0.5 text-balance font-display text-[28px] font-semibold leading-[1.05]">{live.titre}</p>
            {live.lignes.length > 0 && (
              <ul className="mt-3 flex flex-col gap-0.5 text-[15px] text-white/85">
                {live.lignes.map(l => (
                  <li key={l.texte} className="flex gap-2">
                    <Puce ton={l.ton} />
                    <span className="min-w-0">{l.texte}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {live.chiffre && (
            <div className="shrink-0 text-right">
              <p className="font-display text-[60px] font-bold leading-[0.82] tabular-nums">{live.chiffre.valeur}</p>
              <p className="mt-1.5 text-xs text-white/70">{live.chiffre.legende}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative mt-auto pt-6">
          <p className="font-display text-[26px] font-semibold leading-tight">Ouvrir le jeu</p>
          <p className="mt-1 text-[15px] text-white/75">
            {resultat?.note ?? 'Statut indisponible pour l’instant.'}
          </p>
        </div>
      )}

      {jeu.notes && <p className="relative mt-3 truncate text-sm text-white/65">{jeu.notes}</p>}
    </a>
  )
}
