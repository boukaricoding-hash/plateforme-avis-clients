import type {
  CorpsQuestionnaire,
  FicheQuestionnaire,
  ModeleQuestionnaire,
  ReponseListeQuestionnaires,
  ReponseModeles,
  ReponseModificationQuestionnaire,
  ReponseQuestionnaire,
  ReponseThemesSecteur,
  ResumeQuestionnaire,
  ThemeSecteur,
} from '../types/questionnaires'
import { appeler } from './api'

// Tous les appels des questionnaires (liste utilisee par l'ecran E12 au jour 17,
// puis ecran E10 : liste et editeur au jour 19).
// Lecture : Responsable et Gestionnaire. Creation, modification, clonage, duplication et
// themes : Responsable seulement (le serveur repond 403 sinon).
// Les composants n'appellent jamais fetch directement.

// GET /questionnaires : les questionnaires de MON organisation (les modeles sectoriels n'y sont pas).
export async function listerQuestionnaires(): Promise<ResumeQuestionnaire[]> {
  const reponse = await appeler<ReponseListeQuestionnaires>('/questionnaires')
  return reponse.questionnaires
}

// GET /questionnaires/:id : la fiche complete (questions de la derniere version, points de contact).
// Erreur 404 si le questionnaire n'existe pas dans l'organisation.
export async function lireQuestionnaire(id: string): Promise<FicheQuestionnaire> {
  const reponse = await appeler<ReponseQuestionnaire>(`/questionnaires/${id}`)
  return reponse.questionnaire
}

// POST /questionnaires : cree un brouillon (version 1) a partir du contenu envoye.
// Erreur 400 si le contenu est invalide (titre, questions, options, echelle, theme).
export async function creerQuestionnaire(corps: CorpsQuestionnaire): Promise<FicheQuestionnaire> {
  const reponse = await appeler<ReponseQuestionnaire>('/questionnaires', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
  return reponse.questionnaire
}

// PUT /questionnaires/:id : on renvoie TOUT le contenu.
// nouvelle_version vaut true si le questionnaire avait deja des avis : une version suivante
// est alors creee et les anciens avis restent lies a l'ancienne.
export function modifierQuestionnaire(
  id: string,
  corps: CorpsQuestionnaire,
): Promise<ReponseModificationQuestionnaire> {
  return appeler<ReponseModificationQuestionnaire>(`/questionnaires/${id}`, {
    method: 'PUT',
    body: JSON.stringify(corps),
  })
}

// GET /questionnaires/modeles : les modeles du secteur de l'organisation.
export async function listerModeles(): Promise<ModeleQuestionnaire[]> {
  const reponse = await appeler<ReponseModeles>('/questionnaires/modeles')
  return reponse.modeles
}

// POST /questionnaires/modeles/:id/cloner : copie un modele en nouveau brouillon.
export async function clonerModele(id: string): Promise<FicheQuestionnaire> {
  const reponse = await appeler<ReponseQuestionnaire>(`/questionnaires/modeles/${id}/cloner`, {
    method: 'POST',
  })
  return reponse.questionnaire
}

// POST /questionnaires/:id/dupliquer : copie un questionnaire de l'organisation en brouillon.
export async function dupliquerQuestionnaire(id: string): Promise<FicheQuestionnaire> {
  const reponse = await appeler<ReponseQuestionnaire>(`/questionnaires/${id}/dupliquer`, {
    method: 'POST',
  })
  return reponse.questionnaire
}

// GET /questionnaires/themes : les themes du secteur de l'organisation, pour rattacher une question.
export async function listerThemes(): Promise<ThemeSecteur[]> {
  const reponse = await appeler<ReponseThemesSecteur>('/questionnaires/themes')
  return reponse.themes
}