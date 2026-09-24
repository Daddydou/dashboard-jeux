import { seDeconnecter } from '@/app/login/actions'
import PushButton from './PushButton'
import PanneauSante from './PanneauSante'
import BoiteRappels from './BoiteRappels'

/** En-tête : titre, bouton push, rappels, santé du portfolio, ajout d'un jeu et déconnexion. */
export default function Entete({ onAjouter }: { onAjouter: () => void }) {
  return (
    <header className="flex items-center justify-between mb-10 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">🎲 Mes jeux</h1>
      <div className="flex items-center gap-2">
        {/* Feature C — bouton push */}
        <PushButton />
        <BoiteRappels />
        <PanneauSante />
        <button
          onClick={onAjouter}
          className="bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-2xl font-semibold text-sm"
        >
          + Ajouter
        </button>
        <form action={seDeconnecter}>
          <button
            type="submit"
            title="Se déconnecter"
            className="bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-2 rounded-2xl text-sm text-slate-300"
          >
            ⎋
          </button>
        </form>
      </div>
    </header>
  )
}
