import { createContext } from 'react'
import type { Utilisateur } from '../types/utilisateur'

export type ValeurContexteUtilisateur = {
  // null = personne n'est connecte.
  utilisateur: Utilisateur | null
  // Vrai tant qu'on verifie la session au demarrage (GET /auth/me).
  verification: boolean
  // Connecte l'utilisateur ; leve une ErreurService si la connexion echoue.
  seConnecter: (email: string, motDePasse: string, seSouvenir: boolean) => Promise<void>
  // Deconnecte l'utilisateur ; il est deconnecte cote ecran meme si le reseau echoue.
  seDeconnecter: () => Promise<void>
}

// null = aucun fournisseur autour du composant (le hook le signalera).
export const ContexteUtilisateur = createContext<ValeurContexteUtilisateur | null>(null)