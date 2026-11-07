import type {
  CorpsAcceptationInvitation,
  ReponseAcceptationInvitation,
  ReponseVerificationInvitation,
} from '../types/utilisateurs-admin'
import { appeler } from './api'

// Les deux appels de la page publique /invitation (jour 18).
// L'invite n'a pas encore de compte : aucune connexion n'est exigee,
// le serveur limite seulement le nombre de requetes par adresse IP.
// Les composants n'appellent jamais fetch directement.

// GET /invitations/verifier?jeton= : renvoie l'e-mail, l'organisation et le role.
// Erreurs : 400 LIEN_INVALIDE (inconnu, expire ou deja utilise) ou SITES_INDISPONIBLES.
// Le jeton passe par encodeURIComponent : il peut contenir des caracteres speciaux.
export async function verifierInvitation(jeton: string): Promise<ReponseVerificationInvitation> {
  return appeler<ReponseVerificationInvitation>(
    `/invitations/verifier?jeton=${encodeURIComponent(jeton)}`,
  )
}

// POST /invitations/accepter : cree le compte. L'invite n'est pas connecte ensuite,
// il est renvoye vers la page de connexion.
// Erreurs : 400 LIEN_INVALIDE, SITES_INDISPONIBLES, MOT_DE_PASSE_INVALIDE, DONNEES_INVALIDES.
export async function accepterInvitation(
  corps: CorpsAcceptationInvitation,
): Promise<ReponseAcceptationInvitation> {
  return appeler<ReponseAcceptationInvitation>('/invitations/accepter', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
}