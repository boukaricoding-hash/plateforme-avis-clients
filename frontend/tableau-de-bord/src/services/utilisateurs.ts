import type {
  CorpsInvitation,
  CorpsModificationUtilisateur,
  ReponseInvitation,
  ReponseListeUtilisateurs,
  ReponseUtilisateur,
  UtilisateurListe,
} from '../types/utilisateurs-admin'
import { appeler } from './api'

// Tous les appels de l'ecran E13 (utilisateurs, jour 18).
// Toutes ces routes sont reservees au Responsable (le serveur repond 403 au Gestionnaire).
// Les composants n'appellent jamais fetch directement.

// GET /utilisateurs : les utilisateurs de MON organisation (actifs ou non)
// et les invitations en attente.
export async function listerUtilisateurs(): Promise<ReponseListeUtilisateurs> {
  return appeler<ReponseListeUtilisateurs>('/utilisateurs')
}

// POST /utilisateurs/inviter : cree l'invitation et envoie l'e-mail.
// Une invitation deja en attente pour la meme adresse est remplacee (sert aussi de renvoi).
// email_envoye vaut false si le serveur d'e-mails a refuse : l'invitation existe quand meme.
export async function inviterUtilisateur(corps: CorpsInvitation): Promise<ReponseInvitation> {
  return appeler<ReponseInvitation>('/utilisateurs/inviter', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
}

// PATCH /utilisateurs/:id : change le role et/ou les sites.
// Le serveur refuse de modifier son propre compte (403 ACTION_SUR_SOI_INTERDITE).
export async function modifierUtilisateur(
  id: string,
  corps: CorpsModificationUtilisateur,
): Promise<UtilisateurListe> {
  const reponse = await appeler<ReponseUtilisateur>(`/utilisateurs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
  return reponse.utilisateur
}

// POST /utilisateurs/:id/desactiver : l'utilisateur ne peut plus se connecter,
// son historique est conserve. Refuse sur son propre compte (403 ACTION_SUR_SOI_INTERDITE).
export async function desactiverUtilisateur(id: string): Promise<UtilisateurListe> {
  const reponse = await appeler<ReponseUtilisateur>(`/utilisateurs/${id}/desactiver`, {
    method: 'POST',
  })
  return reponse.utilisateur
}

// POST /utilisateurs/:id/activer : remet le compte en service.
export async function activerUtilisateur(id: string): Promise<UtilisateurListe> {
  const reponse = await appeler<ReponseUtilisateur>(`/utilisateurs/${id}/activer`, {
    method: 'POST',
  })
  return reponse.utilisateur
}