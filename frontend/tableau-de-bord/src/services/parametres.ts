import type {
  CorpsModificationParametres,
  ParametresOrganisation,
  ReponseLogo,
  ReponseParametres,
} from '../types/parametres'
import { appeler } from './api'

// Tous les appels de l'ecran E14 (parametres de l'organisation, jour 16), reserves au Responsable.
// Les composants n'appellent jamais fetch directement.

// GET /organisation/parametres : les parametres de MON organisation (prise dans la session).
export async function lireParametres(): Promise<ParametresOrganisation> {
  const reponse = await appeler<ReponseParametres>('/organisation/parametres')
  return reponse.parametres
}

// PATCH /organisation/parametres : seuls les champs envoyes changent (au moins un).
// Erreur 400 si une valeur est hors limites.
export async function modifierParametres(
  corps: CorpsModificationParametres,
): Promise<ParametresOrganisation> {
  const reponse = await appeler<ReponseParametres>('/organisation/parametres', {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
  return reponse.parametres
}

// POST /organisation/logo : envoie le fichier dans le champ "logo" (PNG, JPEG ou WebP, 1 Mo au plus).
// Renvoie la nouvelle adresse du logo. L'ancien fichier est supprime par le serveur.
// Erreurs 400 : LOGO_FORMAT_INVALIDE, LOGO_TROP_VOLUMINEUX, LOGO_MANQUANT, LOGO_INVALIDE.
export async function envoyerLogo(fichier: File): Promise<string | null> {
  const formulaire = new FormData()
  formulaire.append('logo', fichier)
  const reponse = await appeler<ReponseLogo>('/organisation/logo', {
    method: 'POST',
    body: formulaire,
  })
  return reponse.logo_url
}

// DELETE /organisation/logo : retire le logo (reussit aussi s'il n'y en avait pas).
export async function retirerLogo(): Promise<string | null> {
  const reponse = await appeler<ReponseLogo>('/organisation/logo', { method: 'DELETE' })
  return reponse.logo_url
}