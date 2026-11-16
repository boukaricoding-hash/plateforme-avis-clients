import type { ReactNode } from 'react'
import { ChargementBattement } from '../composants-communs/chargement-battement'
import { utiliserDureeMinimale } from '../hooks/utiliser-duree-minimale'
import { utiliserUtilisateur } from '../hooks/utiliser-utilisateur'

type Proprietes = {
  children: ReactNode
}

// Entoure toute l'application (voir main.tsx), donc toutes les pages : connexion, mot de passe
// oublie, invitation et ecrans connectes. Le loader (battement de coeur puis lettre D) joue a
// chaque chargement complet de la page, et reste au moins 2,5 s meme si la session est verifiee
// plus vite. Une navigation a l'interieur de l'application ne le rejoue pas.
export function CadreDemarrage({ children }: Proprietes) {
  const { verification } = utiliserUtilisateur()
  const phase = utiliserDureeMinimale(!verification)

  if (phase !== 'termine') {
    return <ChargementBattement sortie={phase === 'sortie'} />
  }

  return <>{children}</>
}