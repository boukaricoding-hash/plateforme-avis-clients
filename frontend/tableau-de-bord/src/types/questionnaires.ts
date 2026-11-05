import type { TexteMultilingue } from './avis'

// Types des questionnaires cote tableau de bord.
// Ils reproduisent ce que renvoie le backend :
// - GET /api/v1/questionnaires : { questionnaires } (Responsable et Gestionnaire)
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// Memes valeurs que l'enum StatutQuestionnaire du backend (schema.prisma).
export type StatutQuestionnaire = 'BROUILLON' | 'ACTIF' | 'INACTIF'

// Derniere version d'un questionnaire ; null = aucune version.
export type VersionQuestionnaire = {
  numero: number
  // null = version pas encore publiee.
  publie_le: string | null
}

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