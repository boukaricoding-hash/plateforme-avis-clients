import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { ParametresListeAvis } from '../services/avis'
import type { OrdreTri, TriAvis } from '../types/avis'
import type { StatutTraitement } from '../types/tableau-de-bord'
import { STATUTS_AVIS } from '../utilitaires/statuts-avis'

// Filtres de la liste des avis (ecran E8, jour 15), gardes dans l'adresse de la page :
// /avis?statut=NOUVEAU&negatifs=true&page=2
// Avantages : un clic de l'accueil arrive deja filtre, le bouton Retour du navigateur
// revient au filtre precedent, et on peut copier l'adresse pour la partager.
// Les noms des parametres sont ceux de l'API (GET /avis).
// Une valeur invalide dans l'adresse est ignoree (jamais envoyee a l'API, qui repondrait 400).

// Nombre d'avis par page : fixe, il n'apparait pas dans l'adresse.
export const LIMITE_PAR_DEFAUT = 20

const TRI_PAR_DEFAUT: TriAvis = 'soumis_le'
const ORDRE_PAR_DEFAUT: OrdreTri = 'desc'
const LONGUEUR_MAX_RECHERCHE = 100

const TRIS_POSSIBLES: readonly TriAvis[] = ['soumis_le', 'note_globale', 'nps']
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/
// Meme regle que l'API (zod) : version 1 a 8, variante 8, 9, a ou b.
const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Ordre des parametres dans l'adresse.
const NOMS_DANS_L_ADRESSE = [
  'from',
  'to',
  'site',
  'point',
  'questionnaire',
  'statut',
  'q',
  'negatifs',
  'avec_commentaire',
  'note_min',
  'note_max',
  'tri',
  'ordre',
  'page',
] as const

// Tout ce qu'on peut changer, sauf la limite par page.
export type ModificationsFiltresAvis = Partial<Omit<ParametresListeAvis, 'limite'>>

export type ResultatFiltresAvis = {
  // Les filtres lus dans l'adresse, avec les valeurs par defaut (tri, ordre, page, limite).
  filtres: ParametresListeAvis
  // Nombre de filtres actifs (tri, ordre et page ne comptent pas).
  nombreFiltresActifs: number
  // Change un ou plusieurs filtres. Une valeur undefined ou vide retire le filtre.
  // La page revient a 1, sauf si la page fait partie des changements.
  changerFiltres: (modifications: ModificationsFiltresAvis) => void
  reinitialiserFiltres: () => void
}

// ------------------------------------------------------------
// Lecture de l'adresse
// ------------------------------------------------------------

function lireJour(valeur: string | null): string | undefined {
  if (valeur === null || !FORMAT_JOUR.test(valeur)) {
    return undefined
  }
  const instant = Date.parse(`${valeur}T00:00:00.000Z`)
  // Refuse un jour qui n'existe pas (30 fevrier) : l'API le refuserait aussi.
  if (Number.isNaN(instant) || new Date(instant).toISOString().slice(0, 10) !== valeur) {
    return undefined
  }
  return valeur
}

function lireIdentifiant(valeur: string | null): string | undefined {
  return valeur !== null && FORMAT_UUID.test(valeur) ? valeur : undefined
}

function lireStatut(valeur: string | null): StatutTraitement | undefined {
  return STATUTS_AVIS.find((statut) => statut === valeur)
}

function lireBooleen(valeur: string | null): boolean | undefined {
  if (valeur === 'true') {
    return true
  }
  return valeur === 'false' ? false : undefined
}

function lireNote(valeur: string | null): number | undefined {
  if (valeur === null || valeur.trim() === '') {
    return undefined
  }
  const nombre = Number(valeur)
  return Number.isFinite(nombre) && nombre >= 1 && nombre <= 5 ? nombre : undefined
}

function lireRecherche(valeur: string | null): string | undefined {
  const texte = valeur === null ? '' : valeur.trim()
  return texte === '' ? undefined : texte.slice(0, LONGUEUR_MAX_RECHERCHE)
}

function lirePage(valeur: string | null): number {
  const nombre = Number(valeur)
  return Number.isInteger(nombre) && nombre >= 1 ? nombre : 1
}

// Les filtres d'une adresse. Les paires incoherentes (debut apres fin, note minimale
// au-dessus de la maximale) sont ignorees : l'API les refuserait.
export function lireFiltresAvis(adresse: URLSearchParams): ParametresListeAvis {
  let from = lireJour(adresse.get('from'))
  let to = lireJour(adresse.get('to'))
  if (from !== undefined && to !== undefined && from > to) {
    from = undefined
    to = undefined
  }

  let noteMin = lireNote(adresse.get('note_min'))
  let noteMax = lireNote(adresse.get('note_max'))
  if (noteMin !== undefined && noteMax !== undefined && noteMin > noteMax) {
    noteMin = undefined
    noteMax = undefined
  }

  const tri = TRIS_POSSIBLES.find((possible) => possible === adresse.get('tri'))
  const ordre = adresse.get('ordre')

  return {
    from,
    to,
    site: lireIdentifiant(adresse.get('site')),
    point: lireIdentifiant(adresse.get('point')),
    questionnaire: lireIdentifiant(adresse.get('questionnaire')),
    statut: lireStatut(adresse.get('statut')),
    q: lireRecherche(adresse.get('q')),
    negatifs: lireBooleen(adresse.get('negatifs')),
    avec_commentaire: lireBooleen(adresse.get('avec_commentaire')),
    note_min: noteMin,
    note_max: noteMax,
    tri: tri ?? TRI_PAR_DEFAUT,
    ordre: ordre === 'asc' || ordre === 'desc' ? ordre : ORDRE_PAR_DEFAUT,
    page: lirePage(adresse.get('page')),
    limite: LIMITE_PAR_DEFAUT,
  }
}

// ------------------------------------------------------------
// Ecriture de l'adresse
// ------------------------------------------------------------

// Les filtres transformes en adresse. Les valeurs absentes, vides ou par defaut
// (tri, ordre, page 1) ne sont pas ecrites : l'adresse reste courte.
function ecrireFiltresAvis(filtres: ParametresListeAvis): URLSearchParams {
  const adresse = new URLSearchParams()
  for (const nom of NOMS_DANS_L_ADRESSE) {
    const valeur = filtres[nom]
    if (valeur === undefined || valeur === '') {
      continue
    }
    if (nom === 'tri' && valeur === TRI_PAR_DEFAUT) {
      continue
    }
    if (nom === 'ordre' && valeur === ORDRE_PAR_DEFAUT) {
      continue
    }
    if (nom === 'page' && valeur === 1) {
      continue
    }
    adresse.set(nom, String(valeur))
  }
  return adresse
}

// Combien de filtres sont actifs. La periode (debut et fin) et la tranche de notes
// comptent chacune pour un seul filtre.
export function compterFiltresActifs(filtres: ParametresListeAvis): number {
  let nombre = 0
  if (filtres.from !== undefined || filtres.to !== undefined) {
    nombre += 1
  }
  if (filtres.note_min !== undefined || filtres.note_max !== undefined) {
    nombre += 1
  }
  const simples = [
    filtres.site,
    filtres.point,
    filtres.questionnaire,
    filtres.statut,
    filtres.q,
    filtres.negatifs,
    filtres.avec_commentaire,
  ]
  return nombre + simples.filter((valeur) => valeur !== undefined).length
}

// ------------------------------------------------------------
// Le hook
// ------------------------------------------------------------

export function utiliserFiltresAvis(): ResultatFiltresAvis {
  const [parametres, setParametres] = useSearchParams()
  const texteAdresse = parametres.toString()

  // Recalcule seulement quand l'adresse change : l'objet reste le meme entre deux affichages,
  // ce qui evite de recharger la liste pour rien.
  const filtres = useMemo(() => lireFiltresAvis(new URLSearchParams(texteAdresse)), [texteAdresse])

  const changerFiltres = useCallback(
    (modifications: ModificationsFiltresAvis) => {
      setParametres((avant) => {
        const actuels = lireFiltresAvis(avant)
        const suivants: ParametresListeAvis = { ...actuels, ...modifications }

        // Tout changement de filtre ramene a la premiere page, sauf si on change la page.
        if (!('page' in modifications)) {
          suivants.page = 1
        }
        // Changer de site : le point de contact choisi n'est plus forcement de ce site.
        if (
          'site' in modifications &&
          modifications.site !== actuels.site &&
          !('point' in modifications)
        ) {
          suivants.point = undefined
        }

        // Relire ce qu'on vient d'ecrire applique les memes controles qu'une adresse tapee a la main.
        return ecrireFiltresAvis(lireFiltresAvis(ecrireFiltresAvis(suivants)))
      })
    },
    [setParametres],
  )

  const reinitialiserFiltres = useCallback(() => {
    setParametres(new URLSearchParams())
  }, [setParametres])

  return {
    filtres,
    nombreFiltresActifs: compterFiltresActifs(filtres),
    changerFiltres,
    reinitialiserFiltres,
  }
}