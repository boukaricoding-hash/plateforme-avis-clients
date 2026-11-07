import type {
  CorpsCreationSite,
  CorpsModificationSite,
  ReponseListeSites,
  ReponseSite,
  Site,
} from '../types/sites-points'
import { appeler } from './api'

// Tous les appels des sites (ecran E12, jour 17). Lecture : Responsable et Gestionnaire.
// Ecriture : Responsable seulement (le serveur repond 403 sinon).
// Les composants n'appellent jamais fetch directement.

// GET /sites : les sites de MON organisation (un Gestionnaire ne voit que les siens).
export async function listerSites(): Promise<Site[]> {
  const reponse = await appeler<ReponseListeSites>('/sites')
  return reponse.sites
}

// POST /sites : cree un site. Seul le nom est obligatoire.
export async function creerSite(corps: CorpsCreationSite): Promise<Site> {
  const reponse = await appeler<ReponseSite>('/sites', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
  return reponse.site
}

// PATCH /sites/:id : seuls les champs envoyes changent (au moins un).
// null efface l'adresse, la ville ou le telephone.
export async function modifierSite(id: string, corps: CorpsModificationSite): Promise<Site> {
  const reponse = await appeler<ReponseSite>(`/sites/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
  return reponse.site
}

// POST /sites/:id/desactiver : les avis restent lies au site.
export async function desactiverSite(id: string): Promise<Site> {
  const reponse = await appeler<ReponseSite>(`/sites/${id}/desactiver`, { method: 'POST' })
  return reponse.site
}

// POST /sites/:id/activer : remet seulement le site en service.
// Les points de contact du site gardent leur propre statut.
export async function activerSite(id: string): Promise<Site> {
  const reponse = await appeler<ReponseSite>(`/sites/${id}/activer`, { method: 'POST' })
  return reponse.site
}