import { createContext } from 'react'
import type { Theme } from '../types/theme'

export type ValeurContexteTheme = {
  theme: Theme
  // Passe du sombre au clair, ou du clair au sombre.
  basculerTheme: () => void
}

// null = aucun fournisseur autour du composant (le hook le signalera).
export const ContexteTheme = createContext<ValeurContexteTheme | null>(null)