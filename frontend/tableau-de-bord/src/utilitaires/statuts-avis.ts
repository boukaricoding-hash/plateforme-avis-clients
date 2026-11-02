import type { StatutTraitement } from '../types/tableau-de-bord'
import { niveauDeNoteEntiere, type NiveauNote } from './couleurs-notes'

// Statuts et pastilles des ecrans E8 et E9 (jour 15).
// Memes couleurs que les avis recents de l'accueil : un avis garde le meme aspect partout.
// La couleur ne suffit jamais seule : chaque statut a aussi son texte (avis.statuts.*).

// Les 4 statuts, dans l'ordre du traitement d'un avis (boutons et liste deroulante).
export const STATUTS_AVIS: readonly StatutTraitement[] = ['NOUVEAU', 'EN_COURS', 'TRAITE', 'IGNORE']

// Forme commune de toutes les pastilles (statut, alerte, note).
export const CLASSE_BASE_PASTILLE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium'

// Les classes Tailwind sont ecrites en entier : Tailwind ne trouve pas celles qu'on assemble.
const CLASSES_STATUT: Record<StatutTraitement, string> = {
  NOUVEAU: 'border-principale bg-principale text-texte-sur-principale',
  EN_COURS: 'border-bordure-champ bg-surface text-texte',
  TRAITE: 'border-succes bg-surface text-succes',
  IGNORE: 'border-bordure bg-surface text-texte-discret',
}

// Pastille d'alerte et pastille "prioritaire" (avis qui a declenche une alerte).
export const CLASSES_PASTILLE_ALERTE = `${CLASSE_BASE_PASTILLE} border-erreur bg-surface text-erreur`
export const CLASSES_PASTILLE_PRIORITAIRE = `${CLASSE_BASE_PASTILLE} border-erreur bg-erreur text-surface`

// Classes completes de la pastille d'un statut.
export function classePastilleStatut(statut: StatutTraitement): string {
  return `${CLASSE_BASE_PASTILLE} ${CLASSES_STATUT[statut]}`
}

// Cle du texte du statut, a donner a t() : "Nouveau", "En cours", "Traité" ou "Ignoré".
export function cleTexteStatut(statut: StatutTraitement): string {
  return `avis.statuts.${statut}`
}

// Niveau de couleur de la note d'un avis (de 1 a 5, decimales possibles).
// Comme dans les avis recents : on arrondit puis 4 et 5 = vert, 3 = orange, 1 et 2 = rouge.
// null : pas de note, donc aucune couleur.
export function niveauDeLaNoteAvis(note: number | null): NiveauNote | null {
  return note === null ? null : niveauDeNoteEntiere(Math.round(note))
}