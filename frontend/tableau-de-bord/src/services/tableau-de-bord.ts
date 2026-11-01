import type {
  DonneesTableau,
  FiltresApi,
  ReponseClassement,
  ReponseDerniersAvis,
  ReponseKpis,
  ReponsePointsContact,
  ReponseQuestionnaires,
  ReponseQuestions,
  ReponseSerie,
  ReponseSites,
  ReponseThemes,
} from '../types/tableau-de-bord'
import { appeler } from './api'

// Tous les appels de l'ecran E7 (jour 14). Les composants n'appellent jamais fetch directement.

// Valeurs acceptees dans l'adresse de la liste des avis (undefined = parametre absent).
export type ParametresAvis = Record<string, string | number | boolean | undefined>

// Transforme des parametres en "?a=1&b=2". Les valeurs vides ou absentes sont ignorees.
function versTexteAdresse(parametres: ParametresAvis): string {
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

// Les filtres communs de /dashboard/* : from, to, site, point, questionnaire.
// from et to partent ensemble ou pas du tout (sinon l'API refuse).
export function construireAdresseFiltres(filtres: FiltresApi): string {
  const avecPeriode = filtres.from !== undefined && filtres.to !== undefined
  return versTexteAdresse({
    from: avecPeriode ? filtres.from : undefined,
    to: avecPeriode ? filtres.to : undefined,
    site: filtres.site,
    point: filtres.point,
    questionnaire: filtres.questionnaire,
  })
}

// Lien vers la liste des avis (ecran du jour 15) avec les filtres du tableau de bord
// et, en plus, des parametres propres au clic : statut, negatifs, note_min, note_max...
export function construireLienAvis(filtres: FiltresApi, supplements: ParametresAvis = {}): string {
  const avecPeriode = filtres.from !== undefined && filtres.to !== undefined
  return `/avis${versTexteAdresse({
    from: avecPeriode ? filtres.from : undefined,
    to: avecPeriode ? filtres.to : undefined,
    site: filtres.site,
    point: filtres.point,
    questionnaire: filtres.questionnaire,
    ...supplements,
  })}`
}

// ------------------------------------------------------------
// Donnees du tableau de bord
// ------------------------------------------------------------

// GET /dashboard/kpis : chiffres cles, evolution, alertes ouvertes.
export function lireKpis(filtres: FiltresApi): Promise<ReponseKpis> {
  return appeler<ReponseKpis>(`/dashboard/kpis${construireAdresseFiltres(filtres)}`)
}

// GET /dashboard/themes : score par theme, points faibles en premier.
export function lireThemes(filtres: FiltresApi): Promise<ReponseThemes> {
  return appeler<ReponseThemes>(`/dashboard/themes${construireAdresseFiltres(filtres)}`)
}

// GET /dashboard/timeseries : un point par jour.
export function lireSerie(filtres: FiltresApi): Promise<ReponseSerie> {
  return appeler<ReponseSerie>(`/dashboard/timeseries${construireAdresseFiltres(filtres)}`)
}

// GET /dashboard/ranking : classement des points de contact.
export function lireClassement(filtres: FiltresApi): Promise<ReponseClassement> {
  return appeler<ReponseClassement>(`/dashboard/ranking${construireAdresseFiltres(filtres)}`)
}

// GET /dashboard/questions : detail par question.
export function lireQuestions(filtres: FiltresApi): Promise<ReponseQuestions> {
  return appeler<ReponseQuestions>(`/dashboard/questions${construireAdresseFiltres(filtres)}`)
}

// GET /dashboard/derniers-avis : les 10 derniers avis.
export function lireDerniersAvis(filtres: FiltresApi): Promise<ReponseDerniersAvis> {
  return appeler<ReponseDerniersAvis>(`/dashboard/derniers-avis${construireAdresseFiltres(filtres)}`)
}

// Charge les six blocs en meme temps. Si l'un echoue, l'ensemble echoue :
// l'ecran ne montre jamais des chiffres de deux filtres differents.
export async function chargerDonneesTableau(filtres: FiltresApi): Promise<DonneesTableau> {
  const [kpis, themes, serie, classement, questions, derniersAvis] = await Promise.all([
    lireKpis(filtres),
    lireThemes(filtres),
    lireSerie(filtres),
    lireClassement(filtres),
    lireQuestions(filtres),
    lireDerniersAvis(filtres),
  ])
  return { kpis, themes, serie, classement, questions, derniersAvis }
}

// ------------------------------------------------------------
// Listes de la barre de filtres
// ------------------------------------------------------------

// GET /sites
export function lireSites(): Promise<ReponseSites> {
  return appeler<ReponseSites>('/sites')
}

// GET /points-contact, avec ?site_id=... pour ne garder que ceux d'un site.
export function lirePointsContact(siteId?: string): Promise<ReponsePointsContact> {
  const adresse = siteId === undefined || siteId === '' ? '' : `?site_id=${encodeURIComponent(siteId)}`
  return appeler<ReponsePointsContact>(`/points-contact${adresse}`)
}

// GET /questionnaires
export function lireQuestionnaires(): Promise<ReponseQuestionnaires> {
  return appeler<ReponseQuestionnaires>('/questionnaires')
}