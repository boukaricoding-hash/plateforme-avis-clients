import type { Langue } from '../types/langue'
import type { FiltresApi, FiltresTableau } from '../types/tableau-de-bord'

// Periodes du tableau de bord (jour 14). Tous les jours sont des jours UTC "AAAA-MM-JJ",
// comme le backend (Africa/Lome = UTC+0). Ce fichier contient aussi les formats de dates
// et de nombres affiches par les composants, pour avoir un seul endroit a regler.

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000
const JOURS_MAX = 366
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/

// Erreurs possibles d'une periode personnalisee : ce sont les noms des textes
// tableau.filtres.datesRequises, datesInversees et periodeTropLongue.
export type ErreurPeriode = 'datesRequises' | 'datesInversees' | 'periodeTropLongue'

// Etat de depart de la barre de filtres : les 30 derniers jours, tout le reste sur "tous".
export function filtresParDefaut(): FiltresTableau {
  return { periode: '30jours', debut: '', fin: '', site: '', point: '', questionnaire: '' }
}

// ------------------------------------------------------------
// Calcul des dates
// ------------------------------------------------------------

// "AAAA-MM-JJ" (UTC) d'un instant.
export function jourTexte(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Minuit UTC d'un jour "AAAA-MM-JJ", en millisecondes (NaN si le texte est invalide).
function jourEnMs(jour: string): number {
  return Date.parse(`${jour}T00:00:00.000Z`)
}

function ajouterJours(jour: string, nombre: number): string {
  return jourTexte(new Date(jourEnMs(jour) + nombre * UN_JOUR_EN_MS))
}

// Verifie une periode personnalisee. Les autres periodes sont toujours valides.
// Renvoie null si tout va bien.
export function validerPeriode(filtres: FiltresTableau): ErreurPeriode | null {
  if (filtres.periode !== 'personnalisee') {
    return null
  }
  const debutValide = FORMAT_JOUR.test(filtres.debut) && !Number.isNaN(jourEnMs(filtres.debut))
  const finValide = FORMAT_JOUR.test(filtres.fin) && !Number.isNaN(jourEnMs(filtres.fin))
  if (!debutValide || !finValide) {
    return 'datesRequises'
  }
  if (filtres.debut > filtres.fin) {
    return 'datesInversees'
  }
  const nombreDeJours = (jourEnMs(filtres.fin) - jourEnMs(filtres.debut)) / UN_JOUR_EN_MS + 1
  if (nombreDeJours > JOURS_MAX) {
    return 'periodeTropLongue'
  }
  return null
}

// Les deux dates (incluses) de la periode choisie, ou null si la periode personnalisee est invalide.
// "maintenant" est lu a chaque appel : apres minuit UTC, "aujourd'hui" change tout seul.
export function calculerPeriode(
  filtres: FiltresTableau,
  maintenant: Date = new Date(),
): { from: string; to: string } | null {
  const aujourdhui = jourTexte(maintenant)

  switch (filtres.periode) {
    case 'aujourdhui':
      return { from: aujourdhui, to: aujourdhui }
    case '7jours':
      return { from: ajouterJours(aujourdhui, -6), to: aujourdhui }
    case '30jours':
      return { from: ajouterJours(aujourdhui, -29), to: aujourdhui }
    case 'mois':
      // Du 1er du mois en cours jusqu'a aujourd'hui.
      return { from: `${aujourdhui.slice(0, 7)}-01`, to: aujourdhui }
    case 'personnalisee':
      if (validerPeriode(filtres) !== null) {
        return null
      }
      return { from: filtres.debut, to: filtres.fin }
  }
}

// Les filtres de la barre transformes en filtres de l'API (noms du backend).
// Renvoie null tant que la periode personnalisee est invalide : on ne recharge pas.
export function versFiltresApi(
  filtres: FiltresTableau,
  maintenant: Date = new Date(),
): FiltresApi | null {
  const periode = calculerPeriode(filtres, maintenant)
  if (periode === null) {
    return null
  }
  const filtresApi: FiltresApi = { from: periode.from, to: periode.to }
  if (filtres.site !== '') {
    filtresApi.site = filtres.site
  }
  if (filtres.point !== '') {
    filtresApi.point = filtres.point
  }
  if (filtres.questionnaire !== '') {
    filtresApi.questionnaire = filtres.questionnaire
  }
  return filtresApi
}

// ------------------------------------------------------------
// Affichage des dates et des nombres
// ------------------------------------------------------------

function localeDe(langue: Langue): string {
  return langue === 'fr' ? 'fr-FR' : 'en-GB'
}

// "1 nov. 2026" a partir de "2026-11-01".
export function formaterJour(jour: string, langue: Langue): string {
  return new Intl.DateTimeFormat(localeDe(langue), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(jourEnMs(jour)))
}

// "1 nov." a partir de "2026-11-01" (axe de la courbe).
export function formaterJourCourt(jour: string, langue: Langue): string {
  return new Intl.DateTimeFormat(localeDe(langue), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(jourEnMs(jour)))
}

// "1 nov., 20:55" a partir d'une date ISO complete (avis recents).
export function formaterDateHeure(dateIso: string, langue: Langue): string {
  return new Intl.DateTimeFormat(localeDe(langue), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateIso))
}

// "20:55" (heure de la derniere mise a jour).
export function formaterHeure(date: Date, langue: Langue): string {
  return new Intl.DateTimeFormat(localeDe(langue), {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

// "4,2" en francais, "4.2" en anglais. Par defaut 1 decimale au plus.
// fixe = true : toujours le meme nombre de decimales (4,0 au lieu de 4).
export function formaterNombre(
  valeur: number,
  langue: Langue,
  options: { decimales?: number; fixe?: boolean } = {},
): string {
  const decimales = options.decimales ?? 1
  return new Intl.NumberFormat(localeDe(langue), {
    minimumFractionDigits: options.fixe === true ? decimales : 0,
    maximumFractionDigits: decimales,
  }).format(valeur)
}