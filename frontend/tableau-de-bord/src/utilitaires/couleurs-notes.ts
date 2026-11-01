// Couleurs des notes du tableau de bord (jour 14).
// Vert a partir de 4,2 ; orange de 3,5 a 4,2 (4,2 exclu) ; rouge en dessous de 3,5.
// Les couleurs viennent des variables --note-bonne, --note-moyenne, --note-mauvaise
// de styles/index.css. La couleur ne suffit jamais seule : chaque niveau a aussi un texte
// (tableau.cartes.niveauxNote.*) pour les personnes qui ne distinguent pas les couleurs.

export const SEUIL_NOTE_BONNE = 4.2
export const SEUIL_NOTE_MOYENNE = 3.5

export type NiveauNote = 'bonne' | 'moyenne' | 'mauvaise'

// Niveau d'une note moyenne (de 1 a 5). null : aucune note, donc aucune couleur.
// On compare la valeur exacte de l'API (2 decimales) : 4,19 est orange.
export function niveauDeLaNote(note: number | null): NiveauNote | null {
  if (note === null) {
    return null
  }
  if (note >= SEUIL_NOTE_BONNE) {
    return 'bonne'
  }
  if (note >= SEUIL_NOTE_MOYENNE) {
    return 'moyenne'
  }
  return 'mauvaise'
}

// Niveau d'une note entiere de 1 a 5 (graphique de repartition) :
// 4 et 5 = satisfaits (comme le CSAT), 3 = moyen, 1 et 2 = mauvais (seuil d'alerte).
export function niveauDeNoteEntiere(note: number): NiveauNote {
  if (note >= 4) {
    return 'bonne'
  }
  if (note === 3) {
    return 'moyenne'
  }
  return 'mauvaise'
}

// Les classes Tailwind sont ecrites en entier : Tailwind ne trouve pas celles qu'on assemble.
const CLASSES_TEXTE: Record<NiveauNote, string> = {
  bonne: 'text-note-bonne',
  moyenne: 'text-note-moyenne',
  mauvaise: 'text-note-mauvaise',
}

const CLASSES_FOND_CLAIR: Record<NiveauNote, string> = {
  bonne: 'bg-note-bonne/10',
  moyenne: 'bg-note-moyenne/10',
  mauvaise: 'bg-note-mauvaise/10',
}

const CLASSES_FOND_PLEIN: Record<NiveauNote, string> = {
  bonne: 'bg-note-bonne',
  moyenne: 'bg-note-moyenne',
  mauvaise: 'bg-note-mauvaise',
}

const VARIABLES_CSS: Record<NiveauNote, string> = {
  bonne: 'var(--note-bonne)',
  moyenne: 'var(--note-moyenne)',
  mauvaise: 'var(--note-mauvaise)',
}

// Texte colore (chiffre de la note).
export function classeTexteNote(niveau: NiveauNote | null): string {
  return niveau === null ? 'text-texte' : CLASSES_TEXTE[niveau]
}

// Fond clair (pastille, bandeau).
export function classeFondClairNote(niveau: NiveauNote | null): string {
  return niveau === null ? 'bg-surface-douce' : CLASSES_FOND_CLAIR[niveau]
}

// Fond plein (petit point de couleur, barre).
export function classeFondPleinNote(niveau: NiveauNote | null): string {
  return niveau === null ? 'bg-texte-discret' : CLASSES_FOND_PLEIN[niveau]
}

// Couleur pour les graphiques recharts (attribut fill ou stroke).
// Sans niveau : la couleur de decor de la palette.
export function couleurGraphiqueNote(niveau: NiveauNote | null): string {
  return niveau === null ? 'var(--couleur-decor)' : VARIABLES_CSS[niveau]
}

// Cle du texte du niveau, a donner a t() : "Bonne", "Moyenne" ou "A ameliorer".
export function cleTexteNiveau(niveau: NiveauNote): string {
  return `tableau.cartes.niveauxNote.${niveau}`
}