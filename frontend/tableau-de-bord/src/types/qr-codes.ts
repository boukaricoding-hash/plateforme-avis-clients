import type { PointContact } from './sites-points'

// Types de l'ecran E11 (QR codes et chevalets, jour 17).
// Ils reproduisent ce que renvoie le backend :
// - GET  /api/v1/points-contact/statistiques-qr?site_id=  : { statistiques }
// - POST /api/v1/points-contact/:id/revoquer              : { action, point_contact }
// - GET  /api/v1/points-contact/:id/qr?format=&taille=&largeur=  : un fichier (png, svg ou pdf)
// - GET  /api/v1/points-contact/planche?site_id=          : un fichier PDF A4
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.
// Le code public d'un point de contact n'est jamais affiche : on montre seulement le QR.

// Formats de telechargement d'un QR code.
export const FORMATS_QR = ['png', 'svg', 'pdf'] as const

export type FormatQr = (typeof FORMATS_QR)[number]

// Tailles du chevalet PDF (le PNG et le SVG n'en ont pas).
export const TAILLES_CHEVALET = ['A6', 'A5'] as const

export type TailleChevalet = (typeof TAILLES_CHEVALET)[number]

// Une planche A4 contient 4 chevalets : 200 chevalets = 50 pages au plus.
// Limite reprise du backend : elle sert a prevenir l'utilisateur avant le telechargement.
// Le serveur refait toujours la verification (400 TROP_DE_POINTS).
export const LIMITE_PLANCHE = 200

// Statistiques d'un point de contact depuis sa creation (anciens codes regeneres compris).
export type StatistiquesQr = {
  point_contact_id: string
  nom: string
  site_id: string
  actif: boolean
  revoque: boolean
  nb_scans: number
  nb_avis: number
  // Avis envoyes divises par scans, en pourcentage ; null = aucun scan (afficher "—", jamais 0).
  taux_conversion: number | null
}

export type ReponseStatistiquesQr = {
  statistiques: StatistiquesQr[]
}

// Corps de la revocation : sans "regenerer" (ou a false), le QR est seulement revoque.
// - revoque : le chevalet deja imprime affiche la page "QR code desactive" ;
// - regenere : un nouveau code remplace l'ancien, le chevalet deja imprime n'est plus reconnu.
// Regenerer est aussi le seul moyen de remettre en service un QR revoque.
export type CorpsRevocationQr = {
  regenerer?: boolean
}

export type ActionRevocationQr = 'revoque' | 'regenere'

export type ReponseRevocationQr = {
  action: ActionRevocationQr
  point_contact: {
    id: string
    nom: string
    site_id: string
    actif: boolean
    revoque: boolean
    revoque_le: string | null
  }
}

// Une ligne de l'ecran E11 : le point de contact et ses chiffres.
// statistiques est null si le point n'apparait pas (encore) dans la reponse des statistiques.
export type LigneQr = {
  point: PointContact
  statistiques: StatistiquesQr | null
}