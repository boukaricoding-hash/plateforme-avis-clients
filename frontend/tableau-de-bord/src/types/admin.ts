import type { TexteMultilingue } from './avis'
import type { LibellesExtremites, StatutQuestionnaire } from './questionnaires'
import type { TypeQuestion } from './tableau-de-bord'
import type { ReponseInvitation } from './utilisateurs-admin'

// Types du back-office DTS (ecran E17 organisations et ecran E18 modeles sectoriels, jour 23).
// Ils reproduisent ce que renvoie le backend (jour 22). Toutes ces routes sont reservees
// a l'administrateur DTS : le serveur repond 403 aux autres roles.
// - GET   /api/v1/admin/organisations                          : { organisations, pagination }
// - POST  /api/v1/admin/organisations                          : 201 { organisation, questionnaire_id }
// - GET   /api/v1/admin/organisations/:id                      : { organisation }
// - PATCH /api/v1/admin/organisations/:id                      : { organisation }
// - POST  /api/v1/admin/organisations/:id/suspendre            : { organisation }
// - POST  /api/v1/admin/organisations/:id/reactiver            : { organisation }
// - POST  /api/v1/admin/organisations/:id/inviter-responsable  : 201 { invitation, email_envoye }
// - GET   /api/v1/admin/secteurs                               : { secteurs }
// - POST  /api/v1/admin/secteurs                               : 201 { secteur }
// - GET   /api/v1/admin/secteurs/:id                           : { secteur }
// - PATCH /api/v1/admin/secteurs/:id                           : { secteur }
// - POST  /api/v1/admin/secteurs/:id/themes                    : 201 { theme }
// - PATCH /api/v1/admin/secteurs/:id/themes/:themeId           : { theme }
// - GET   /api/v1/admin/secteurs/:id/questionnaires-types      : { questionnaires_types }
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// ------------------------------------------------------------
// Organisations (ecran E17)
// ------------------------------------------------------------

// Memes valeurs que l'enum StatutOrganisation du backend (schema.prisma).
export type StatutOrganisation = 'ESSAI' | 'ACTIF' | 'SUSPENDU'

// Statuts qu'on peut choisir a la creation : la suspension a ses propres routes.
export type StatutCreationOrganisation = Exclude<StatutOrganisation, 'SUSPENDU'>

// Langues par defaut acceptees par le backend a l'envoi.
export type LangueOrganisation = 'fr' | 'en'

// Le secteur d'une organisation, tel que la liste et la fiche le renvoient.
export type SecteurOrganisation = {
  id: string
  code: string
  nom_fr: string
  nom_en: string
}

// Une organisation cliente. Les dates sont des chaines ISO.
export type OrganisationAdmin = {
  id: string
  nom: string
  // null = pas de logo : le premier responsable l'ajoute dans l'ecran E14.
  logo_url: string | null
  // Couleur au format #RRGGBB ; null = pas de couleur choisie.
  couleur_principale: string | null
  // Code pays a 2 lettres (TG pour le Togo).
  pays: string
  // Nom de la base IANA (exemple : Africa/Lome).
  fuseau_horaire: string
  langue_defaut: string
  statut: StatutOrganisation
  cree_le: string
  modifie_le: string
  secteur: SecteurOrganisation
}

export type PaginationOrganisations = {
  page: number
  limite: number
  total: number
  pages: number
}

// GET /admin/organisations : la plus recente d'abord.
export type ReponseListeOrganisations = {
  organisations: OrganisationAdmin[]
  pagination: PaginationOrganisations
}

// GET, PATCH, /suspendre et /reactiver d'une organisation.
export type ReponseOrganisation = {
  organisation: OrganisationAdmin
}

// POST /admin/organisations : l'organisation est creee et le modele de son secteur est copie
// en brouillon. questionnaire_id vaut null si le secteur n'a pas de modele (ou si la copie a
// echoue) : l'organisation existe quand meme.
export type ReponseCreationOrganisation = {
  organisation: OrganisationAdmin
  questionnaire_id: string | null
}

// Parametres de recherche de GET /admin/organisations. Tous sont facultatifs.
export type FiltresOrganisations = {
  statut?: StatutOrganisation
  // Identifiant d'un secteur.
  secteur?: string
  // Recherche dans le nom.
  q?: string
  page?: number
  // 1 a 100, 20 par defaut.
  limite?: number
}

// Creation : seuls le nom et le secteur sont obligatoires, le serveur complete le reste
// (couleur vide, pays TG, fuseau Africa/Lome, langue fr, statut ESSAI).
// Le secteur doit etre actif (sinon 400 SECTEUR_INVALIDE).
export type CorpsCreationOrganisation = {
  nom: string
  secteur_id: string
  couleur_principale?: string | null
  pays?: string
  fuseau_horaire?: string
  langue_defaut?: LangueOrganisation
  statut?: StatutCreationOrganisation
}

// Modification : au moins un champ. Le secteur et le statut ne changent jamais ici.
export type CorpsModificationOrganisation = {
  nom?: string
  couleur_principale?: string | null
  pays?: string
  fuseau_horaire?: string
  langue_defaut?: LangueOrganisation
}

// Invitation du premier responsable : l'adresse e-mail seulement.
export type CorpsInvitationResponsable = {
  email: string
}

// Meme forme que l'invitation de l'ecran E13 : email_envoye vaut false si le serveur
// d'e-mails a refuse, l'invitation existe quand meme et on peut la renvoyer.
export type ReponseInvitationResponsable = ReponseInvitation

// ------------------------------------------------------------
// Secteurs et themes (ecran E18)
// ------------------------------------------------------------

// Mots affiches a la place des termes generiques : { point_contact: 'table' }.
// La cle point_contact est toujours presente.
export type VocabulaireSecteur = Record<string, string>

// Un theme d'un secteur, dans l'ordre (service, proprete, rapidite...).
export type ThemeAdmin = {
  id: string
  code: string
  libelle_fr: string
  libelle_en: string
  ordre: number
}

// Un secteur d'activite. Un secteur desactive n'est plus propose a la creation d'une organisation.
export type SecteurAdmin = {
  id: string
  code: string
  nom_fr: string
  nom_en: string
  vocabulaire: VocabulaireSecteur
  // Codes d'indicateurs (exemple : nps, note_moyenne).
  indicateurs_suggeres: string[]
  actif: boolean
  cree_le: string
}

// Une ligne de la liste : le secteur avec ses nombres de themes et d'organisations.
export type SecteurListe = SecteurAdmin & {
  nombre_themes: number
  nombre_organisations: number
}

// La fiche d'un secteur : le secteur avec ses themes dans l'ordre.
export type SecteurDetail = SecteurAdmin & {
  themes: ThemeAdmin[]
}

export type ReponseListeSecteurs = {
  secteurs: SecteurListe[]
}

// GET, POST et PATCH d'un secteur.
export type ReponseSecteur = {
  secteur: SecteurDetail
}

// POST et PATCH d'un theme.
export type ReponseTheme = {
  theme: ThemeAdmin
}

// Parametre de GET /admin/secteurs : sans filtre, tous les secteurs.
export type FiltresSecteurs = {
  actif?: boolean
}

// Creation : le code ne change plus jamais ensuite (minuscules, chiffres et tirets bas).
// Le vocabulaire doit contenir point_contact (10 entrees au plus).
export type CorpsCreationSecteur = {
  code: string
  nom_fr: string
  nom_en: string
  vocabulaire: VocabulaireSecteur
  // Vide par defaut.
  indicateurs_suggeres?: string[]
  // Vrai par defaut.
  actif?: boolean
}

// Modification : au moins un champ. Le code ne change jamais.
export type CorpsModificationSecteur = {
  nom_fr?: string
  nom_en?: string
  vocabulaire?: VocabulaireSecteur
  indicateurs_suggeres?: string[]
  actif?: boolean
}

// Creation d'un theme : sans ordre, le nouveau theme passe en dernier.
export type CorpsCreationTheme = {
  code: string
  libelle_fr: string
  libelle_en: string
  ordre?: number
}

// Modification d'un theme : au moins un champ. Le code ne change jamais.
export type CorpsModificationTheme = {
  libelle_fr?: string
  libelle_en?: string
  ordre?: number
}

// ------------------------------------------------------------
// Questionnaires types d'un secteur (lecture seule)
// ------------------------------------------------------------

// Le theme d'une question de modele : seulement son code et ses deux libelles.
export type ThemeQuestionType = {
  code: string
  libelle_fr: string
  libelle_en: string
}

// Une question d'un modele, telle que le backend la renvoie.
export type QuestionTypeSecteur = {
  id: string
  ordre: number
  type: TypeQuestion
  libelle: TexteMultilingue
  aide: TexteMultilingue | null
  obligatoire: boolean
  // Seules les questions a choix ont des options.
  options: TexteMultilingue[] | null
  echelle_min: number | null
  echelle_max: number | null
  libelles_extremites: LibellesExtremites | null
  // Condition d'affichage, renvoyee telle qu'elle est stockee : l'ecran E18 ne l'affiche pas.
  condition: unknown
  // null = question sans theme.
  theme: ThemeQuestionType | null
}

// Un modele de questionnaire du secteur, avec les questions de sa derniere version.
export type QuestionnaireTypeSecteur = {
  id: string
  titre: TexteMultilingue
  message_accueil: TexteMultilingue | null
  message_remerciement: TexteMultilingue | null
  langue_defaut: string
  statut: StatutQuestionnaire
  // Numero de la derniere version ; null = aucune version.
  version: number | null
  questions: QuestionTypeSecteur[]
}

// GET /admin/secteurs/:id/questionnaires-types : liste vide si le secteur n'a pas encore de modele.
export type ReponseQuestionnairesTypes = {
  questionnaires_types: QuestionnaireTypeSecteur[]
}