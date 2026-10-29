import { createContext } from 'react'
import type { Langue } from '../types/avis-public'

// Valeurs que le texte peut remplacer : {courant}, {total}, {note}...
export type ValeursTexte = Record<string, string | number>

export type ValeurContexteLangue = {
  langue: Langue
  changerLangue: (langue: Langue) => void
  // Exemple : t('question.progression', { courant: 2, total: 8 })
  t: (cle: string, valeurs?: ValeursTexte) => string
}

// null = aucun fournisseur autour du composant (le hook le signalera).
export const ContexteLangue = createContext<ValeurContexteLangue | null>(null)