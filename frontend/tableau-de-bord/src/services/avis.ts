import type {
  CorpsChangementStatut,
  FicheAvis,
  LigneSuivi,
  OrdreTri,
  ReponseChangementStatut,
  ReponseFicheAvis,
  ReponseListeAvis,
  ReponseNoteInterne,
  TriAvis,
} from '../types/avis'
import type { StatutTraitement } from '../types/tableau-de-bord'
import { appeler } from './api'

// Tous les appels des ecrans E8 et E9 (jour 15). Les composants n'appellent jamais fetch directement.

// Filtres, tri et pagination de la liste : memes noms que dans l'adresse de l'API
// (et que dans l'adresse de la page /avis). Un parametre absent ou vide n'est pas envoye.
export type ParametresListeAvis = {
  from?: string
  to?: string
  site?: string
  point?: string
  questionnaire?: string
  statut?: StatutTraitement
  // Recherche dans le commentaire.
  q?: string
  // Avis qui ont declenche une alerte.
  negatifs?: boolean
  avec_commentaire?: boolean
  note_min?: number
  note_max?: number
  tri?: TriAvis
  ordre?: OrdreTri
  page?: number
  limite?: number
}

// Transforme les parametres en "?a=1&b=2". Les valeurs absentes ou vides sont ignorees.
// Un booleen s'ecrit true ou false, comme l'attend l'API.
function construireAdresseListe(parametres: ParametresListeAvis): string {
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
// Liste et fiche
// ------------------------------------------------------------

// GET /avis : une page d'avis et la pagination.
export function listerAvis(parametres: ParametresListeAvis): Promise<ReponseListeAvis> {
  return appeler<ReponseListeAvis>(`/avis${construireAdresseListe(parametres)}`)
}

// GET /avis/:id : la fiche complete (404 si l'avis n'existe pas ou n'est pas accessible).
export async function lireFicheAvis(id: string): Promise<FicheAvis> {
  const reponse = await appeler<ReponseFicheAvis>(`/avis/${encodeURIComponent(id)}`)
  return reponse.avis
}

// ------------------------------------------------------------
// Suivi d'un avis
// ------------------------------------------------------------

// PATCH /avis/:id/statut : change le statut. Le commentaire est facultatif.
// 409 si l'avis a deja ce statut, ou si quelqu'un vient de le changer.
export function changerStatutAvis(
  id: string,
  corps: CorpsChangementStatut,
): Promise<ReponseChangementStatut> {
  return appeler<ReponseChangementStatut>(`/avis/${encodeURIComponent(id)}/statut`, {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
}

// POST /avis/:id/notes : ajoute une note interne et renvoie la ligne d'historique creee.
export async function ajouterNoteAvis(id: string, commentaire: string): Promise<LigneSuivi> {
  const reponse = await appeler<ReponseNoteInterne>(`/avis/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ commentaire }),
  })
  return reponse.suivi
}