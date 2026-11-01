import { useContext } from 'react'
import { ContexteUtilisateur } from '../contextes/contexte-utilisateur'
import type { ValeurContexteUtilisateur } from '../contextes/contexte-utilisateur'

// Donne l'utilisateur connecte et les fonctions seConnecter / seDeconnecter.
// A utiliser dans tous les composants qui dependent de la session.
export function utiliserUtilisateur(): ValeurContexteUtilisateur {
  const valeur = useContext(ContexteUtilisateur)
  if (valeur === null) {
    throw new Error('utiliserUtilisateur doit etre utilise dans un FournisseurUtilisateur.')
  }
  return valeur
}