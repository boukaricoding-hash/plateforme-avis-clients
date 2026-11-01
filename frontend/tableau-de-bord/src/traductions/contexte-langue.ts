import { createContext } from 'react'
import type { Langue } from '../types/langue'

// Valeurs que le texte peut remplacer : {nombre}, {minutes}, {nom}...
export type ValeursTexte = Record<string, string | number>

export type ValeurContexteLangue = {
  langue: Langue
  changerLangue: (langue: Langue) => void
  // Exemple : t('connexion.titre') ou t('motDePasseOublie.delai', { minutes: 30 })
  t: (cle: string, valeurs?: ValeursTexte) => string
}

// null = aucun fournisseur autour du composant (le hook le signalera).
export const ContexteLangue = createContext<ValeurContexteLangue | null>(null)