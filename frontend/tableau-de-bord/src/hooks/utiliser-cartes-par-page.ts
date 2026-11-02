import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { LIMITE_PAR_DEFAUT } from './utiliser-filtres-avis'

// Nombre de cartes d'avis par page, pour la page des avis (jour 15 design).
//
// Mode ecran fixe (meme requete que dans styles/avis.css et styles/accueil.css) : la page ne
// defile pas, donc la liste doit tenir exactement dans la zone prevue pour elle (classe
// avis-liste-zone). On mesure la hauteur de cette zone et on calcule combien de lignes de
// cartes y entrent ; il y a 2 cartes par ligne. Ce nombre est envoye a l'API (parametre limite).
// La hauteur d'une carte et l'ecart entre cartes sont lus dans les variables CSS
// --v-hauteur-carte et --v-ecart : une seule source, le fichier styles/avis.css.
//
// Mode page normale : il n'y a pas de hauteur a remplir, on garde la limite par defaut.
//
// Tant que la zone n'est pas mesuree en ecran fixe, le resultat est null : l'ecran attend avant
// de charger la liste (sinon il chargerait une premiere fois avec un mauvais nombre).

// Doit rester egale a la requete de l'ecran fixe dans styles/avis.css
const REQUETE_ECRAN_FIXE = '(min-width: 1100px) and (min-height: 640px)'
// Cartes par ligne en ecran fixe (2 colonnes dans styles/avis.css)
const COLONNES = 2
// Valeurs de secours si les variables CSS ne sont pas lisibles
const HAUTEUR_CARTE_SECOURS = 72
const ECART_SECOURS = 8
// Limite maximale acceptee par l'API (GET /avis)
const LIMITE_MAX_API = 100

function sAbonnerEcranFixe(rappel: () => void) {
  const requete = window.matchMedia(REQUETE_ECRAN_FIXE)
  requete.addEventListener('change', rappel)
  return () => requete.removeEventListener('change', rappel)
}

function lireEcranFixe() {
  return window.matchMedia(REQUETE_ECRAN_FIXE).matches
}

// Lit une variable CSS en pixels (par exemple "72px" donne 72).
function lirePixels(element: HTMLElement, nom: string, secours: number): number {
  const valeur = Number.parseFloat(getComputedStyle(element).getPropertyValue(nom))
  return Number.isFinite(valeur) && valeur > 0 ? valeur : secours
}

// Combien de cartes tiennent dans la zone : lignes entieres seulement, au moins une ligne.
function compterCartes(zone: HTMLElement): number {
  const hauteurCarte = lirePixels(zone, '--v-hauteur-carte', HAUTEUR_CARTE_SECOURS)
  const ecart = lirePixels(zone, '--v-ecart', ECART_SECOURS)
  const lignes = Math.max(1, Math.floor((zone.clientHeight + ecart) / (hauteurCarte + ecart)))
  return Math.min(lignes * COLONNES, LIMITE_MAX_API)
}

export type ResultatCartesParPage = {
  // A mettre en ref sur la zone qui contient les cartes (classe avis-liste-zone)
  refZone: (element: HTMLDivElement | null) => void
  // Nombre de cartes par page, ou null tant que la zone n'est pas mesuree (ecran fixe seulement)
  cartesParPage: number | null
}

export function utiliserCartesParPage(): ResultatCartesParPage {
  const ecranFixe = useSyncExternalStore(sAbonnerEcranFixe, lireEcranFixe)
  const [zone, setZone] = useState<HTMLDivElement | null>(null)
  const [mesure, setMesure] = useState<number | null>(null)

  const refZone = useCallback((element: HTMLDivElement | null) => {
    setZone(element)
  }, [])

  // L'observateur donne une premiere mesure des qu'il est branche, puis une nouvelle a chaque
  // changement de taille (fenetre redimensionnee, menu replie ou deplie).
  useEffect(() => {
    if (!ecranFixe || zone === null) {
      return
    }
    const observateur = new ResizeObserver(() => {
      setMesure(compterCartes(zone))
    })
    observateur.observe(zone)
    return () => observateur.disconnect()
  }, [ecranFixe, zone])

  return { refZone, cartesParPage: ecranFixe ? mesure : LIMITE_PAR_DEFAUT }
}