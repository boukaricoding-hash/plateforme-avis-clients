// Types de l'ecran E14 (parametres de l'organisation, jour 16).
// Ils reproduisent ce que renvoie le backend (reserve au Responsable) :
// - GET   /api/v1/organisation/parametres : les parametres de l'organisation
// - PATCH /api/v1/organisation/parametres : changer la couleur ou les seuils d'alerte
// - POST  /api/v1/organisation/logo       : envoyer le logo (fichier, champ "logo")
// - DELETE /api/v1/organisation/logo      : retirer le logo
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

export type ParametresOrganisation = {
  nom: string
  // Adresse du logo (par exemple /api/v1/logos/xxxx.png) ; null = pas de logo.
  logo_url: string | null
  // Couleur au format #RRGGBB ; null = couleur par defaut.
  couleur_principale: string | null
  // Un avis alerte si sa note est inferieure ou egale a ce seuil.
  seuil_alerte_note: number
  // Un avis alerte si son NPS est inferieur ou egal a ce seuil.
  seuil_alerte_nps: number
}

export type ReponseParametres = {
  parametres: ParametresOrganisation
}

// Seuls les champs a changer sont envoyes (au moins un). couleur_principale a null efface la couleur.
export type CorpsModificationParametres = {
  couleur_principale?: string | null
  seuil_alerte_note?: number
  seuil_alerte_nps?: number
}

// Reponse de POST et DELETE /organisation/logo.
export type ReponseLogo = {
  logo_url: string | null
}

// Limites reprises du backend : elles servent a prevenir l'utilisateur avant l'envoi.
// Le serveur refait toujours la verification (un fichier trop gros ou faux est refuse quand meme).
export const SEUIL_NOTE_MIN = 1
export const SEUIL_NOTE_MAX = 4
export const SEUIL_NPS_MIN = 0
export const SEUIL_NPS_MAX = 9
export const TAILLE_MAX_LOGO = 1024 * 1024
export const TYPES_LOGO_ACCEPTES = ['image/png', 'image/jpeg', 'image/webp']