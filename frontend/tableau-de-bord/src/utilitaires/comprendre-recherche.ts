import type {
  FiltresEcranExport,
  FiltresExport,
  FormatExport,
  PeriodeExport,
} from '../types/exports'
import type { FiltresTableau, StatutTraitement } from '../types/tableau-de-bord'
import { jourTexte, validerPeriode, versFiltresApi, type ErreurPeriode } from './periodes'

// Ecran E16 (jour 21) : le robot comprend ce que l'utilisateur tape dans la barre.
// "excel 7 jours negatifs table 12" devient un format, une periode et des filtres, affiches
// en pastilles. Ce fichier ne fait que du calcul : aucun appel a l'API, aucun composant.
//
// Comment l'ecran s'en sert (hook du fichier 14) : les choix faits a la main (menus, boutons)
// sont gardes a part, et les filtres reellement utilises sont recalcules a chaque frappe avec
// appliquerRecherche(choixManuels, comprendreRecherche(texte, ...)). Ainsi, effacer un mot de la
// barre retire aussitot son effet, et rien ne s'accumule.
//
// Le robot comprend le francais et l'anglais, quelle que soit la langue de l'ecran. Les accents,
// les majuscules et la ponctuation ne comptent pas. Quand un meme reglage est cite deux fois
// (par exemple "csv" puis "pdf"), le dernier mot tape gagne.

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000

// ------------------------------------------------------------
// Ce que l'ecran connait deja (sites, points de contact, questionnaires)
// ------------------------------------------------------------

// noms : toutes les facons d'ecrire le nom (un questionnaire a un titre en francais et en anglais).
export type ElementConnu = {
  id: string
  noms: string[]
}

// Un point de contact (table, chambre...) appartient a un site.
export type PointConnu = ElementConnu & {
  siteId: string
}

export type ContexteRecherche = {
  sites: ElementConnu[]
  points: PointConnu[]
  questionnaires: ElementConnu[]
}

// ------------------------------------------------------------
// Resultat
// ------------------------------------------------------------

// Un mot compris, affiche en pastille. Le texte des pastilles de format, de periode et de statut
// vient des traductions : ce fichier ne donne que la valeur. Pour la periode personnalisee,
// debut et fin donnent les dates ; sinon ils sont vides.
export type MotCompris =
  | { type: 'format'; valeur: FormatExport }
  | { type: 'periode'; valeur: PeriodeExport; debut: string; fin: string }
  | { type: 'statut'; valeur: StatutTraitement }
  | { type: 'negatifs' }
  | { type: 'commentaire' }
  | { type: 'site'; id: string; nom: string }
  | { type: 'point'; id: string; nom: string }
  | { type: 'questionnaire'; id: string; nom: string }

// Ce que le robot n'a pas pu faire : il devient inquiet et le dit.
// - periode : dates invalides, inversees, ou plus de 366 jours (memes erreurs que le tableau de bord).
// - ambigu : le nom existe plusieurs fois (par exemple "Table 1" sur deux sites) : il faut preciser.
export type ProblemeRecherche =
  | { type: 'periode'; erreur: ErreurPeriode }
  | { type: 'ambigu'; nom: string }

export type ResultatRecherche = {
  // null : aucun format cite dans le texte.
  format: FormatExport | null
  // Seulement ce qui a ete compris. A fusionner avec les choix manuels par appliquerRecherche.
  filtres: Partial<FiltresEcranExport>
  mots: MotCompris[]
  problemes: ProblemeRecherche[]
}

// ------------------------------------------------------------
// Texte : minuscules, sans accents, sans ponctuation
// ------------------------------------------------------------

function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Lettres et chiffres separes par un seul espace : "Aujourd'hui, 7 jours !" -> "aujourd hui 7 jours".
function normaliser(texte: string): string {
  return sansAccents(texte).replace(/[^a-z0-9]+/g, ' ').trim()
}

// ------------------------------------------------------------
// Mots-cles (ecrits sans accents : le texte tape est normalise avant la comparaison)
// ------------------------------------------------------------

type Regle<T> = { valeur: T; motif: RegExp }

const REGLES_FORMAT: Regle<FormatExport>[] = [
  { valeur: 'csv', motif: /\bcsv\b/g },
  { valeur: 'xlsx', motif: /\b(?:excel|xlsx|xls|tableur|spreadsheet)\b/g },
  { valeur: 'pdf', motif: /\b(?:pdf|rapport|report)\b/g },
]

const REGLES_STATUT: Regle<StatutTraitement>[] = [
  { valeur: 'NOUVEAU', motif: /\b(?:nouveau|nouveaux|nouvelle|nouvelles|new)\b/g },
  { valeur: 'EN_COURS', motif: /\b(?:en cours|in progress|ongoing)\b/g },
  { valeur: 'TRAITE', motif: /\b(?:traite|traites|traitee|traitees|handled|resolved|done|closed)\b/g },
  { valeur: 'IGNORE', motif: /\b(?:ignore|ignores|ignoree|ignorees|ignored|dismissed)\b/g },
]

// Avis negatifs = ceux qui ont declenche une alerte.
const MOTIF_NEGATIFS = /\b(?:negatifs?|negatives?|alertes?|alerts?|mauvais|bad)\b/

// "sans commentaire", "without comments" et "no comment" ne demandent PAS les commentaires :
// le groupe 1 capture la negation, et ces cas sont ignores.
const MOTIF_COMMENTAIRE = /\b(?:(sans|without|no) )?(?:commentaires?|comments?)\b/g

// Periodes. Dans "7 jours", "2 semaines" ou "7d", le nombre est dans le groupe 1.
const MOTIF_NOMBRE_DE_JOURS =
  /\b(\d{1,3})(?: (?:derniers? |dernieres? )?(jours?|days?|semaines?|weeks?)|(j|d))\b/g
const MOTIF_AUJOURDHUI = /\b(?:aujourd hui|aujourdhui|today)\b/g
// "semaine" et "mois" seuls (le groupe 1 vaut un nombre dans "3 mois" : on ne le comprend pas comme "ce mois").
const MOTIF_SEMAINE = /\b(?:(\d+) )?(?:semaine|week)\b/g
const MOTIF_MOIS = /\b(?:(\d+) )?(?:mois|month)\b/g
const MOTIF_TOUT =
  /\b(?:tout|toute la periode|tous les avis|toutes les dates|sans date|all time|all reviews|all dates|everything)\b/g

// Dates ecrites en entier : 2026-11-05 ou 05/11/2026 (ou 05.11.2026).
const MOTIF_DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g
const MOTIF_DATE_FR = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g

// ------------------------------------------------------------
// Outils de recherche dans le texte
// ------------------------------------------------------------

// La regle dont le mot est le plus a droite dans le texte (le dernier tape gagne).
function dernierMot<T>(texte: string, regles: Regle<T>[]): T | null {
  let meilleur: { valeur: T; position: number } | null = null
  for (const regle of regles) {
    for (const trouve of texte.matchAll(regle.motif)) {
      if (meilleur === null || trouve.index > meilleur.position) {
        meilleur = { valeur: regle.valeur, position: trouve.index }
      }
    }
  }
  return meilleur === null ? null : meilleur.valeur
}

// "AAAA-MM-JJ" qui existe vraiment (le 30 fevrier est refuse, comme par le serveur).
function jourValide(jour: string): boolean {
  const instant = Date.parse(`${jour}T00:00:00.000Z`)
  return !Number.isNaN(instant) && jourTexte(new Date(instant)) === jour
}

function periodePersonnalisee(debut: string, fin: string): FiltresTableau {
  return { periode: 'personnalisee', debut, fin, site: '', point: '', questionnaire: '' }
}

// Enleve les dates du texte et les rend au format "AAAA-MM-JJ".
function lireDates(texte: string): { jours: string[]; reste: string } {
  const jours: string[] = []
  let reste = texte.replace(
    MOTIF_DATE_ISO,
    (_trouve: string, annee: string, mois: string, jour: string) => {
      jours.push(`${annee}-${mois}-${jour}`)
      return ' '
    },
  )
  reste = reste.replace(
    MOTIF_DATE_FR,
    (_trouve: string, jour: string, mois: string, annee: string) => {
      jours.push(`${annee}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`)
      return ' '
    },
  )
  return { jours, reste }
}

type PeriodeComprise = { periode: PeriodeExport; debut: string; fin: string }

// "N jours" : 1, 7 et 30 sont les periodes du tableau de bord ; les autres nombres sont
// une periode personnalisee qui finit aujourd'hui. Renvoie une erreur si la periode est trop longue.
function periodePourNombreDeJours(
  nombre: number,
  maintenant: Date,
): PeriodeComprise | ErreurPeriode {
  const aujourdhui = jourTexte(maintenant)
  if (nombre === 1) {
    return { periode: 'aujourdhui', debut: '', fin: '' }
  }
  if (nombre === 7) {
    return { periode: '7jours', debut: '', fin: '' }
  }
  if (nombre === 30) {
    return { periode: '30jours', debut: '', fin: '' }
  }
  const debut = jourTexte(
    new Date(Date.parse(`${aujourdhui}T00:00:00.000Z`) - (nombre - 1) * UN_JOUR_EN_MS),
  )
  const erreur = validerPeriode(periodePersonnalisee(debut, aujourdhui))
  if (erreur !== null) {
    return erreur
  }
  return { periode: 'personnalisee', debut, fin: aujourdhui }
}

// Cherche une periode dans le texte (sans les dates, deja traitees). Le dernier mot tape gagne.
function chercherPeriode(
  texte: string,
  maintenant: Date,
  problemes: ProblemeRecherche[],
): PeriodeComprise | null {
  const propositions: { comprise: PeriodeComprise; position: number }[] = []

  function proposer(comprise: PeriodeComprise, position: number): void {
    propositions.push({ comprise, position })
  }

  for (const trouve of texte.matchAll(MOTIF_NOMBRE_DE_JOURS)) {
    const nombre = Number(trouve[1])
    const unite = trouve[2]
    const jours = unite !== undefined && /^(?:semaine|week)/.test(unite) ? nombre * 7 : nombre
    if (jours < 1) {
      continue
    }
    const resultat = periodePourNombreDeJours(jours, maintenant)
    if (typeof resultat === 'string') {
      problemes.push({ type: 'periode', erreur: resultat })
    } else {
      proposer(resultat, trouve.index)
    }
  }
  for (const trouve of texte.matchAll(MOTIF_AUJOURDHUI)) {
    proposer({ periode: 'aujourdhui', debut: '', fin: '' }, trouve.index)
  }
  for (const trouve of texte.matchAll(MOTIF_SEMAINE)) {
    if (trouve[1] === undefined) {
      proposer({ periode: '7jours', debut: '', fin: '' }, trouve.index)
    }
  }
  for (const trouve of texte.matchAll(MOTIF_MOIS)) {
    if (trouve[1] === undefined) {
      proposer({ periode: 'mois', debut: '', fin: '' }, trouve.index)
    }
  }
  for (const trouve of texte.matchAll(MOTIF_TOUT)) {
    proposer({ periode: 'tout', debut: '', fin: '' }, trouve.index)
  }

  // Le mot le plus a droite gagne.
  const derniere = propositions.sort((a, b) => b.position - a.position).at(0)
  return derniere === undefined ? null : derniere.comprise
}

// ------------------------------------------------------------
// Noms de sites, de points de contact et de questionnaires
// ------------------------------------------------------------

type NomTrouve<E> = { position: number; nom: string; candidats: E[] }

// Cherche les noms de la liste dans le texte (mots entiers : "table 1" ne trouve pas "table 12").
// Les noms les plus longs passent d'abord et sont retires du texte, pour qu'un nom court ("Salle")
// ne soit pas reconnu a l'interieur d'un nom plus long ("Salle principale").
// Le texte doit etre normalise et entoure d'un espace de chaque cote.
function chercherNoms<E extends ElementConnu>(
  texte: string,
  elements: E[],
): { reste: string; trouves: NomTrouve<E>[] } {
  const parNom = new Map<string, { original: string; candidats: E[] }>()
  for (const element of elements) {
    for (const original of element.noms) {
      const cle = normaliser(original)
      if (cle.length < 2) {
        continue
      }
      const existant = parNom.get(cle)
      if (existant === undefined) {
        parNom.set(cle, { original, candidats: [element] })
      } else if (!existant.candidats.includes(element)) {
        existant.candidats.push(element)
      }
    }
  }

  const cles = [...parNom.keys()].sort((a, b) => b.length - a.length)
  const trouves: NomTrouve<E>[] = []
  let reste = texte
  for (const cle of cles) {
    const marque = ` ${cle} `
    if (!reste.includes(marque)) {
      continue
    }
    const entree = parNom.get(cle)
    if (entree !== undefined) {
      trouves.push({
        position: texte.indexOf(marque),
        nom: entree.original,
        candidats: entree.candidats,
      })
    }
    reste = reste.replace(marque, ' ')
  }
  return { reste, trouves }
}

// Choisit l'element cite en dernier. Un nom qui designe plusieurs elements est ambigu : on ne
// choisit pas au hasard, on le signale. "restreindre" permet de departager par le site.
function choisirNom<E extends ElementConnu>(
  trouves: NomTrouve<E>[],
  problemes: ProblemeRecherche[],
  restreindre?: (candidats: E[]) => E[],
): { element: E; nom: string } | null {
  let choix: { element: E; nom: string } | null = null
  for (const trouve of [...trouves].sort((a, b) => a.position - b.position)) {
    const restreints = restreindre === undefined ? trouve.candidats : restreindre(trouve.candidats)
    const retenus = restreints.length > 0 ? restreints : trouve.candidats
    const [premier] = retenus
    if (retenus.length === 1 && premier !== undefined) {
      choix = { element: premier, nom: trouve.nom }
    } else {
      problemes.push({ type: 'ambigu', nom: trouve.nom })
    }
  }
  return choix
}

// ------------------------------------------------------------
// Fonction principale
// ------------------------------------------------------------

export function comprendreRecherche(
  texte: string,
  contexte: ContexteRecherche,
  maintenant: Date = new Date(),
): ResultatRecherche {
  const problemes: ProblemeRecherche[] = []
  const mots: MotCompris[] = []
  const filtres: Partial<FiltresEcranExport> = {}

  // 1. Les dates ecrites en entier (avant de retirer la ponctuation : elles contiennent - / .).
  const { jours, reste: sansDates } = lireDates(sansAccents(texte))
  let periode: PeriodeComprise | null = null
  if (jours.length > 0) {
    const classes = [...jours].sort()
    const debut = classes.at(0) ?? ''
    const fin = classes.at(-1) ?? ''
    if (!jourValide(debut) || !jourValide(fin)) {
      problemes.push({ type: 'periode', erreur: 'datesRequises' })
    } else {
      const erreur = validerPeriode(periodePersonnalisee(debut, fin))
      if (erreur === null) {
        periode = { periode: 'personnalisee', debut, fin }
      } else {
        problemes.push({ type: 'periode', erreur })
      }
    }
  }

  // 2. Les noms de sites, de questionnaires et de points de contact (les noms exacts d'abord).
  let reste = ` ${normaliser(sansDates)} `
  const sites = chercherNoms(reste, contexte.sites)
  reste = sites.reste
  const questionnaires = chercherNoms(reste, contexte.questionnaires)
  reste = questionnaires.reste
  const points = chercherNoms(reste, contexte.points)
  reste = points.reste

  const site = choisirNom(sites.trouves, problemes)
  const questionnaire = choisirNom(questionnaires.trouves, problemes)
  const point = choisirNom(points.trouves, problemes, (candidats) =>
    site === null ? candidats : candidats.filter((candidat) => candidat.siteId === site.element.id),
  )

  // 3. Les mots-cles, dans ce qui reste du texte.
  const format = dernierMot(reste, REGLES_FORMAT)
  if (format !== null) {
    mots.push({ type: 'format', valeur: format })
  }

  // Les dates ecrites en entier passent avant les mots comme "7 jours".
  periode = periode ?? chercherPeriode(reste, maintenant, problemes)
  if (periode !== null) {
    filtres.periode = periode.periode
    filtres.debut = periode.debut
    filtres.fin = periode.fin
    mots.push({ type: 'periode', valeur: periode.periode, debut: periode.debut, fin: periode.fin })
  }

  const statut = dernierMot(reste, REGLES_STATUT)
  if (statut !== null) {
    filtres.statut = statut
    mots.push({ type: 'statut', valeur: statut })
  }

  if (MOTIF_NEGATIFS.test(reste)) {
    filtres.negatifs = true
    mots.push({ type: 'negatifs' })
  }

  const demandeCommentaires = [...reste.matchAll(MOTIF_COMMENTAIRE)].some(
    (trouve) => trouve[1] === undefined,
  )
  if (demandeCommentaires) {
    filtres.avecCommentaire = true
    mots.push({ type: 'commentaire' })
  }

  if (site !== null) {
    filtres.site = site.element.id
    mots.push({ type: 'site', id: site.element.id, nom: site.nom })
  }
  if (questionnaire !== null) {
    filtres.questionnaire = questionnaire.element.id
    mots.push({ type: 'questionnaire', id: questionnaire.element.id, nom: questionnaire.nom })
  }
  if (point !== null) {
    filtres.point = point.element.id
    mots.push({ type: 'point', id: point.element.id, nom: point.nom })
  }

  return { format, filtres, mots, problemes }
}

// ------------------------------------------------------------
// Filtres de l'ecran
// ------------------------------------------------------------

// Etat de depart : les 30 derniers jours, tout le reste sur "tous". Comme le tableau de bord, et
// on evite d'exporter par erreur la totalite des avis.
export function filtresEcranParDefaut(): FiltresEcranExport {
  return {
    periode: '30jours',
    debut: '',
    fin: '',
    site: '',
    point: '',
    questionnaire: '',
    statut: '',
    negatifs: false,
    avecCommentaire: false,
  }
}

// Les choix manuels, puis par-dessus ce que le robot a compris dans le texte.
export function appliquerRecherche(
  choixManuels: FiltresEcranExport,
  resultat: ResultatRecherche,
): FiltresEcranExport {
  return { ...choixManuels, ...resultat.filtres }
}

// Les filtres de l'ecran transformes en filtres de l'API (noms du backend). Renvoie null tant que
// la periode personnalisee est invalide : on ne lance rien (le bouton Generer reste bloque).
// Periode "tout" : ni from ni to. Le serveur exporte alors tous les avis en csv et en excel,
// et prend les 30 derniers jours pour le rapport pdf.
export function versFiltresExport(
  filtres: FiltresEcranExport,
  maintenant: Date = new Date(),
): FiltresExport | null {
  const base: FiltresTableau = {
    periode: filtres.periode === 'tout' ? '30jours' : filtres.periode,
    debut: filtres.debut,
    fin: filtres.fin,
    site: filtres.site,
    point: filtres.point,
    questionnaire: filtres.questionnaire,
  }
  const api = versFiltresApi(base, maintenant)
  if (api === null) {
    return null
  }
  const { from, to, ...autres } = api
  const resultat: FiltresExport = filtres.periode === 'tout' ? { ...autres } : { from, to, ...autres }
  if (filtres.statut !== '') {
    resultat.statut = filtres.statut
  }
  if (filtres.negatifs) {
    resultat.negatifs = true
  }
  if (filtres.avecCommentaire) {
    resultat.avec_commentaire = true
  }
  return resultat
}