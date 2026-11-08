import type {
  CorpsDatesQuestionnaire,
  CorpsPointsContactQuestionnaire,
  CorpsQuestionnaire,
  FicheQuestionnaire,
  ModeleQuestionnaire,
  PointContactAssocie,
  PublicationQuestionnaire,
  ReponseDatesQuestionnaire,
  ReponseListeQuestionnaires,
  ReponseModeles,
  ReponseModificationQuestionnaire,
  ReponsePointsContactQuestionnaire,
  ReponsePublication,
  ReponseQuestionnaire,
  ReponseStatutQuestionnaire,
  ReponseSuppressionQuestionnaire,
  ReponseThemesSecteur,
  ReponseVersions,
  ResumeQuestionnaire,
  ThemeSecteur,
  VersionHistorique,
} from '../types/questionnaires'
import { appeler } from './api'

// Tous les appels des questionnaires (liste utilisee par l'ecran E12 au jour 17,
// puis ecran E10 : liste et editeur au jour 19, publication et versions au jour 20).
// Lecture : Responsable et Gestionnaire. Creation, modification, clonage, duplication, themes,
// publication, activation, dates, points de contact, versions et suppression :
// Responsable seulement (le serveur repond 403 sinon).
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

// ------------------------------------------------------------
// Jour 20 : publication, activation, dates, points de contact, versions, suppression
// ------------------------------------------------------------

// POST /questionnaires/:id/publier : publie la derniere version et active le questionnaire.
// Erreur 404 si le questionnaire n'existe pas dans l'organisation.
export async function publierQuestionnaire(id: string): Promise<PublicationQuestionnaire> {
  const reponse = await appeler<ReponsePublication>(`/questionnaires/${id}/publier`, {
    method: 'POST',
  })
  return reponse.publication
}

// POST /questionnaires/:id/activer : reactive un questionnaire desactive.
// Erreur 409 (code NON_PUBLIE) si sa derniere version n'a jamais ete publiee.
export function activerQuestionnaire(id: string): Promise<ReponseStatutQuestionnaire> {
  return appeler<ReponseStatutQuestionnaire>(`/questionnaires/${id}/activer`, {
    method: 'POST',
  })
}

// POST /questionnaires/:id/desactiver : les avis et les versions sont conserves.
export function desactiverQuestionnaire(id: string): Promise<ReponseStatutQuestionnaire> {
  return appeler<ReponseStatutQuestionnaire>(`/questionnaires/${id}/desactiver`, {
    method: 'POST',
  })
}

// PUT /questionnaires/:id/dates : on envoie toujours les deux dates, null = pas de date.
// Erreur 400 si la date de fin n'est pas apres la date de debut.
export async function modifierDatesQuestionnaire(
  id: string,
  corps: CorpsDatesQuestionnaire,
): Promise<ReponseDatesQuestionnaire['questionnaire']> {
  const reponse = await appeler<ReponseDatesQuestionnaire>(`/questionnaires/${id}/dates`, {
    method: 'PUT',
    body: JSON.stringify(corps),
  })
  return reponse.questionnaire
}

// PUT /questionnaires/:id/points-contact : la liste complete des points de contact du questionnaire.
// Ceux qui ne sont plus dans la liste sont detaches. Erreur 404 si un point n'existe pas.
export async function associerPointsContact(
  id: string,
  pointsContactIds: string[],
): Promise<PointContactAssocie[]> {
  const corps: CorpsPointsContactQuestionnaire = { points_contact_ids: pointsContactIds }
  const reponse = await appeler<ReponsePointsContactQuestionnaire>(
    `/questionnaires/${id}/points-contact`,
    {
      method: 'PUT',
      body: JSON.stringify(corps),
    },
  )
  return reponse.points_contact
}

// GET /questionnaires/:id/versions : l'historique, de la plus recente a la plus ancienne.
export async function listerVersions(id: string): Promise<VersionHistorique[]> {
  const reponse = await appeler<ReponseVersions>(`/questionnaires/${id}/versions`)
  return reponse.versions
}

// DELETE /questionnaires/:id : suppression douce, seulement si aucun avis n'a ete recu.
// Erreur 409 (code QUESTIONNAIRE_AVEC_AVIS, details { nombre_avis }) sinon : il faut le desactiver.
export function supprimerQuestionnaire(id: string): Promise<ReponseSuppressionQuestionnaire> {
  return appeler<ReponseSuppressionQuestionnaire>(`/questionnaires/${id}`, {
    method: 'DELETE',
  })
}