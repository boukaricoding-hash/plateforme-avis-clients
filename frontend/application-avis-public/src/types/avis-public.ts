// Types de l'API publique (jour 9).
// Ils reproduisent ce que renvoie le backend :
// - GET  /api/v1/public/q/{code}       : le questionnaire
// - POST /api/v1/public/q/{code}/avis  : l'envoi d'un avis

export type Langue = 'fr' | 'en'

// Un texte en francais (toujours present) et en anglais (facultatif).
export type TexteMultilingue = {
  fr: string
  en?: string
}

export type TypeQuestion =
  | 'ETOILES'
  | 'EMOJIS'
  | 'NPS'
  | 'CHOIX_UNIQUE'
  | 'CHOIX_MULTIPLE'
  | 'OUI_NON'
  | 'ECHELLE'
  | 'TEXTE_LIBRE'

// Option d'une question a choix : un texte, ou un objet avec valeur, code ou id,
// et le texte a afficher en francais et en anglais.
export type OptionQuestion =
  | string
  | {
      valeur?: string
      code?: string
      id?: string
      fr?: string
      en?: string
    }

export type QuestionPublique = {
  id: string
  ordre: number
  type: TypeQuestion
  libelle: TexteMultilingue
  aide: TexteMultilingue | null
  obligatoire: boolean
  options: OptionQuestion[] | null
  echelle_min: number | null
  echelle_max: number | null
  libelles_extremites: { min: TexteMultilingue; max: TexteMultilingue } | null
}

export type QuestionnairePublic = {
  point_contact: { nom: string; type: string }
  organisation: {
    nom: string
    logo_url: string | null
    couleur_principale: string | null
    langue_defaut: string
  }
  questionnaire: {
    version_id: string
    titre: TexteMultilingue
    message_accueil: TexteMultilingue | null
    message_remerciement: TexteMultilingue | null
    langue_defaut: string
    questions: QuestionPublique[]
  }
}

// Valeur brute d'une reponse, comme l'attend le backend.
export type ValeurReponse = number | boolean | string | string[]

export type ReponseEnvoyee = {
  question_id: string
  valeur: ValeurReponse
}

// Corps du POST d'un avis.
export type CorpsAvis = {
  version_id: string
  langue: Langue
  reponses: ReponseEnvoyee[]
  commentaire?: string
  // Cle unique generee par le telephone : un renvoi ne cree pas de doublon.
  cle_unique?: string
  contact_nom?: string
  contact_tel?: string
  contact_email?: string
  consentement?: boolean
  // Champ piege (anti-robot) : toujours laisse vide.
  site_web?: string
}

export type ReponseCreationAvis = {
  id: string
}

// Erreur renvoyee par le backend : { code, message, details }.
export type DetailErreur = {
  champ: string
  message: string
}

export type ErreurApi = {
  code: string
  message: string
  details: DetailErreur[] | null
}

// Codes d'erreur qui decident quelle page afficher au client.
export const CODES_ERREUR_QR = [
  'QR_INCONNU',
  'QR_DESACTIVE',
  'ORGANISATION_SUSPENDUE',
  'QUESTIONNAIRE_INACTIF',
  'EVENEMENT_PAS_COMMENCE',
  'EVENEMENT_TERMINE',
] as const

export type CodeErreurQr = (typeof CODES_ERREUR_QR)[number]