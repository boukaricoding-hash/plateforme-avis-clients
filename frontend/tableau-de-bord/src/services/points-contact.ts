import type {
  CorpsCreationMasse,
  CorpsCreationPointContact,
  CorpsModificationPointContact,
  PointContact,
  ReponseCreationMasse,
  ReponseListePointsContact,
  ReponsePointContact,
} from '../types/sites-points'
import { appeler } from './api'

// Tous les appels des points de contact (ecran E12, jour 17). Lecture : Responsable et Gestionnaire.
// Ecriture : Responsable seulement (le serveur repond 403 sinon).
// Les composants n'appellent jamais fetch directement.

// GET /points-contact : tous les points, ou ceux d'un seul site avec ?site_id=.
export async function listerPointsContact(siteId?: string): Promise<PointContact[]> {
  const adresse = siteId ? `/points-contact?site_id=${encodeURIComponent(siteId)}` : '/points-contact'
  const reponse = await appeler<ReponseListePointsContact>(adresse)
  return reponse.points_contact
}

// POST /points-contact : cree un point (type "table" par defaut cote serveur).
// Erreur 404 si le site ou le questionnaire n'existe pas dans l'organisation.
export async function creerPointContact(corps: CorpsCreationPointContact): Promise<PointContact> {
  const reponse = await appeler<ReponsePointContact>('/points-contact', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
  return reponse.point_contact
}

// POST /points-contact/masse : cree "Table 1" a "Table N" en une fois (500 au plus).
// Les noms deja existants sont ignores : le resultat donne le nombre de crees et d'ignores.
export function creerPointsContactEnMasse(corps: CorpsCreationMasse): Promise<ReponseCreationMasse> {
  return appeler<ReponseCreationMasse>('/points-contact/masse', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
}

// PATCH /points-contact/:id : seuls les champs envoyes changent (au moins un).
// null retire la zone ou le questionnaire associe.
export async function modifierPointContact(
  id: string,
  corps: CorpsModificationPointContact,
): Promise<PointContact> {
  const reponse = await appeler<ReponsePointContact>(`/points-contact/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
  return reponse.point_contact
}

// POST /points-contact/:id/desactiver : les avis restent lies au point.
export async function desactiverPointContact(id: string): Promise<PointContact> {
  const reponse = await appeler<ReponsePointContact>(`/points-contact/${id}/desactiver`, {
    method: 'POST',
  })
  return reponse.point_contact
}

// POST /points-contact/:id/activer : remet le point en service.
export async function activerPointContact(id: string): Promise<PointContact> {
  const reponse = await appeler<ReponsePointContact>(`/points-contact/${id}/activer`, {
    method: 'POST',
  })
  return reponse.point_contact
}