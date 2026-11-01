import { useContext } from 'react'
import { ContexteLangue } from '../traductions/contexte-langue'
import type { ValeurContexteLangue } from '../traductions/contexte-langue'

// Donne la langue choisie, la fonction pour la changer et la fonction t('cle').
// A utiliser dans tous les composants qui affichent du texte.
export function utiliserLangue(): ValeurContexteLangue {
  const valeur = useContext(ContexteLangue)
  if (valeur === null) {
    throw new Error('utiliserLangue doit etre utilise dans un FournisseurLangue.')
  }
  return valeur
}