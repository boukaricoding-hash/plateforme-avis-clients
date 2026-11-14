import type { OrganisationAdmin } from '../types/admin'
import type { FicheAvis } from '../types/avis'
import type { PointContact, Site } from '../types/sites-points'
import type {
  AccordSupport,
  CorpsAccordSupport,
  DureeAccesSupport,
  FiltresJournal,
  ReponseAccordSupport,
  ReponseAvisSupport,
  ReponseDetailAvisSupport,
  ReponseFicheSupport,
  ReponseIndicateursSupport,
  ReponseJournal,
  ReponsePointsContactSupport,
  ReponseSitesSupport,
  ReponseUtilisateursSupport,
  ReponseVueGlobale,
} from '../types/suivi-dts'
import type { FiltresApi } from '../types/tableau-de-bord'
import type { UtilisateurListe } from '../types/utilisateurs-admin'
import { appeler } from './api'
import type { ParametresListeAvis } from './avis'
import { construireAdresseFiltres } from './tableau-de-bord'

// Tous les appels du jour 24 : journal d'audit, vue globale (ecran E19), accord de support
// (ecran E14) et consultation de support. Les composants n'appellent jamais fetch directement.
// Journal, vue globale et consultation de support sont reserves a l'administrateur DTS
// (le serveur repond 403 ACCES_REFUSE aux autres roles). L'accord est reserve au Responsable.
// Erreurs a afficher en clair :
// - journal : 400 si un filtre est invalide (action inconnue, date mal ecrite, du apres au) ;
// - accord : 400 si la duree n'est pas UNE_HEURE, VINGT_QUATRE_HEURES ou SEPT_JOURS ;
// - consultation : 403 ACCES_SUPPORT_NON_ACCORDE (pas d'accord, accord expire ou retire),
//   404 si l'organisation (ou l'avis) est inconnue.

// Transforme les parametres en "?a=1&b=2". Les valeurs absentes ou vides sont ignorees
// (le serveur refuse une recherche vide). Un booleen s'ecrit true ou false, comme l'attend l'API.
function construireAdresse(parametres: Record<string, string | number | boolean | undefined>): string {
  const adresse = new URLSearchParams()
  for (const [nom, valeur] of Object.entries(parametres)) {
    if (valeur === undefined || valeur === '') {
      continue
    }
    adresse.set(nom, String(valeur))
  }
  const texte = adresse.toString()
  return texte === '' ? '' : `?${texte}`
}

// ------------------------------------------------------------
// Journal d'audit
// ------------------------------------------------------------

// GET /admin/journal-audit : une page du journal (la plus recente d'abord) et la pagination.
export function lireJournal(filtres: FiltresJournal): Promise<ReponseJournal> {
  return appeler<ReponseJournal>(`/admin/journal-audit${construireAdresse(filtres)}`)
}

// ------------------------------------------------------------
// Vue globale (ecran E19)
// ------------------------------------------------------------

// GET /admin/vue-globale : organisations par statut, utilisateurs par role,
// avis par jour (30 jours) et erreurs recentes (7 jours).
export function lireVueGlobale(): Promise<ReponseVueGlobale> {
  return appeler<ReponseVueGlobale>('/admin/vue-globale')
}

// ------------------------------------------------------------
// Accord de support (cote organisation, ecran E14, Responsable seul)
// ------------------------------------------------------------

// GET /organisation/acces-support : l'accord actif de MON organisation, ou null s'il n'y en a pas.
export async function lireAccordSupport(): Promise<AccordSupport | null> {
  const reponse = await appeler<ReponseAccordSupport>('/organisation/acces-support')
  return reponse.acces
}

// POST /organisation/acces-support : donne l'accord pour la duree choisie. Il remplace l'accord
// actif. Chaque accord donne est ecrit dans le journal.
export async function accorderAccesSupport(duree: DureeAccesSupport): Promise<AccordSupport | null> {
  const corps: CorpsAccordSupport = { duree }
  const reponse = await appeler<ReponseAccordSupport>('/organisation/acces-support', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
  return reponse.acces
}

// DELETE /organisation/acces-support : retire l'accord actif. Sans accord actif, le serveur repond
// quand meme 200 : retirer deux fois ne provoque pas d'erreur.
export async function retirerAccesSupport(): Promise<void> {
  await appeler<ReponseAccordSupport>('/organisation/acces-support', { method: 'DELETE' })
}

// ------------------------------------------------------------
// Consultation de support (cote DTS, lecture seule)
// ------------------------------------------------------------

// Chaque lecture ci-dessous verifie l'accord de l'organisation (a chaque requete) et ecrit
// une ligne SUPPORT_CONSULTATION dans le journal. Il n'existe aucune route d'ecriture ici.

// GET /admin/support/organisations/:id : la fiche de l'organisation.
export async function lireFicheSupport(id: string): Promise<OrganisationAdmin> {
  const reponse = await appeler<ReponseFicheSupport>(`/admin/support/organisations/${id}`)
  return reponse.organisation
}

// GET /admin/support/organisations/:id/indicateurs : les memes chiffres que l'accueil du
// tableau de bord. Sans periode, le serveur prend les 30 derniers jours.
export function lireIndicateursSupport(
  id: string,
  filtres: FiltresApi = {},
): Promise<ReponseIndicateursSupport> {
  return appeler<ReponseIndicateursSupport>(
    `/admin/support/organisations/${id}/indicateurs${construireAdresseFiltres(filtres)}`,
  )
}

// GET /admin/support/organisations/:id/avis : une page d'avis, memes filtres que la liste du
// Responsable. Aucune coordonnee de client.
export function listerAvisSupport(id: string, parametres: ParametresListeAvis = {}): Promise<ReponseAvisSupport> {
  return appeler<ReponseAvisSupport>(`/admin/support/organisations/${id}/avis${construireAdresse(parametres)}`)
}

// GET /admin/support/organisations/:id/avis/:avisId : la fiche d'un avis avec ses notes et son
// historique. Les coordonnees du client sont masquees (contact vaut toujours null).
export async function lireAvisSupport(id: string, avisId: string): Promise<FicheAvis> {
  const reponse = await appeler<ReponseDetailAvisSupport>(`/admin/support/organisations/${id}/avis/${avisId}`)
  return reponse.avis
}

// GET /admin/support/organisations/:id/sites
export async function listerSitesSupport(id: string): Promise<Site[]> {
  const reponse = await appeler<ReponseSitesSupport>(`/admin/support/organisations/${id}/sites`)
  return reponse.sites
}

// GET /admin/support/organisations/:id/points-contact
export async function listerPointsContactSupport(id: string): Promise<PointContact[]> {
  const reponse = await appeler<ReponsePointsContactSupport>(`/admin/support/organisations/${id}/points-contact`)
  return reponse.points_contact
}

// GET /admin/support/organisations/:id/utilisateurs : les utilisateurs de l'organisation,
// sans mot de passe.
export async function listerUtilisateursSupport(id: string): Promise<UtilisateurListe[]> {
  const reponse = await appeler<ReponseUtilisateursSupport>(`/admin/support/organisations/${id}/utilisateurs`)
  return reponse.utilisateurs
}
