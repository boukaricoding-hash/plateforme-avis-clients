import type {
  NotificationRecue,
  PreferencesNotifications,
  ReponseListeNotifications,
  ReponseNotificationLue,
  ReponsePreferencesNotifications,
} from '../types/notifications'
import { appeler } from './api'

// Tous les appels de la cloche et des preferences de notification (jour 16).
// Les composants n'appellent jamais fetch directement.

// Filtre et pagination de la liste : memes noms que dans l'adresse de l'API.
export type ParametresListeNotifications = {
  // true : seulement les non lues. false : seulement les lues. Absent : toutes.
  non_lues?: boolean
  page?: number
  limite?: number
}

// Transforme les parametres en "?a=1&b=2". Les valeurs absentes sont ignorees.
// Un booleen s'ecrit true ou false, comme l'attend l'API.
function construireAdresse(parametres: ParametresListeNotifications): string {
  const adresse = new URLSearchParams()
  for (const [nom, valeur] of Object.entries(parametres)) {
    if (valeur === undefined) {
      continue
    }
    adresse.set(nom, String(valeur))
  }
  const texte = adresse.toString()
  return texte === '' ? '' : `?${texte}`
}

// GET /notifications : MES notifications (la plus recente d'abord), le compteur de non lues
// (qui ne depend pas du filtre) et la pagination.
export function listerNotifications(
  parametres: ParametresListeNotifications,
): Promise<ReponseListeNotifications> {
  return appeler<ReponseListeNotifications>(`/notifications${construireAdresse(parametres)}`)
}

// POST /notifications/:id/lue : marque la notification comme lue (sans effet si elle l'est deja).
// 404 si elle n'existe pas ou n'est pas a moi.
export async function marquerNotificationLue(id: string): Promise<NotificationRecue> {
  const reponse = await appeler<ReponseNotificationLue>(
    `/notifications/${encodeURIComponent(id)}/lue`,
    { method: 'POST' },
  )
  return reponse.notification
}

// GET /notifications/preferences : MES preferences (jamais celles d'un autre).
export async function lirePreferencesNotifications(): Promise<PreferencesNotifications> {
  const reponse = await appeler<ReponsePreferencesNotifications>('/notifications/preferences')
  return reponse.preferences
}

// PATCH /notifications/preferences : alertes groupees (un resume par jour a 08h00)
// ou immediates (un e-mail par avis negatif).
export async function modifierPreferencesNotifications(
  alertesGroupees: boolean,
): Promise<PreferencesNotifications> {
  const reponse = await appeler<ReponsePreferencesNotifications>('/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ alertes_groupees: alertesGroupees }),
  })
  return reponse.preferences
}