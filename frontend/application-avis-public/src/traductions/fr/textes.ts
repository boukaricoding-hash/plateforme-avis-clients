// Textes de la page d'avis en francais (jour 9 : ecrans E1 et E2).
// Les textes entre accolades, comme {courant}, sont remplaces par le code.
export const fr = {
  commun: {
    chargement: 'Chargement…',
    langue: 'Langue',
    francais: 'Français',
    anglais: 'English',
    erreurGenerique: 'Une erreur est survenue. Merci de réessayer.',
  },
  accueil: {
    titreParDefaut: 'Votre avis compte',
    messageParDefaut: 'Merci de prendre un instant pour nous donner votre avis.',
    duree: 'Cela prend moins d’une minute.',
    commencer: 'Commencer',
  },
  question: {
    progression: 'Question {courant} sur {total}',
    retour: 'Retour',
    suivant: 'Suivant',
    obligatoire: 'Cette question est obligatoire.',
    plusieursReponses: 'Plusieurs réponses possibles',
    placeholderTexte: 'Écrivez votre réponse ici',
    oui: 'Oui',
    non: 'Non',
    etoiles: '{note} sur 5',
    npsMin: 'Pas du tout probable',
    npsMax: 'Très probable',
  },
}

export type Textes = typeof fr