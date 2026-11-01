import Link from 'next/link'
import { Suspense } from 'react'
import { pageProtegee } from '@/auth/pageProtegee'
import AutoRefresh from '@/components/AutoRefresh'
import CarteUne from '@/components/CarteUne'
import { IconeReglages } from '@/components/icones'
import Tuile from '@/components/Tuile'
import { lireJeux } from '@/lib/donnees'
import { chargerLive } from '@/lib/live'
import { estSource } from '@/lib/live/types'
import { jourEnToutesLettres } from '@/lib/relatif'
import type { Game } from '@/lib/supabase'
import { maintenant } from '@/lib/time'

const PHRASES = ['Tout est à jour.', 'Une chose t’attend.', 'Deux choses t’attendent.', 'Trois choses t’attendent.']

/** Les cartes « à la une », une fois leurs sources lues. */
async function ALaUne({ jeux, now }: { jeux: Game[]; now: Date }) {
  const resultats = await chargerLive(jeux, now)
  const enAttente = jeux.filter(j => {
    const ton = resultats[j.id]?.live?.ton
    return ton === 'afaire' || ton === 'urgent'
  }).length
  const notes = jeux.map(j => resultats[j.id]?.note).filter((n): n is string => !!n)

  return (
    <>
      <h1 className="mt-1 text-balance font-display text-[34px] font-semibold leading-[1.05] md:text-5xl">
        {PHRASES[enAttente] ?? `${enAttente} choses t’attendent.`}
      </h1>
      <section aria-label="À la une" className="mt-6 grid gap-3 lg:grid-cols-3">
        {jeux.map(j => (
          <CarteUne key={j.id} jeu={j} resultat={resultats[j.id]} />
        ))}
      </section>
      {notes.length > 0 && (
        <ul className="mt-3 text-sm text-brume">
          {notes.map(n => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </>
  )
}

function Attente({ n }: { n: number }) {
  return (
    <div aria-busy="true" aria-label="Chargement des statuts">
      <div className="mt-2 h-9 w-2/3 animate-pulse rounded-xl bg-tableau" />
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="h-[196px] animate-pulse rounded-[28px] bg-tableau" />
        ))}
      </div>
    </div>
  )
}

export default async function Accueil() {
  await pageProtegee()
  const now = maintenant()
  const jeux = await lireJeux()
  const une = jeux.filter(j => estSource(j.source_type))
  const autres = jeux.filter(j => !estSource(j.source_type))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] md:px-8 md:pt-10">
      <AutoRefresh />
      <div className="flex items-center justify-between gap-4">
        <p className="text-[15px] text-brume">{jourEnToutesLettres(now)}</p>
        <Link
          href="/reglages"
          aria-label="Réglages"
          className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-brume transition-colors hover:bg-tableau hover:text-craie"
        >
          <IconeReglages className="h-6 w-6" />
        </Link>
      </div>

      {jeux.length === 0 ? (
        <div className="mt-10 rounded-[28px] bg-tableau p-6">
          <h1 className="font-display text-3xl font-semibold">Aucun jeu pour l’instant</h1>
          <p className="mt-2 text-brume">Ajoute tes jeux dans les réglages pour les retrouver ici.</p>
          <Link href="/reglages" className="mt-5 inline-flex h-12 items-center rounded-2xl bg-craie px-5 font-semibold text-nuit">
            Ajouter un jeu
          </Link>
        </div>
      ) : une.length > 0 ? (
        <Suspense fallback={<Attente n={une.length} />}>
          <ALaUne jeux={une} now={now} />
        </Suspense>
      ) : (
        <h1 className="mt-1 font-display text-[34px] font-semibold leading-tight">Mes jeux</h1>
      )}

      {autres.length > 0 && (
        <section aria-labelledby="autres" className="mt-9">
          <h2 id="autres" className="mb-3 font-display text-xl font-semibold text-brume">
            Autres jeux
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {autres.map(j => (
              <Tuile key={j.id} jeu={j} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
