import type { Textes } from '../fr/textes'

// Textes de la page d'avis en anglais (jour 9 : ecrans E1 et E2).
export const en: Textes = {
  commun: {
    chargement: 'Loading…',
    langue: 'Language',
    francais: 'Français',
    anglais: 'English',
    erreurGenerique: 'Something went wrong. Please try again.',
  },
  accueil: {
    titreParDefaut: 'Your feedback matters',
    messageParDefaut: 'Thank you for taking a moment to give us your feedback.',
    duree: 'It takes less than a minute.',
    commencer: 'Start',
  },
  question: {
    progression: 'Question {courant} of {total}',
    retour: 'Back',
    suivant: 'Next',
    obligatoire: 'This question is required.',
    plusieursReponses: 'Multiple answers possible',
    placeholderTexte: 'Write your answer here',
    oui: 'Yes',
    non: 'No',
    etoiles: '{note} out of 5',
    npsMin: 'Not at all likely',
    npsMax: 'Extremely likely',
  },
}