import type {
  AvisRecent,
  NiveauAlerte,
  StatutTraitement,
  TypeQuestion,
} from './tableau-de-bord'

// Types des ecrans E8 (liste des avis) et E9 (fiche d'un avis), jour 15.
// Ils reproduisent ce que renvoie le backend :
// - GET   /api/v1/avis             : la liste, avec filtres, tri et pagination
// - GET   /api/v1/avis/:id         : la fiche d'un avis
// - PATCH /api/v1/avis/:id/statut  : changer le statut
// - POST  /api/v1/avis/:id/notes   : ajouter une note interne
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// ------------------------------------------------------------
// Valeurs communes
// ------------------------------------------------------------

// Un texte en francais (toujours present) et en anglais (facultatif).
export type TexteMultilingue = {
  fr: string
  en?: string | null
}

// Colonnes sur lesquelles la liste peut etre triee (parametre tri de l'API).
export type TriAvis = 'soumis_le' | 'note_globale' | 'nps'

export type OrdreTri = 'asc' | 'desc'

// Motifs qui declenchent une alerte (enum MotifAlerte du backend).
export type MotifAlerte = 'NOTE_BASSE' | 'NPS_BAS' | 'RAPPEL_DEMANDE'

// ------------------------------------------------------------
// GET /avis (liste)
// ------------------------------------------------------------

// Une ligne de la liste : meme forme que les avis recents de l'accueil.
export type LigneAvis = AvisRecent

export type PaginationAvis = {
  page: number
  limite: number
  total: number
  pages: number
}

export type ReponseListeAvis = {
  avis: LigneAvis[]
  pagination: PaginationAvis
}

// ------------------------------------------------------------
// GET /avis/:id (fiche)
// ------------------------------------------------------------

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

export type QuestionFiche = {
  id: string
  ordre: number
  type: TypeQuestion
  libelle: TexteMultilingue
  options: OptionQuestion[] | null
  echelle_min: number | null
  echelle_max: number | null
  libelles_extremites: { min: TexteMultilingue; max: TexteMultilingue } | null
}

// Reponse a une question. Selon le type, une seule des trois valeurs est remplie :
// - valeur_numerique : etoiles, emojis, NPS, echelle (la note), oui/non (1 = oui, 0 = non)
// - valeur_texte : texte libre
// - valeur_choix : choix unique (un texte) ou choix multiple (une liste de textes)
export type ReponseFiche = {
  id: string
  valeur_numerique: number | null
  valeur_texte: string | null
  valeur_choix: string | string[] | null
  question: QuestionFiche
}

export type TypeSuivi = 'CHANGEMENT_STATUT' | 'NOTE'

// Une ligne de l'historique : un changement de statut ou une note interne.
// ancien_statut et nouveau_statut ne sont remplis que pour un changement de statut.
export type LigneSuivi = {
  id: string
  type: TypeSuivi
  ancien_statut: StatutTraitement | null
  nouveau_statut: StatutTraitement | null
  commentaire: string | null
  // Date ISO complete (UTC).
  cree_le: string
  utilisateur: { id: string; nom: string }
}

export type AlerteAvis = {
  id: string
  niveau: NiveauAlerte
  motifs: MotifAlerte[]
  // Date ISO complete (UTC).
  cree_le: string
}

// Coordonnees du client : l'API les renvoie seulement s'il a coche la case de consentement.
export type ContactAvis = {
  nom: string | null
  telephone: string | null
  email: string | null
}

export type FicheAvis = {
  id: string
  // Date ISO complete (UTC).
  soumis_le: string
  langue: string
  appareil: string | null
  note_globale: number | null
  nps: number | null
  commentaire: string | null
  statut_traitement: StatutTraitement
  consentement: boolean
  site: { id: string; nom: string }
  point_contact: { id: string; nom: string; type: string }
  version: {
    id: string
    numero: number
    questionnaire: { id: string; titre: TexteMultilingue }
  }
  reponses: ReponseFiche[]
  alerte: AlerteAvis | null
  // Du plus recent au plus ancien.
  suivis: LigneSuivi[]
  // null si le client n'a pas consenti.
  contact: ContactAvis | null
}

export type ReponseFicheAvis = {
  avis: FicheAvis
}

// ------------------------------------------------------------
// Actions sur un avis
// ------------------------------------------------------------

// PATCH /avis/:id/statut : corps envoye. Le commentaire est facultatif.
export type CorpsChangementStatut = {
  statut: StatutTraitement
  commentaire?: string
}

// PATCH /avis/:id/statut : reponse (200).
export type ReponseChangementStatut = {
  statut_traitement: StatutTraitement
  suivi: LigneSuivi
}

// POST /avis/:id/notes : corps envoye. La note est obligatoire.
export type CorpsNoteInterne = {
  commentaire: string
}

// POST /avis/:id/notes : reponse (201).
export type ReponseNoteInterne = {
  suivi: LigneSuivi
}