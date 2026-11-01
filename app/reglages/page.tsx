import Link from 'next/link'
import { seDeconnecter } from '@/app/login/actions'
import { pageProtegee } from '@/auth/pageProtegee'
import BoutonPush from '@/components/BoutonPush'
import { IconeRetour, IconeSortie } from '@/components/icones'
import ListeJeux from '@/components/ListeJeux'
import { lireJeux } from '@/lib/donnees'
import { SOURCES } from '@/lib/live/types'
import type { Game } from '@/lib/supabase'

const LISTE_SOURCES = Object.entries(SOURCES).map(([id, libelle]) => ({ id, libelle }))

function rythme(j: Game): string {
  const heure = (j.notif_heure ?? '').slice(0, 5)
  const base = j.notif_frequence === 'hebdo' ? `chaque semaine à ${heure}` : `chaque jour à ${heure}`
  return j.notif_fin ? `${base}, jusqu’au ${j.notif_fin.split('-').reverse().join('/')}` : base
}

export default async function Reglages() {
  await pageProtegee()
  const jeux = await lireJeux()
  const rappels = jeux.filter(j => j.notif_active && j.notif_heure)
  const cleGameTracker = !!process.env.GAMETRACKER_PICKS_KEY

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] md:pt-10">
      <Link href="/" className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full pl-1 pr-3 text-brume hover:text-craie">
        <IconeRetour className="h-5 w-5" />
        Accueil
      </Link>
      <h1 className="mt-2 font-display text-[34px] font-semibold leading-tight">Réglages</h1>

      <section aria-labelledby="t-jeux" className="mt-7">
        <h2 id="t-jeux" className="font-display text-xl font-semibold">
          Mes jeux
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-brume">L’ordre ici est celui de l’accueil.</p>
        <ListeJeux jeux={jeux} sources={LISTE_SOURCES} />
      </section>

      <section aria-labelledby="t-notifs" className="mt-9 flex flex-col gap-3">
        <h2 id="t-notifs" className="font-display text-xl font-semibold">
          Rappels
        </h2>
        <BoutonPush />
        {rappels.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {rappels.map(j => (
              <li key={j.id} className="flex items-center justify-between gap-3 rounded-2xl bg-tableau px-4 py-3">
                <span className="truncate font-semibold">{j.nom}</span>
                <span className="shrink-0 text-sm text-brume">{rythme(j)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-brume">Aucun rappel. Ouvre la fiche d’un jeu pour en programmer un.</p>
        )}
      </section>

      <section aria-labelledby="t-sources" className="mt-9">
        <h2 id="t-sources" className="font-display text-xl font-semibold">
          Statuts en direct
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-[15px]">
          <li className="rounded-2xl bg-tableau px-4 py-3">
            <p className="font-semibold">Pick + Bracket</p>
            <p className="text-sm text-brume">
              {cleGameTracker
                ? 'Lu en direct chez Game Tracker : ton pick, le verrou et ton classement.'
                : 'Clé Game Tracker absente : seule la liste des tournois s’affiche. Ajoute GAMETRACKER_PICKS_KEY sur Vercel pour voir ton pick.'}
            </p>
          </li>
          <li className="rounded-2xl bg-tableau px-4 py-3">
            <p className="font-semibold">Opti-Pick</p>
            <p className="text-sm text-brume">Ton plan de picks sur les tournois en cours (base de l’app tennis).</p>
          </li>
          <li className="rounded-2xl bg-tableau px-4 py-3">
            <p className="font-semibold">TTFL Pick</p>
            <p className="text-sm text-brume">Le pick du soir du moteur et la saisie du robot sur les comptes de l’équipe.</p>
          </li>
        </ul>
      </section>

      <form action={seDeconnecter} className="mt-9">
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tableau font-semibold text-carton">
          <IconeSortie className="h-5 w-5" />
          Se déconnecter
        </button>
      </form>
    </main>
  )
}
