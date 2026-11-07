import type {
  CorpsRevocationQr,
  FormatQr,
  ReponseRevocationQr,
  ReponseStatistiquesQr,
  StatistiquesQr,
  TailleChevalet,
} from '../types/qr-codes'
import { appeler } from './api'

// Tous les appels de l'ecran E11 (QR codes et chevalets, jour 17).
// Lecture et telechargement : Responsable et Gestionnaire. Revoquer ou regenerer : Responsable
// seulement (le serveur repond 403 sinon).
// Les composants n'appellent jamais fetch directement.

// Meme prefixe que dans api.ts : les telechargements sont de simples liens, le navigateur envoie
// le cookie de session tout seul sur la meme adresse.
const BASE = '/api/v1'

// GET /points-contact/statistiques-qr : scans, avis et taux de conversion de chaque point.
// Tous les points de l'organisation, ou ceux d'un seul site avec ?site_id=.
export async function listerStatistiquesQr(siteId?: string): Promise<StatistiquesQr[]> {
  const adresse = siteId
    ? `/points-contact/statistiques-qr?site_id=${encodeURIComponent(siteId)}`
    : '/points-contact/statistiques-qr'
  const reponse = await appeler<ReponseStatistiquesQr>(adresse)
  return reponse.statistiques
}

// POST /points-contact/:id/revoquer : sans ou avec regenerer = false, le QR est seulement revoque
// (le chevalet imprime affiche "QR code desactive") ; avec regenerer = true, un nouveau code
// remplace l'ancien (le chevalet imprime n'est plus reconnu). L'historique des avis est conserve.
// Erreur 404 si le point n'existe pas dans l'organisation.
export function revoquerQr(
  pointContactId: string,
  regenerer: boolean,
): Promise<ReponseRevocationQr> {
  const corps: CorpsRevocationQr = { regenerer }
  return appeler<ReponseRevocationQr>(
    `/points-contact/${encodeURIComponent(pointContactId)}/revoquer`,
    {
      method: 'POST',
      body: JSON.stringify(corps),
    },
  )
}

type OptionsAdresseQr = {
  // Taille du chevalet : utilisee seulement pour le PDF.
  taille?: TailleChevalet
  // Largeur de l'image en pixels (256 a 2048) : utilisee seulement pour le PNG.
  largeur?: number
}

// Adresse du QR d'un point de contact : apercu (<img>) ou telechargement (<a download>).
// Le serveur repond 409 QR_REVOQUE si le QR est revoque : la page ne propose alors aucun lien.
export function adresseQr(
  pointContactId: string,
  format: FormatQr,
  options: OptionsAdresseQr = {},
): string {
  const parametres = new URLSearchParams({ format })
  if (format === 'pdf' && options.taille !== undefined) {
    parametres.set('taille', options.taille)
  }
  if (format === 'png' && options.largeur !== undefined) {
    parametres.set('largeur', String(options.largeur))
  }
  return `${BASE}/points-contact/${encodeURIComponent(pointContactId)}/qr?${parametres.toString()}`
}

// Adresse de la planche A4 (PDF) : tous les chevalets actifs et non revoques, ou ceux d'un site.
// Le serveur repond 404 s'il n'y en a aucun et 400 TROP_DE_POINTS au-dela de 200 :
// la page previent avant, en comptant les points concernes.
export function adressePlanche(siteId?: string): string {
  return siteId
    ? `${BASE}/points-contact/planche?site_id=${encodeURIComponent(siteId)}`
    : `${BASE}/points-contact/planche`
}