'use client'

import { useEffect } from 'react'

/**
 * Page d'erreur : une lecture qui échoue ne doit jamais ressembler à une
 * liste vide. Le message exact est dans les journaux du serveur.
 */
export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl font-semibold">Impossible de charger la page</h1>
      <p className="text-brume">La base de données n’a pas répondu. Tes jeux n’ont pas disparu : réessaie dans un instant.</p>
      <button type="button" onClick={reset} className="h-12 rounded-2xl bg-craie text-base font-semibold text-nuit">
        Réessayer
      </button>
    </main>
  )
}
