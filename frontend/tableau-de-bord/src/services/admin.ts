import type {
  CorpsCreationOrganisation,
  CorpsCreationSecteur,
  CorpsCreationTheme,
  CorpsInvitationResponsable,
  CorpsModificationOrganisation,
  CorpsModificationSecteur,
  CorpsModificationTheme,
  FiltresOrganisations,
  FiltresSecteurs,
  OrganisationAdmin,
  QuestionnaireTypeSecteur,
  ReponseCreationOrganisation,
  ReponseInvitationResponsable,
  ReponseListeOrganisations,
  ReponseListeSecteurs,
  ReponseOrganisation,
  ReponseQuestionnairesTypes,
  ReponseSecteur,
  ReponseTheme,
  SecteurDetail,
  SecteurListe,
  ThemeAdmin,
} from '../types/admin'
import { appeler } from './api'

// Tous les appels des ecrans E17 (organisations) et E18 (modeles sectoriels), jour 23.
// Toutes ces routes sont reservees a l'administrateur DTS (le serveur repond 403 ACCES_REFUSE
// aux autres roles). Les composants n'appellent jamais fetch directement.
// Erreurs a afficher en clair :
// - creation d'une organisation : 400 SECTEUR_INVALIDE (secteur inconnu ou desactive) ;
// - suspension : 409 DEJA_SUSPENDUE ; reactivation : 409 PAS_SUSPENDUE ;
// - invitation du premier responsable : 409 RESPONSABLE_EXISTANT, DEJA_MEMBRE,
//   COMPTE_DESACTIVE, ADRESSE_INDISPONIBLE ;
// - creation d'un secteur ou d'un theme : 409 CODE_DEJA_UTILISE ;
// - organisation, secteur ou theme inconnu : 404.

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
// Organisations (ecran E17)
// ------------------------------------------------------------

// GET /admin/organisations : une page d'organisations (la plus recente d'abord) et la pagination.
export async function listerOrganisations(
  filtres: FiltresOrganisations,
): Promise<ReponseListeOrganisations> {
  return appeler<ReponseListeOrganisations>(`/admin/organisations${construireAdresse(filtres)}`)
}

// GET /admin/organisations/:id : la fiche d'une organisation.
export async function lireOrganisation(id: string): Promise<OrganisationAdmin> {
  const reponse = await appeler<ReponseOrganisation>(`/admin/organisations/${id}`)
  return reponse.organisation
}

// POST /admin/organisations : cree l'organisation et copie le modele de son secteur en brouillon.
// questionnaire_id vaut null si le secteur n'a pas de modele : l'organisation existe quand meme.
export async function creerOrganisation(
  corps: CorpsCreationOrganisation,
): Promise<ReponseCreationOrganisation> {
  return appeler<ReponseCreationOrganisation>('/admin/organisations', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
}

// PATCH /admin/organisations/:id : nom, couleur, pays, fuseau ou langue (au moins un champ).
// Le secteur et le statut ne changent jamais par cette route.
export async function modifierOrganisation(
  id: string,
  corps: CorpsModificationOrganisation,
): Promise<OrganisationAdmin> {
  const reponse = await appeler<ReponseOrganisation>(`/admin/organisations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
  return reponse.organisation
}

// POST /admin/organisations/:id/suspendre : la connexion et les QR codes de l'organisation
// sont bloques. Refuse si elle est deja suspendue (409 DEJA_SUSPENDUE).
export async function suspendreOrganisation(id: string): Promise<OrganisationAdmin> {
  const reponse = await appeler<ReponseOrganisation>(`/admin/organisations/${id}/suspendre`, {
    method: 'POST',
  })
  return reponse.organisation
}

// POST /admin/organisations/:id/reactiver : l'organisation repasse au statut ACTIF.
// Refuse si elle n'est pas suspendue (409 PAS_SUSPENDUE).
export async function reactiverOrganisation(id: string): Promise<OrganisationAdmin> {
  const reponse = await appeler<ReponseOrganisation>(`/admin/organisations/${id}/reactiver`, {
    method: 'POST',
  })
  return reponse.organisation
}

// POST /admin/organisations/:id/inviter-responsable : invite le premier responsable par e-mail.
// Une invitation deja en attente pour la meme adresse est remplacee (sert aussi de renvoi).
// email_envoye vaut false si le serveur d'e-mails a refuse : l'invitation existe quand meme.
export async function inviterResponsable(
  id: string,
  corps: CorpsInvitationResponsable,
): Promise<ReponseInvitationResponsable> {
  return appeler<ReponseInvitationResponsable>(`/admin/organisations/${id}/inviter-responsable`, {
    method: 'POST',
    body: JSON.stringify(corps),
  })
}

// ------------------------------------------------------------
// Secteurs et themes (ecran E18)
// ------------------------------------------------------------

// GET /admin/secteurs : tous les secteurs avec leur nombre de themes et d'organisations.
// Avec actif: true, seulement ceux qu'on peut proposer a la creation d'une organisation.
export async function listerSecteurs(filtres: FiltresSecteurs = {}): Promise<SecteurListe[]> {
  const reponse = await appeler<ReponseListeSecteurs>(`/admin/secteurs${construireAdresse(filtres)}`)
  return reponse.secteurs
}

// GET /admin/secteurs/:id : un secteur avec ses themes dans l'ordre.
export async function lireSecteur(id: string): Promise<SecteurDetail> {
  const reponse = await appeler<ReponseSecteur>(`/admin/secteurs/${id}`)
  return reponse.secteur
}

// POST /admin/secteurs : cree un secteur. Son code ne changera plus jamais.
// Refuse si le code existe deja (409 CODE_DEJA_UTILISE).
export async function creerSecteur(corps: CorpsCreationSecteur): Promise<SecteurDetail> {
  const reponse = await appeler<ReponseSecteur>('/admin/secteurs', {
    method: 'POST',
    body: JSON.stringify(corps),
  })
  return reponse.secteur
}

// PATCH /admin/secteurs/:id : noms, vocabulaire, indicateurs suggeres ou actif (au moins un champ).
// Un secteur desactive n'est plus propose a la creation d'une organisation.
export async function modifierSecteur(
  id: string,
  corps: CorpsModificationSecteur,
): Promise<SecteurDetail> {
  const reponse = await appeler<ReponseSecteur>(`/admin/secteurs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
  return reponse.secteur
}

// POST /admin/secteurs/:id/themes : ajoute un theme au secteur (en dernier si aucun ordre n'est donne).
// Refuse si le code existe deja dans ce secteur (409 CODE_DEJA_UTILISE).
export async function creerTheme(secteurId: string, corps: CorpsCreationTheme): Promise<ThemeAdmin> {
  const reponse = await appeler<ReponseTheme>(`/admin/secteurs/${secteurId}/themes`, {
    method: 'POST',
    body: JSON.stringify(corps),
  })
  return reponse.theme
}

// PATCH /admin/secteurs/:id/themes/:themeId : libelles ou ordre (au moins un champ).
// Le code d'un theme ne change jamais.
export async function modifierTheme(
  secteurId: string,
  themeId: string,
  corps: CorpsModificationTheme,
): Promise<ThemeAdmin> {
  const reponse = await appeler<ReponseTheme>(`/admin/secteurs/${secteurId}/themes/${themeId}`, {
    method: 'PATCH',
    body: JSON.stringify(corps),
  })
  return reponse.theme
}

// GET /admin/secteurs/:id/questionnaires-types : les modeles du secteur avec leurs questions
// (lecture seule). La liste est vide si le secteur n'a pas encore de modele.
export async function listerQuestionnairesTypes(
  secteurId: string,
): Promise<QuestionnaireTypeSecteur[]> {
  const reponse = await appeler<ReponseQuestionnairesTypes>(
    `/admin/secteurs/${secteurId}/questionnaires-types`,
  )
  return reponse.questionnaires_types
}