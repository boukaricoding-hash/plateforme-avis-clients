import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// Decoupe une liste en pages dont la taille depend de la hauteur disponible.
// Utilise par le classement, les avis recents et les questions de l'accueil.
//
// Mode ecran fixe (meme requete que dans styles/accueil.css) : la zone des lignes prend toute la
// hauteur qui reste dans le panneau. On la mesure, et le nombre de lignes par page est
// (hauteur de la zone - hauteur de l'en-tete) / hauteur d'une ligne.
// Mode page normale : il n'y a pas de hauteur a remplir, on garde un nombre fixe de lignes.

// Doit rester egale a la requete de l'ecran fixe dans styles/accueil.css
const REQUETE_ECRAN_FIXE = '(min-width: 1100px) and (min-height: 640px)'
// Nombre de lignes par page en page normale
const LIGNES_PAR_DEFAUT = 8
// Jamais moins de lignes que cela, meme si la zone est tres basse
const LIGNES_MIN = 3

export type OptionsPages = {
  // Hauteur d'une ligne en pixels (ligne de tableau ou carte d'avis)
  hauteurLigne: number
  // Hauteur en pixels de ce qui est dans la zone mais n'est pas une ligne (ex. l'en-tete d'un tableau)
  hauteurEnTete?: number
  // Nombre de lignes par page quand la page n'est pas en ecran fixe
  lignesParDefaut?: number
  // Nombre minimum de lignes par page en ecran fixe (3 par defaut)
  lignesMin?: number
  // Requete media de l'ecran fixe, a garder egale a celle du CSS de la page (par defaut : celle de l'accueil)
  requeteEcranFixe?: string
}

export type ResultatPages<T> = {
  // A mettre en ref sur la zone qui contient les lignes (classe accueil-liste-zone)
  refZone: (element: HTMLDivElement | null) => void
  // Les elements de la page affichee
  elementsPage: T[]
  // Position du premier element de la page dans la liste complete (pour numeroter les lignes)
  debut: number
  // Numero de la page affichee, a partir de 0
  pageCourante: number
  nbPages: number
  lignesParPage: number
  allerA: (page: number) => void
}

export function utiliserPages<T>(
  elements: readonly T[],
  {
    hauteurLigne,
    hauteurEnTete = 0,
    lignesParDefaut = LIGNES_PAR_DEFAUT,
    lignesMin = LIGNES_MIN,
    requeteEcranFixe = REQUETE_ECRAN_FIXE,
  }: OptionsPages,
): ResultatPages<T> {
  const sAbonner = useCallback(
    (rappel: () => void) => {
      const requete = window.matchMedia(requeteEcranFixe)
      requete.addEventListener('change', rappel)
      return () => requete.removeEventListener('change', rappel)
    },
    [requeteEcranFixe],
  )
  const lire = useCallback(() => window.matchMedia(requeteEcranFixe).matches, [requeteEcranFixe])
  const ecranFixe = useSyncExternalStore(sAbonner, lire)
  const [zone, setZone] = useState<HTMLDivElement | null>(null)
  const [hauteurZone, setHauteurZone] = useState(0)
  const [page, setPage] = useState(0)

  // Ref a mettre sur la zone : on la garde et on la mesure tout de suite,
  // pour que la premiere image affichee ait deja le bon nombre de lignes
  const refZone = useCallback((element: HTMLDivElement | null) => {
    setZone(element)
    if (element !== null) {
      setHauteurZone(element.clientHeight)
    }
  }, [])

  // Pendant que le panneau s'ouvre ou que la fenetre change de taille, la zone change de hauteur
  useEffect(() => {
    if (!ecranFixe || zone === null) {
      return
    }
    const observateur = new ResizeObserver((entrees) => {
      for (const entree of entrees) {
        setHauteurZone(entree.contentRect.height)
      }
    })
    observateur.observe(zone)
    return () => observateur.disconnect()
  }, [ecranFixe, zone])

  const lignesParPage = ecranFixe
    ? Math.max(lignesMin, Math.floor((hauteurZone - hauteurEnTete) / hauteurLigne))
    : lignesParDefaut

  const nbPages = Math.max(1, Math.ceil(elements.length / lignesParPage))
  // Si la liste raccourcit (actualisation, filtre) ou si la zone grandit, on reste dans les pages qui existent
  const pageCourante = Math.min(page, nbPages - 1)
  const debut = pageCourante * lignesParPage
  const elementsPage = elements.slice(debut, debut + lignesParPage)

  const allerA = useCallback(
    (numero: number) => {
      setPage(Math.min(Math.max(numero, 0), nbPages - 1))
    },
    [nbPages],
  )

  return { refZone, elementsPage, debut, pageCourante, nbPages, lignesParPage, allerA }
}