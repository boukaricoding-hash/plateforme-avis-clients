// Textes de la page d'avis en francais (jours 9 et 10 : ecrans E1 a E5).
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
  envoi: {
    titre: 'Un dernier mot ?',
    commentaire: 'Votre commentaire (facultatif)',
    placeholderCommentaire: 'Dites-nous en plus…',
    contactTitre: 'Souhaitez-vous être recontacté ?',
    contactAide: 'Facultatif. Vos coordonnées servent uniquement à vous répondre.',
    nom: 'Nom',
    telephone: 'Téléphone',
    email: 'E-mail',
    consentement:
      'J’accepte que l’établissement utilise ces coordonnées pour me recontacter au sujet de mon avis.',
    consentementRequis: 'Cochez la case pour que vos coordonnées soient enregistrées.',
    telephoneInvalide: 'Numéro de téléphone invalide.',
    emailInvalide: 'Adresse e-mail invalide.',
    confidentialiteLien: 'Confidentialité de vos données',
    confidentialiteTitre: 'Confidentialité',
    confidentialiteTexte:
      'Votre avis est anonyme. Si vous laissez vos coordonnées et cochez la case, elles sont visibles uniquement par l’établissement, uniquement pour vous répondre. Vous n’êtes jamais obligé de les donner.',
    fermer: 'Fermer',
    envoyer: 'Envoyer',
    envoiEnCours: 'Envoi en cours…',
    horsConnexion:
      'Pas de connexion. Votre avis est gardé sur votre téléphone et sera envoyé dès que le réseau revient.',
    erreurEnvoi: 'L’envoi a échoué. Vérifiez vos réponses et réessayez.',
  },
  remerciement: {
    titreParDefaut: 'Merci !',
    messageParDefaut: 'Merci pour votre avis !',
    confirmation: 'Votre avis a bien été envoyé.',
    fermer: 'Vous pouvez fermer cette page.',
  },
  erreur: {
    reessayer: 'Réessayer',
    qrInconnu: {
      titre: 'QR code introuvable',
      message: 'Ce QR code n’existe pas. Vérifiez qu’il a bien été scanné en entier.',
    },
    qrDesactive: {
      titre: 'QR code désactivé',
      message: 'Ce QR code n’est plus utilisé. Merci de vous adresser au personnel.',
    },
    organisationSuspendue: {
      titre: 'Service indisponible',
      message: 'Ce service est momentanément indisponible. Merci de réessayer plus tard.',
    },
    questionnaireInactif: {
      titre: 'Questionnaire indisponible',
      message: 'Ce questionnaire n’est pas disponible pour le moment.',
    },
    evenementPasCommence: {
      titre: 'Pas encore ouvert',
      message: 'Ce questionnaire n’est pas encore ouvert. Revenez un peu plus tard.',
    },
    evenementTermine: {
      titre: 'Questionnaire terminé',
      message: 'Ce questionnaire est terminé. Merci de votre intérêt !',
    },
    avisDejaDonne: {
      titre: 'Merci, c’est déjà fait !',
      message: 'Vous avez déjà donné votre avis. Merci pour votre participation !',
    },
    horsConnexion: {
      titre: 'Pas de connexion',
      message: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
    },
    tropDeRequetes: {
      titre: 'Un instant',
      message: 'Trop de tentatives. Patientez une minute puis réessayez.',
    },
    generique: {
      titre: 'Une erreur est survenue',
      message: 'Quelque chose s’est mal passé. Merci de réessayer.',
    },
  },
}

export type Textes = typeof fr