import type { PaginationAvis, ReponseFicheAvis, ReponseListeAvis } from './avis'
import type { StatutOrganisation, ReponseOrganisation } from './admin'
import type { ReponseListePointsContact, ReponseListeSites } from './sites-points'
import type { ReponseKpis } from './tableau-de-bord'
import type { RoleUtilisateur } from './utilisateur'
import type { UtilisateurListe } from './utilisateurs-admin'

// Types du suivi DTS (jour 24) : journal d'audit, vue globale (ecran E19), accord de support
// et consultation de support en lecture seule.
// Ils reproduisent ce que renvoie le backend (jour 24).
// Cote DTS (reserve a l'administrateur : le serveur repond 403 ACCES_REFUSE aux autres roles) :
// - GET /api/v1/admin/journal-audit                                  : { entrees, pagination }
// - GET /api/v1/admin/vue-globale                                    : la vue globale (ecran E19)
// - GET /api/v1/admin/support/organisations/:id                      : { organisation }
// - GET /api/v1/admin/support/organisations/:id/indicateurs          : les indicateurs (comme le tableau de bord)
// - GET /api/v1/admin/support/organisations/:id/avis                 : { avis, pagination }
// - GET /api/v1/admin/support/organisations/:id/avis/:avisId         : { avis } (contact toujours null)
// - GET /api/v1/admin/support/organisations/:id/sites                : { sites }
// - GET /api/v1/admin/support/organisations/:id/points-contact       : { points_contact }
// - GET /api/v1/admin/support/organisations/:id/utilisateurs         : { utilisateurs }
// Cote organisation (reserve au Responsable, l'organisation vient de la session) :
// - GET    /api/v1/organisation/acces-support  : { acces } (null s'il n'y a pas d'accord actif)
// - POST   /api/v1/organisation/acces-support  : 201 { acces } (remplace l'accord actif)
// - DELETE /api/v1/organisation/acces-support  : { acces: null }
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// ------------------------------------------------------------
// Journal d'audit
// ------------------------------------------------------------

// Les codes d'action du journal, par famille (memes valeurs que le backend).
// Les 28 premiers existaient avant le jour 24 ; le jour 24 ajoute AVIS_STATUT_MODIFIE et les 3 actions du support.
export const GROUPES_ACTIONS_JOURNAL = {
  connexions: [
    'CONNEXION_REUSSIE',
    'CONNEXION_ECHEC',
    'COMPTE_VERROUILLE',
    'DECONNEXION',
    'REINITIALISATION_DEMANDEE',
    'REINITIALISATION_EMAIL_ECHEC',
    'MOT_DE_PASSE_REINITIALISE',
  ],
  utilisateurs: [
    'UTILISATEUR_INVITE',
    'UTILISATEUR_MODIFIE',
    'UTILISATEUR_DESACTIVE',
    'UTILISATEUR_REACTIVE',
    'INVITATION_ACCEPTEE',
    'INVITATION_EMAIL_ECHEC',
  ],
  organisations: [
    'ORGANISATION_CREEE',
    'ORGANISATION_MODIFIEE',
    'ORGANISATION_SUSPENDUE',
    'ORGANISATION_REACTIVEE',
    'PREMIER_RESPONSABLE_INVITE',
    'PARAMETRES_ORGANISATION_MODIFIES',
    'LOGO_ORGANISATION_MODIFIE',
    'LOGO_ORGANISATION_SUPPRIME',
  ],
  secteurs: ['SECTEUR_CREE', 'SECTEUR_MODIFIE', 'THEME_CREE', 'THEME_MODIFIE'],
  exportsEtQr: ['EXPORT_GENERE', 'QR_REVOQUE', 'QR_REGENERE'],
  avis: ['AVIS_STATUT_MODIFIE'],
  support: ['SUPPORT_ACCES_ACCORDE', 'SUPPORT_ACCES_RETIRE', 'SUPPORT_CONSULTATION'],
} as const

export type GroupeActionsJournal = keyof typeof GROUPES_ACTIONS_JOURNAL

// Les 32 actions que le filtre du journal accepte (parametre action de l'API).
export type ActionJournal = (typeof GROUPES_ACTIONS_JOURNAL)[GroupeActionsJournal][number]

// Les 32 actions a la suite, dans l'ordre des familles : sert a verifier qu'un code est connu.
export const ACTIONS_JOURNAL: readonly ActionJournal[] = Object.values(GROUPES_ACTIONS_JOURNAL).flat()

// Details d'une ligne du journal : seulement des valeurs simples. Le serveur retire
// toute cle qui ressemble a un secret (mot de passe, jeton) avant d'envoyer la ligne.
export type DetailsJournal = Record<string, string | number | boolean | null>

// L'auteur de l'action. null = action sans compte (exemple : un echec de connexion sur une adresse inconnue).
export type AuteurJournal = {
  id: string
  email: string
  nom: string
  role: RoleUtilisateur
}

// L'organisation concernee. null = action sans organisation (exemple : connexion de l'administrateur DTS).
export type OrganisationJournal = {
  id: string
  nom: string
}

// Une ligne du journal. cree_le est une date ISO complete (UTC).
// action reste un texte : si le serveur renvoie un code que cette version ne connait pas, l'ecran l'affiche tel quel.
// L'adresse IP n'est jamais envoyee a l'ecran.
export type EntreeJournal = {
  id: string
  action: string
  entite: string | null
  entite_id: string | null
  details: DetailsJournal | null
  cree_le: string
  utilisateur: AuteurJournal | null
  organisation: OrganisationJournal | null
}

// Meme forme que la pagination de la liste des avis.
export type PaginationJournal = PaginationAvis

// GET /admin/journal-audit : la plus recente d'abord.
export type ReponseJournal = {
  entrees: EntreeJournal[]
  pagination: PaginationJournal
}

// Parametres de recherche de GET /admin/journal-audit. Tous sont facultatifs.
export type FiltresJournal = {
  // Morceau de l'adresse e-mail de l'auteur (sans tenir compte des majuscules).
  utilisateur?: string
  action?: ActionJournal
  // Identifiant d'une organisation.
  organisation?: string
  // Jours complets au format AAAA-MM-JJ, bornes comprises. du doit etre avant au.
  du?: string
  au?: string
  page?: number
  // 1 a 100, 20 par defaut.
  limite?: number
}

// ------------------------------------------------------------
// Vue globale de la plateforme (ecran E19)
// ------------------------------------------------------------

// Les trois statuts sont toujours presents, meme a 0.
export type OrganisationsParStatut = {
  total: number
  par_statut: Record<StatutOrganisation, number>
}

// Utilisateurs actifs. Les trois roles sont toujours presents, meme a 0.
export type UtilisateursParRole = {
  total: number
  par_role: Record<RoleUtilisateur, number>
}

// Un point de la courbe : le jour (AAAA-MM-JJ, en UTC) et le nombre d'avis de toute la plateforme.
export type PointAvisParJour = {
  date: string
  nb_avis: number
}

// Un point par jour, y compris les jours sans avis (0) : la courbe n'a pas de trou.
export type AvisParJour = {
  // Nombre de jours de la courbe (30).
  jours: number
  total: number
  points: PointAvisParJour[]
}

// Une erreur recente : une action d'echec du journal (CONNEXION_ECHEC, COMPTE_VERROUILLE,
// INVITATION_EMAIL_ECHEC, REINITIALISATION_EMAIL_ECHEC). Il n'y a pas encore de table d'erreurs du serveur.
export type ErreurRecente = {
  id: string
  action: string
  cree_le: string
  utilisateur_email: string | null
  organisation: OrganisationJournal | null
}

export type ErreursRecentes = {
  // Nombre de jours regardes (7).
  jours: number
  // Les 20 plus recentes au maximum, la plus recente d'abord.
  entrees: ErreurRecente[]
}

// GET /admin/vue-globale
export type ReponseVueGlobale = {
  organisations: OrganisationsParStatut
  utilisateurs: UtilisateursParRole
  avis_par_jour: AvisParJour
  erreurs_recentes: ErreursRecentes
}

// ------------------------------------------------------------
// Accord de support (cote organisation, ecran E14)
// ------------------------------------------------------------

// Les trois durees possibles de l'accord (7 jours au maximum).
export type DureeAccesSupport = 'UNE_HEURE' | 'VINGT_QUATRE_HEURES' | 'SEPT_JOURS'

// Ces valeurs a la suite, dans l'ordre de la plus courte a la plus longue : sert a afficher le choix.
export const DUREES_ACCES_SUPPORT: readonly DureeAccesSupport[] = [
  'UNE_HEURE',
  'VINGT_QUATRE_HEURES',
  'SEPT_JOURS',
]

// Un accord actif (ni retire, ni expire). Les dates sont des chaines ISO.
export type AccordSupport = {
  id: string
  expire_le: string
  cree_le: string
  accorde_par: { id: string; nom: string }
}

// GET, POST et DELETE de /organisation/acces-support. acces vaut null s'il n'y a pas d'accord actif.
export type ReponseAccordSupport = {
  acces: AccordSupport | null
}

// Corps du POST : seule la duree est acceptee, tout autre champ est refuse par le serveur.
export type CorpsAccordSupport = {
  duree: DureeAccesSupport
}

// ------------------------------------------------------------
// Consultation de support (cote DTS, lecture seule)
// ------------------------------------------------------------

// Code d'erreur 403 quand l'organisation n'a pas donne son accord (ou qu'il est expire ou retire).
// Message a afficher : "Cette organisation n'a pas donne son accord."
export const CODE_ACCES_SUPPORT_NON_ACCORDE = 'ACCES_SUPPORT_NON_ACCORDE'

// Les parties qu'on peut consulter. Chaque lecture ecrit une ligne SUPPORT_CONSULTATION
// dans le journal, avec cette partie dans les details (la fiche et l'avis s'appellent "fiche" et "avis").
export type PartieSupport =
  | 'fiche'
  | 'indicateurs'
  | 'avis'
  | 'sites'
  | 'points-contact'
  | 'utilisateurs'

// La consultation reutilise les formes que le Responsable connait deja :
// - la fiche : comme E17 ({ organisation }) ;
// - les indicateurs : comme l'accueil du tableau de bord ;
// - les avis : comme la liste et la fiche d'un avis, avec contact toujours null (coordonnees masquees) ;
// - les sites et les points de contact : comme les ecrans sites et points de contact.
export type ReponseFicheSupport = ReponseOrganisation
export type ReponseIndicateursSupport = ReponseKpis
export type ReponseAvisSupport = ReponseListeAvis
export type ReponseDetailAvisSupport = ReponseFicheAvis
export type ReponseSitesSupport = ReponseListeSites
export type ReponsePointsContactSupport = ReponseListePointsContact

// Les utilisateurs de l'organisation, sans mot de passe. Pas d'invitations en attente ici.
export type ReponseUtilisateursSupport = {
  utilisateurs: UtilisateurListe[]
}
