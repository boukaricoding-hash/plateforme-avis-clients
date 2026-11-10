import type { TexteMultilingue } from './avis'
import type { TypeQuestion } from './tableau-de-bord'

// Types des questionnaires cote tableau de bord (ecran E12 au jour 17, ecran E10 au jour 19).
// Ils reproduisent ce que renvoie le backend :
// - GET  /api/v1/questionnaires                        : { questionnaires } (Responsable et Gestionnaire)
// - GET  /api/v1/questionnaires/:id                    : { questionnaire } (la fiche complete)
// - POST /api/v1/questionnaires                        : 201 { questionnaire }
// - PUT  /api/v1/questionnaires/:id                    : { questionnaire, nouvelle_version }
// - POST /api/v1/questionnaires/:id/dupliquer          : 201 { questionnaire }
// - GET  /api/v1/questionnaires/modeles                : { modeles }
// - POST /api/v1/questionnaires/modeles/:id/cloner     : 201 { questionnaire }
// - GET  /api/v1/questionnaires/themes                 : { themes } (Responsable seulement)
// Creer, modifier, cloner, dupliquer et lire les themes : Responsable seulement.
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// ------------------------------------------------------------
// Valeurs communes
// ------------------------------------------------------------

// Memes valeurs que l'enum StatutQuestionnaire du backend (schema.prisma).
export type StatutQuestionnaire = 'BROUILLON' | 'ACTIF' | 'INACTIF'

// Langues d'un questionnaire acceptees par le backend a l'envoi.
export type LangueQuestionnaire = 'fr' | 'en'

// Derniere version d'un questionnaire ; null = aucune version.
export type VersionQuestionnaire = {
  numero: number
  // null = version pas encore publiee.
  publie_le: string | null
}

// ------------------------------------------------------------
// GET /questionnaires (liste)
// ------------------------------------------------------------

// Une ligne de la liste des questionnaires de l'organisation.
export type ResumeQuestionnaire = {
  id: string
  titre: TexteMultilingue
  statut: StatutQuestionnaire
  langue_defaut: string
  // Dates de l'evenement ; null = pas de limite.
  date_debut: string | null
  date_fin: string | null
  cree_le: string
  modifie_le: string
  version: VersionQuestionnaire | null
  nombre_points_contact: number
}

export type ReponseListeQuestionnaires = {
  questionnaires: ResumeQuestionnaire[]
}

// ------------------------------------------------------------
// GET /questionnaires/modeles
// ------------------------------------------------------------

// Un modele sectoriel : il se clone pour devenir un brouillon de l'organisation.
export type ModeleQuestionnaire = {
  id: string
  titre: TexteMultilingue
  message_accueil: TexteMultilingue | null
  langue_defaut: string
  nombre_questions: number
}

export type ReponseModeles = {
  modeles: ModeleQuestionnaire[]
}

// ------------------------------------------------------------
// GET /questionnaires/themes
// ------------------------------------------------------------

// Un theme du secteur de l'organisation (service, proprete, rapidite...).
export type ThemeSecteur = {
  id: string
  code: string
  libelle_fr: string
  libelle_en: string
}

export type ReponseThemesSecteur = {
  themes: ThemeSecteur[]
}

// ------------------------------------------------------------
// GET /questionnaires/:id (fiche complete)
// ------------------------------------------------------------

export type LibellesExtremites = {
  min: TexteMultilingue
  max: TexteMultilingue
}

// Une question telle que le backend la renvoie.
export type QuestionQuestionnaire = {
  id: string
  ordre: number
  type: TypeQuestion
  libelle: TexteMultilingue
  aide: TexteMultilingue | null
  obligatoire: boolean
  // Seules les questions a choix ont des options.
  options: TexteMultilingue[] | null
  // Etoiles et emojis : 1 a 5, NPS : 0 a 10, echelle : valeurs choisies, autres types : null.
  echelle_min: number | null
  echelle_max: number | null
  libelles_extremites: LibellesExtremites | null
  // null = question sans theme.
  theme: ThemeSecteur | null
}

// La derniere version, avec ses questions dans l'ordre.
export type VersionDetaillee = VersionQuestionnaire & {
  id: string
  questions: QuestionQuestionnaire[]
}

export type PointContactQuestionnaire = {
  id: string
  nom: string
}

export type FicheQuestionnaire = {
  id: string
  titre: TexteMultilingue
  message_accueil: TexteMultilingue | null
  message_remerciement: TexteMultilingue | null
  langue_defaut: string
  statut: StatutQuestionnaire
  date_debut: string | null
  date_fin: string | null
  cree_le: string
  modifie_le: string
  version: VersionDetaillee | null
  // Seulement les points du perimetre de l'utilisateur.
  points_contact: PointContactQuestionnaire[]
}

// Reponse de GET /questionnaires/:id, de POST /questionnaires, du clonage et de la duplication.
export type ReponseQuestionnaire = {
  questionnaire: FicheQuestionnaire
}

// Reponse de PUT /questionnaires/:id.
// nouvelle_version = true : le questionnaire avait deja des avis, une version suivante a ete creee.
export type ReponseModificationQuestionnaire = {
  questionnaire: FicheQuestionnaire
  nouvelle_version: boolean
}

// ------------------------------------------------------------
// Corps envoye a POST et PUT (le backend refuse tout champ en trop)
// ------------------------------------------------------------

// Texte a l'envoi : le francais est obligatoire, l'anglais est absent ou rempli (jamais null).
export type TexteEnvoye = {
  fr: string
  en?: string
}

export type QuestionEnvoyee = {
  type: TypeQuestion
  libelle: TexteEnvoye
  aide?: TexteEnvoye
  obligatoire: boolean
  theme_id?: string | null
  // Obligatoire (au moins 2) pour un choix, interdit pour les autres types.
  options?: TexteEnvoye[]
  // Obligatoires pour une echelle (minimum inferieur au maximum), ignores pour les autres types.
  echelle_min?: number
  echelle_max?: number
  libelles_extremites?: { min: TexteEnvoye; max: TexteEnvoye }
}

// De 1 a 50 questions.
export type CorpsQuestionnaire = {
  titre: TexteEnvoye
  message_accueil?: TexteEnvoye
  message_remerciement?: TexteEnvoye
  langue_defaut: LangueQuestionnaire
  questions: QuestionEnvoyee[]
}

// ------------------------------------------------------------
// Jour 20 : publication, dates, points de contact, versions et suppression
// ------------------------------------------------------------
// - GET    /api/v1/questionnaires/:id/versions        : { versions } (Responsable seulement)
// - POST   /api/v1/questionnaires/:id/publier         : { publication }
// - POST   /api/v1/questionnaires/:id/activer         : { questionnaire: { id, statut } } (409 NON_PUBLIE si jamais publie)
// - POST   /api/v1/questionnaires/:id/desactiver      : { questionnaire: { id, statut } }
// - PUT    /api/v1/questionnaires/:id/dates           : { questionnaire: { id, statut, date_debut, date_fin } }
// - PUT    /api/v1/questionnaires/:id/points-contact  : { points_contact } (la liste complete remplace l'ancienne)
// - DELETE /api/v1/questionnaires/:id                 : { questionnaire: { id }, points_contact_detaches }
//   ou 409 QUESTIONNAIRE_AVEC_AVIS avec details { nombre_avis } (il faut alors le desactiver)

// Une ligne de l'historique : une version, de la plus recente a la plus ancienne.
export type VersionHistorique = {
  id: string
  numero: number
  // null = version pas encore publiee.
  publie_le: string | null
  cree_le: string
  nombre_questions: number
  // Avis recus avec CETTE version (les avis supprimes ne sont pas comptes).
  nombre_avis: number
}

export type ReponseVersions = {
  versions: VersionHistorique[]
}

// Resultat de la publication : la derniere version est publiee et le questionnaire devient actif.
export type PublicationQuestionnaire = {
  id: string
  statut: StatutQuestionnaire
  // Numero de la version publiee.
  version: number
  publie_le: string
}

export type ReponsePublication = {
  publication: PublicationQuestionnaire
}

// Reponse de l'activation et de la desactivation.
export type ReponseStatutQuestionnaire = {
  questionnaire: {
    id: string
    statut: 'ACTIF' | 'INACTIF'
  }
}

// Corps du PUT des dates : les deux dates sont toujours envoyees, null = pas de date.
// Format attendu : 2026-12-01T08:00:00Z (ISO 8601 avec fuseau). La fin doit etre apres le debut.
export type CorpsDatesQuestionnaire = {
  date_debut: string | null
  date_fin: string | null
}

export type ReponseDatesQuestionnaire = {
  questionnaire: {
    id: string
    statut: StatutQuestionnaire
    date_debut: string | null
    date_fin: string | null
  }
}

// Corps du PUT des points de contact : la liste complete (500 au maximum, sans doublon).
// Les points qui ne sont plus dans la liste sont detaches du questionnaire.
export type CorpsPointsContactQuestionnaire = {
  points_contact_ids: string[]
}

// Un point de contact associe, tel que le renvoie le PUT.
export type PointContactAssocie = {
  id: string
  nom: string
  type: string
  site_id: string
}

export type ReponsePointsContactQuestionnaire = {
  points_contact: PointContactAssocie[]
}

// Reponse du DELETE : suppression douce, reservee aux questionnaires sans aucun avis.
export type ReponseSuppressionQuestionnaire = {
  questionnaire: {
    id: string
  }
  // Points de contact visibles qui ont ete detaches du questionnaire.
  points_contact_detaches: number
}

// Details de l'erreur 409 QUESTIONNAIRE_AVEC_AVIS.
export type DetailsQuestionnaireAvecAvis = {
  nombre_avis: number
}
