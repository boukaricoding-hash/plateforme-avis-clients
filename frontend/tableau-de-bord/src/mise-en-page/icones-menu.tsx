import type { ReactNode } from 'react'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'

// Icones de la barre laterale : les 8 entrees du menu, le chevron des groupes,
// le bouton replier et la deconnexion.
// Icones en contour fin (trait de 1,75 sur une grille de 24 x 24), couleur du texte
// (currentColor) et taille donnee par le CSS.

// Fabrique une icone en contour a partir de ses formes SVG
function creerIconeContour(formes: ReactNode): ComposantIcone {
  return function Icone(props) {
    return (
      <svg
        viewBox="0 0 24 24"
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

// Entrees du menu
export const IconeTableauDeBord = creerIconeContour(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
)
export const IconeAvis = creerIconeContour(
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />,
)
export const IconeQuestionnaires = creerIconeContour(
  <>
    <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
    <path d="M9 12h6M9 16h4" />
  </>,
)
export const IconeQrCodes = creerIconeContour(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" />
  </>,
)
export const IconeSites = creerIconeContour(
  <>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>,
)
export const IconeUtilisateurs = creerIconeContour(
  <>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.9a3.25 3.25 0 0 1 0 6.2M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
  </>,
)
export const IconeExports = creerIconeContour(
  <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
)
export const IconeParametres = creerIconeContour(
  <>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </>,
)

// Chevron vers le bas : le CSS le fait tourner quand le groupe se ferme
export const IconeChevron = creerIconeContour(<path d="m6 9 6 6 6-6" />)

// Bouton replier ou deplier le menu : meme icone dans les deux etats (panneau avec sa colonne)
export const IconeBasculerMenu = creerIconeContour(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9 4v16" />
  </>,
)

// Bouton de deconnexion du bloc utilisateur
export const IconeDeconnexion = creerIconeContour(
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
)