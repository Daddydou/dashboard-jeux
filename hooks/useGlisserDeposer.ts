import { useState } from 'react'

/**
 * Glisser-déposer des cartes, à l'intérieur d'une catégorie. Le calcul du
 * nouvel ordre et son enregistrement sont délégués à `deplacer` (useJeux).
 */
export function useGlisserDeposer(deplacer: (categorie: string, deId: string, versId: string) => void) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function reinitialiser() {
    setDraggedId(null)
    setDragOverId(null)
  }

  function deposer(e: React.DragEvent, categorie: string, versId: string) {
    e.preventDefault()
    const deId = draggedId
    reinitialiser()
    if (!deId || deId === versId) return
    deplacer(categorie, deId, versId)
  }

  /** Props de glisser-déposer d'une carte (à étaler sur <GameCard>). */
  function propsCarte(gameId: string, categorie: string) {
    return {
      isDragged: draggedId === gameId,
      isDragOver: dragOverId === gameId,
      onDragStart: () => setDraggedId(gameId),
      onDragOver: () => setDragOverId(gameId),
      onDrop: (e: React.DragEvent) => deposer(e, categorie, gameId),
      onDragEnd: reinitialiser,
    }
  }

  return { propsCarte }
}
