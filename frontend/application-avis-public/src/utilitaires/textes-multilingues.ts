import type { Langue, TexteMultilingue } from '../types/avis-public'

// Choisit le texte a afficher selon la langue.
// Anglais demande mais absent ou vide : on affiche le francais.
// Texte absent (null ou undefined) : chaine vide.
export function choisirTexte(
  texte: TexteMultilingue | null | undefined,
  langue: Langue,
): string {
  if (!texte) {
    return ''
  }
  if (langue === 'en' && texte.en !== undefined && texte.en.trim() !== '') {
    return texte.en
  }
  return texte.fr
}