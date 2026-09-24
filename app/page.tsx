'use client'

import { useState } from 'react'
import type { Game } from '@/lib/supabase'
import { grouperParCategorie } from '@/lib/categories'
import { correspond } from '@/lib/recherche'
import GameCard from '@/components/GameCard'
import GameForm from '@/components/GameForm'
import Entete from '@/components/Entete'
import NotifModal from '@/components/NotifModal'
import BarreRecherche from '@/components/BarreRecherche'
import PaletteCommandes from '@/components/PaletteCommandes'
import { useJeux } from '@/hooks/useJeux'
import { useStatuts } from '@/hooks/useStatuts'
import { useModaleJeu } from '@/hooks/useModaleJeu'
import { useModaleNotif } from '@/hooks/useModaleNotif'
import { useGlisserDeposer } from '@/hooks/useGlisserDeposer'

/**
 * Page principale : assemble les hooks (hooks/) et les composants
 * (components/). Ni requête ni écriture ici.
 */
export default function Home() {
  const jeux = useJeux()
  const { games, loading } = jeux
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [filtre, setFiltre] = useState('')
  const { statuses, oublierStatut } = useStatuts(games)
  const modaleJeu = useModaleJeu({ ...jeux, oublierStatut })
  const modaleNotif = useModaleNotif(jeux)
  const glisser = useGlisserDeposer(jeux.deplacer)

  function handleDelete(game: Game) {
    if (!confirm(`Supprimer "${game.nom}" ?`)) return
    jeux.supprimer(game)
  }

  function toggleNotes(gameId: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  const affiches = games.filter(g => correspond(g, filtre))
  const { categories, parCategorie } = grouperParCategorie(affiches)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <Entete onAjouter={modaleJeu.ouvrirAjout} />
      {games.length > 0 && (
        <BarreRecherche valeur={filtre} onChange={setFiltre} nbAffiches={affiches.length} nbTotal={games.length} />
      )}

      <main className="max-w-6xl mx-auto">
        {loading ? (
          <p className="text-slate-400 text-center py-20">Chargement…</p>
        ) : games.length === 0 ? (
          <p className="text-slate-400 text-center py-20">
            Aucun jeu — clique sur + Ajouter !
          </p>
        ) : affiches.length === 0 ? (
          <p className="text-slate-400 text-center py-20">
            Aucun jeu ne correspond à « {filtre} ».
          </p>
        ) : (
          categories.map(cat => (
            <section key={cat} className="mb-10">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
                {cat}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {parCategorie[cat].map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    status={statuses[game.id]}
                    usage={jeux.stats[game.id]}
                    done={jeux.estFait(game)}
                    notesExpanded={expandedNotes.has(game.id)}
                    {...glisser.propsCarte(game.id, cat)}
                    onNotif={() => modaleNotif.ouvrir(game)}
                    onEdit={() => modaleJeu.ouvrirEdition(game)}
                    onDelete={() => handleDelete(game)}
                    onOpen={() => jeux.marquerOuvert(game)}
                    onCheck={checked => jeux.basculerFait(game, checked)}
                    onToggleNotes={() => toggleNotes(game.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <PaletteCommandes games={games} onOuvrir={jeux.marquerOuvert} />

      {/* Modal ajout / édition */}
      {modaleJeu.modalOpen && (
        <GameForm
          editing={modaleJeu.editing}
          form={modaleJeu.form}
          setForm={modaleJeu.setForm}
          submitting={modaleJeu.submitting}
          onSubmit={modaleJeu.enregistrer}
          onClose={modaleJeu.fermer}
        />
      )}

      {/* Feature C — Modale notifications par jeu */}
      {modaleNotif.jeu && (
        <NotifModal
          gameName={modaleNotif.jeu.nom}
          form={modaleNotif.form}
          setForm={modaleNotif.setForm}
          onSave={modaleNotif.enregistrer}
          onClose={modaleNotif.fermer}
        />
      )}
    </div>
  )
}
