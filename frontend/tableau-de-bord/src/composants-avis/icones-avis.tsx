import type { ReactNode } from 'react'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'

// Icones de la page des avis (jour 15 design) : barre de filtres, cartes de la liste, detail d'un avis.
// Meme style que les icones du menu : contour fin (trait de 1,75 sur une grille de 24 x 24),
// couleur du texte (currentColor). Taille par defaut 18 px, modifiable avec width et height.
// L'etoile de la note reste IconeNoteMoyenne (icones-accueil.tsx).

// Fabrique une icone en contour a partir de ses formes SVG
function creerIconeContour(formes: ReactNode): ComposantIcone {
  return function Icone(props) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {formes}
      </svg>
    )
  }
}

// Barre de filtres
export const IconeRecherche = creerIconeContour(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
)
export const IconeCalendrier = creerIconeContour(
  <>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </>,
)
export const IconeEpingle = creerIconeContour(
  <>
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </>,
)
export const IconeTable = creerIconeContour(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </>,
)
export const IconeDocument = creerIconeContour(
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </>,
)
export const IconeFiltresStatut = creerIconeContour(
  <>
    <path d="M21 4H14" />
    <path d="M10 4H3" />
    <path d="M21 12H12" />
    <path d="M8 12H3" />
    <path d="M21 20H16" />
    <path d="M12 20H3" />
    <path d="M14 2v4" />
    <path d="M8 10v4" />
    <path d="M16 18v4" />
  </>,
)
export const IconeActualiser = creerIconeContour(
  <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>,
)
export const IconeFlecheDroite = creerIconeContour(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
)

// Liste et pagination
export const IconeChevronDroite = creerIconeContour(<path d="m9 18 6-6-6-6" />)
export const IconeChevronGauche = creerIconeContour(<path d="m15 18-6-6 6-6" />)

// Detail d'un avis
export const IconeScore = creerIconeContour(
  <>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </>,
)
export const IconeCommentaire = creerIconeContour(
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
)
export const IconeReponses = creerIconeContour(
  <>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </>,
)
export const IconeHorloge = creerIconeContour(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>,
)
export const IconeUtilisateur = creerIconeContour(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>,
)
export const IconeEnregistrer = creerIconeContour(
  <>
    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
    <path d="M7 3v4a1 1 0 0 0 1 1h7" />
  </>,
)
export const IconeCoche = creerIconeContour(<path d="M20 6 9 17l-5-5" />)