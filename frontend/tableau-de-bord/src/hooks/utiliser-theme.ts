import { useContext } from 'react'
import { ContexteTheme } from '../contextes/contexte-theme'
import type { ValeurContexteTheme } from '../contextes/contexte-theme'

// Donne le theme actuel (clair ou sombre) et la fonction pour passer de l'un a l'autre.
export function utiliserTheme(): ValeurContexteTheme {
  const valeur = useContext(ContexteTheme)
  if (valeur === null) {
    throw new Error('utiliserTheme doit etre utilise dans un FournisseurTheme.')
  }
  return valeur
}