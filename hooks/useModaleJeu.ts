import { useState } from 'react'
import type { Game } from '@/lib/supabase'
import { EMPTY_FORM, jeuVersFormulaire, type FormState } from '@/components/GameForm'
import type { useJeux } from './useJeux'

type Deps = Pick<ReturnType<typeof useJeux>, 'ajouter' | 'modifier' | 'surEchecEcriture'> & {
  oublierStatut: (gameId: string) => void
}

/** Modale d'ajout / édition d'un jeu : ouverture, formulaire, enregistrement. */
export function useModaleJeu({ ajouter, modifier, surEchecEcriture, oublierStatut }: Deps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  function ouvrirAjout() {
    setEditingGame(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function ouvrirEdition(game: Game) {
    setEditingGame(game)
    setForm(jeuVersFormulaire(game))
    setModalOpen(true)
  }

  function fermer() {
    setModalOpen(false)
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editingGame) {
        // Nouvelle source de statut : on oublie l'ancien AVANT l'envoi.
        if ((editingGame.source_type ?? '') !== form.source_type) {
          oublierStatut(editingGame.id)
        }
        await modifier(editingGame.id, form)
      } else {
        await ajouter(form)
      }
    } catch (err) {
      // Échec : la modale reste ouverte, le bouton redevient cliquable.
      setSubmitting(false)
      surEchecEcriture(err)
      return
    }

    setSubmitting(false)
    setModalOpen(false)
  }

  return { modalOpen, editing: editingGame !== null, form, setForm, submitting, ouvrirAjout, ouvrirEdition, fermer, enregistrer }
}
