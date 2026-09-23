import { redirect } from 'next/navigation';
import { seConnecter } from './actions';
import { sessionValide } from '@/auth/garde';

export const dynamic = 'force-dynamic';

export default async function LoginPage(
  props: {
    searchParams: Promise<{ next?: string; erreur?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // Le proxy laisse /login passer sans cookie : c'est ici qu'on renvoie
  // un visiteur déjà connecté vers l'app.
  if (await sessionValide()) redirect('/');

  const { next, erreur } = searchParams;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-xs space-y-4 py-16">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">🎲 Accès privé</h1>
          <p className="text-sm text-slate-400">
            Ce dashboard est personnel. Mot de passe requis.
          </p>
        </div>

        <form action={seConnecter} className="space-y-3">
          <input type="hidden" name="next" value={next ?? ''} />
          <input
            type="password"
            name="motDePasse"
            placeholder="Mot de passe"
            autoFocus
            autoComplete="current-password"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-2xl font-semibold text-sm"
          >
            Entrer
          </button>
        </form>

        {erreur && (
          <p className="rounded-xl bg-red-950 border border-red-900 p-2 text-sm text-red-200">
            Mot de passe incorrect.
          </p>
        )}
      </div>
    </div>
  );
}
