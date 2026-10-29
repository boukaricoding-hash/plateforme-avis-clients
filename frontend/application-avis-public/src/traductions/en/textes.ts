import type { Textes } from '../fr/textes'

// Textes de la page d'avis en anglais (jours 9 et 10 : ecrans E1 a E5).
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
  envoi: {
    titre: 'One last thing?',
    commentaire: 'Your comment (optional)',
    placeholderCommentaire: 'Tell us more…',
    contactTitre: 'Would you like to be contacted?',
    contactAide: 'Optional. Your details are only used to reply to you.',
    nom: 'Name',
    telephone: 'Phone',
    email: 'Email',
    consentement:
      'I agree that the establishment may use these details to contact me about my feedback.',
    consentementRequis: 'Tick the box so that your details can be saved.',
    telephoneInvalide: 'Invalid phone number.',
    emailInvalide: 'Invalid email address.',
    confidentialiteLien: 'How your data is used',
    confidentialiteTitre: 'Privacy',
    confidentialiteTexte:
      'Your feedback is anonymous. If you leave your details and tick the box, they are visible only to the establishment, and only used to reply to you. You never have to provide them.',
    fermer: 'Close',
    envoyer: 'Send',
    envoiEnCours: 'Sending…',
    horsConnexion:
      'No connection. Your feedback is saved on your phone and will be sent as soon as the network is back.',
    erreurEnvoi: 'Sending failed. Please check your answers and try again.',
  },
  remerciement: {
    titreParDefaut: 'Thank you!',
    messageParDefaut: 'Thank you for your feedback!',
    confirmation: 'Your feedback has been sent.',
    fermer: 'You can close this page.',
  },
  erreur: {
    reessayer: 'Try again',
    qrInconnu: {
      titre: 'QR code not found',
      message: 'This QR code does not exist. Please make sure it was scanned completely.',
    },
    qrDesactive: {
      titre: 'QR code disabled',
      message: 'This QR code is no longer in use. Please ask the staff.',
    },
    organisationSuspendue: {
      titre: 'Service unavailable',
      message: 'This service is temporarily unavailable. Please try again later.',
    },
    questionnaireInactif: {
      titre: 'Questionnaire unavailable',
      message: 'This questionnaire is not available at the moment.',
    },
    evenementPasCommence: {
      titre: 'Not open yet',
      message: 'This questionnaire is not open yet. Please come back a little later.',
    },
    evenementTermine: {
      titre: 'Questionnaire closed',
      message: 'This questionnaire is closed. Thank you for your interest!',
    },
    avisDejaDonne: {
      titre: 'Thank you, already done!',
      message: 'You have already given your feedback. Thank you for taking part!',
    },
    horsConnexion: {
      titre: 'No connection',
      message: 'Cannot reach the server. Please check your connection and try again.',
    },
    tropDeRequetes: {
      titre: 'One moment',
      message: 'Too many attempts. Please wait a minute and try again.',
    },
    generique: {
      titre: 'Something went wrong',
      message: 'Something went wrong. Please try again.',
    },
  },
}