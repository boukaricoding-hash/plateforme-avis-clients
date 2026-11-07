import type { TexteMultilingue } from './avis'

// Types de l'ecran E12 (sites et points de contact, jour 17).
// Ils reproduisent ce que renvoie le backend :
// - GET   /api/v1/sites                         : { sites }
// - POST  /api/v1/sites                         : 201 { site }
// - PATCH /api/v1/sites/:id                     : { site }
// - POST  /api/v1/sites/:id/desactiver          : { site }
// - POST  /api/v1/sites/:id/activer             : { site }
// - GET   /api/v1/points-contact?site_id=       : { points_contact }
// - POST  /api/v1/points-contact                : 201 { point_contact }
// - POST  /api/v1/points-contact/masse          : 201 { crees, deja_existants }
// - PATCH /api/v1/points-contact/:id            : { point_contact }
// - POST  /api/v1/points-contact/:id/desactiver : { point_contact }
// - POST  /api/v1/points-contact/:id/activer    : { point_contact }
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// ------------------------------------------------------------
// Sites
// ------------------------------------------------------------

export type Site = {
  id: string
  nom: string
  adresse: string | null
  ville: string | null
  telephone: string | null
  actif: boolean
  cree_le: string
}

export type ReponseListeSites = {
  sites: Site[]
}

export type ReponseSite = {
  site: Site
}

// Creation : seul le nom est obligatoire. Un champ absent n'est pas envoye.
export type CorpsCreationSite = {
  nom: string
  adresse?: string
  ville?: string
  telephone?: string
}

// Modification : au moins un champ. null efface l'adresse, la ville ou le telephone.
export type CorpsModificationSite = {
  nom?: string
  adresse?: string | null
  ville?: string | null
  telephone?: string | null
}

// ------------------------------------------------------------
// Points de contact
// ------------------------------------------------------------

// Liste fixe des types (decision du jour 17) ; le vocabulaire par secteur viendra au jour 22.
export const TYPES_POINT_CONTACT = ['table', 'chambre', 'service', 'salle', 'stand'] as const

export type TypePointContact = (typeof TYPES_POINT_CONTACT)[number]

export type PointContact = {
  id: string
  site_id: string
  // null = aucun questionnaire associe.
  questionnaire_id: string | null
  nom: string
  // Le backend accepte un texte libre : on le garde en string.
  type: string
  zone: string | null
  // Code du QR : renvoye par l'API mais jamais affiche dans les ecrans.
  code_public: string
  actif: boolean
  // Date de revocation du QR ; null = QR valide.
  revoque_le: string | null
  cree_le: string
  // Titre du questionnaire associe, null si aucun.
  questionnaire: { titre: TexteMultilingue } | null
}

export type ReponseListePointsContact = {
  points_contact: PointContact[]
}

export type ReponsePointContact = {
  point_contact: PointContact
}

export type CorpsCreationPointContact = {
  site_id: string
  nom: string
  type?: string
  zone?: string
  questionnaire_id?: string
}

// null retire la zone ou le questionnaire associe.
export type CorpsModificationPointContact = {
  nom?: string
  type?: string
  zone?: string | null
  questionnaire_id?: string | null
}

// Creation en masse : "Table 1" a "Table 40". 500 points au plus a la fois.
export type CorpsCreationMasse = {
  site_id: string
  prefixe?: string
  type?: string
  debut?: number
  fin: number
  questionnaire_id?: string
}

export type ReponseCreationMasse = {
  crees: number
  deja_existants: number
}

// Limite reprise du backend : elle sert a prevenir l'utilisateur avant l'envoi.
// Le serveur refait toujours la verification.
export const MAX_POINTS_EN_MASSE = 500