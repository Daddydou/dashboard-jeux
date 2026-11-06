import type { Game } from '@/lib/supabase'
import type { Ligne, Rangee, ResultatLive, Ton } from '@/lib/live/types'
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

function Puce({ ton, className = 'mt-[7px]' }: { ton?: Ton; className?: string }) {
  const couleur =
    ton === 'urgent' ? 'bg-carton ring-2 ring-white/70' : ton === 'afaire' ? 'bg-balle' : 'bg-white/35'
  return <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${couleur} ${className}`} />
}

/** Une rangée par tournoi en cours ; elle ouvre directement ce tournoi quand on a son lien. */
function Rangees({ rangees }: { rangees: Rangee[] }) {
  return (
    <ul className="mt-4 overflow-hidden rounded-2xl bg-black/20">
      {rangees.map((r, i) => {
        const contenu = (
          <>
            <Puce ton={r.ton} className="" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg font-semibold leading-tight">{r.titre}</span>
              <span className="block text-[14px] leading-snug text-white/75">{r.detail}</span>
            </span>
            {r.score && <span className="shrink-0 font-display text-[30px] font-bold leading-none tabular-nums">{r.score}</span>}
          </>
        )
        const classes = [
          'flex min-h-[56px] items-center gap-3 px-3.5 py-2.5',
          i > 0 ? 'border-t border-white/10' : '',
        ].join(' ')
        return (
          <li key={`${r.titre}-${i}`}>
            {r.lien ? (
              <a
                href={r.lien}
                target="_blank"
                rel="noopener noreferrer"
                className={`${classes} pointer-events-auto relative z-10 hover:bg-white/5 active:bg-white/10`}
              >
                {contenu}
              </a>
            ) : (
              <div className={classes}>{contenu}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Lignes({ lignes }: { lignes: Ligne[] }) {
  if (lignes.length === 0) return null
  return (
    <ul className="mt-3 flex flex-col gap-0.5 text-[15px] text-white/85">
      {lignes.map(l => (
        <li key={l.texte} className="flex gap-2">
          <Puce ton={l.ton} />
          <span className="min-w-0">{l.texte}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Carte d'un jeu « à la une » : tout ce qu'il faut savoir sans ouvrir le jeu.
 * Toute la carte ouvre le jeu ; une rangée de tournoi ouvre ce tournoi.
 */
export default function CarteUne({ jeu, resultat }: { jeu: Game; resultat: ResultatLive | undefined }) {
  const matiere = MATIERE[jeu.source_type ?? '']
  const live = resultat?.live ?? null
  const ton: Ton = live?.ton ?? 'calme'

  // Un seul tournoi : sa rangée devient le grand chiffre et une ligne de détail.
  const rangees = live?.rangees ?? []
  const unique = rangees.length === 1 ? rangees[0] : null
  const chiffre = live?.chiffre ?? (unique?.score ? { valeur: unique.score, legende: 'picks du tour' } : undefined)
  const lignes: Ligne[] = unique ? [{ texte: unique.detail, ton: unique.ton }, ...(live?.lignes ?? [])] : (live?.lignes ?? [])

  return (
    <article
      className={[
        'relative isolate flex min-h-[196px] flex-col overflow-hidden rounded-[28px] p-5 text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition-transform active:scale-[0.99]',
        matiere?.surface ?? 'surface-unie',
      ].join(' ')}
    >
      <a
        href={(unique?.lien ?? live?.lien) || jeu.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir ${jeu.nom}`}
        className="absolute inset-0 z-0 rounded-[28px]"
      />
      {matiere?.traces === 'court' && <TracesCourt />}
      {matiere?.traces === 'raquette' && <TracesRaquette />}

      <div className="pointer-events-none relative flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-lg font-semibold leading-tight tracking-wide">
            {jeu.emoji && <span aria-hidden="true">{jeu.emoji} </span>}
            {jeu.nom}
          </p>
          <Pastille ton={ton} echeance={live?.echeance ?? null} />
        </div>

        {live ? (
          <div className="mt-auto pt-6">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-[15px] text-white/75">{live.contexte}</p>
                <p className="mt-0.5 text-balance font-display text-[28px] font-semibold leading-[1.05]">{live.titre}</p>
              </div>
              {chiffre && (
                <div className="shrink-0 text-right">
                  <p className="font-display text-[60px] font-bold leading-[0.82] tabular-nums">{chiffre.valeur}</p>
                  <p className="mt-1.5 text-xs text-white/70">{chiffre.legende}</p>
                </div>
              )}
            </div>
            {rangees.length > 1 && <Rangees rangees={rangees} />}
            <Lignes lignes={lignes} />
          </div>
        ) : (
          <div className="mt-auto pt-6">
            <p className="font-display text-[26px] font-semibold leading-tight">Ouvrir le jeu</p>
            <p className="mt-1 text-[15px] text-white/75">{resultat?.note ?? 'Statut indisponible pour l’instant.'}</p>
          </div>
        )}

        {jeu.notes && <p className="mt-3 truncate text-sm text-white/65">{jeu.notes}</p>}
      </div>
    </article>
  )
}
