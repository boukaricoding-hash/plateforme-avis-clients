import type { ValeurReponse } from '../types/avis-public'

// Vrai si le client a vraiment repondu a une question.
// Attention : 0 (NPS ou echelle) et false (Non) sont de vraies reponses.
// Un texte fait d'espaces ou une liste de choix vide ne comptent pas comme une reponse.
export function aUneReponse(valeur: ValeurReponse | undefined): boolean {
  if (valeur === undefined) {
    return false
  }
  if (typeof valeur === 'string') {
    return valeur.trim() !== ''
  }
  if (Array.isArray(valeur)) {
    return valeur.length > 0
  }
  return true
}