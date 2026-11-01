import { redirect } from 'next/navigation'
import { seConnecter } from './actions'
import { sessionValide } from '@/auth/garde'

export const dynamic = 'force-dynamic'

export default async function LoginPage(props: { searchParams: Promise<{ next?: string; erreur?: string }> }) {
  const { next, erreur } = await props.searchParams
  // Le proxy laisse /login passer sans cookie : c'est ici qu'on renvoie un
  // visiteur déjà connecté vers l'app.
  if (await sessionValide()) redirect('/')

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="font-display text-4xl font-semibold">Mes jeux</h1>
        <p className="mt-1 text-brume">Cette page est personnelle. Entre ton mot de passe.</p>
      </div>

      <form action={seConnecter} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? ''} />
        <label htmlFor="mdp" className="sr-only">
          Mot de passe
        </label>
        <input
          id="mdp"
          type="password"
          name="motDePasse"
          placeholder="Mot de passe"
          autoFocus
          autoComplete="current-password"
          className="h-12 w-full rounded-2xl border border-white/10 bg-tableau px-4 text-base text-craie placeholder:text-brume/60"
        />
        <button type="submit" className="h-12 rounded-2xl bg-balle text-base font-semibold text-nuit">
          Entrer
        </button>
      </form>

      {erreur && (
        <p role="alert" className="rounded-xl bg-carton/15 px-3 py-2.5 text-sm text-carton">
          Mot de passe incorrect.
        </p>
      )}
    </main>
  )
}
