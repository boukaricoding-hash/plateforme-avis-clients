import type { ReactNode } from 'react'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'
import type { TypeQuestion } from '../types/tableau-de-bord'

// Icones de la page Questionnaires (ecran E10, jour 19) : graphe, actions, statistiques,
// panneau de detail et editeur.
// Meme style que les icones des avis : contour fin (trait de 1,75 sur une grille de 24 x 24),
// couleur du texte (currentColor). Taille par defaut 18 px, modifiable par le CSS ou par width et height.
// Les icones deja existantes ne sont pas refaites ici : IconeQuestionnaires (menu), IconeRecherche,
// IconeQuestions, IconeEpingle, IconeChevron, IconeCoche et IconeEnregistrer viennent de leurs fichiers.

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

// Fabrique une icone "libre" : grille et formes au choix, sans trait ni remplissage par defaut
function creerIconeLibre(grille: string, formes: ReactNode): ComposantIcone {
  return function Icone(props) {
    return (
      <svg viewBox={grille} fill="none" aria-hidden="true" focusable="false" {...props}>
        {formes}
      </svg>
    )
  }
}

// ------------------------------------------------------------
// Actions de la colonne du graphe et du panneau de detail
// ------------------------------------------------------------

export const IconeNouveauQuestionnaire = creerIconeContour(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="M12 11.5v5" />
    <path d="M9.5 14h5" />
  </>,
)

export const IconeModele = creerIconeContour(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M3 9h18" />
    <path d="M9 9v12" />
  </>,
)

export const IconeDupliquer = creerIconeContour(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </>,
)

export const IconeModifier = creerIconeContour(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
  </>,
)

// ------------------------------------------------------------
// Statuts, alerte et statistiques
// ------------------------------------------------------------

// Statut ACTIF
export const IconeStatutActif = creerIconeContour(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </>,
)

// Statut BROUILLON : on reprend IconeModifier (le crayon), declaree plus haut.

// Statut INACTIF
export const IconeStatutInactif = creerIconeContour(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9v6" />
    <path d="M14 9v6" />
  </>,
)

// Alerte sur un questionnaire (ex. actif sans point de contact)
export const IconeAttention = creerIconeContour(
  <>
    <path d="M12 4 21.5 20h-19L12 4Z" />
    <path d="M12 10v4" />
    <path d="M12 17.3h.01" />
  </>,
)

// ------------------------------------------------------------
// Editeur : boutons des questions
// ------------------------------------------------------------

export const IconeAjouter = creerIconeContour(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
)

export const IconeSupprimer = creerIconeContour(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4.5h6V7" />
    <path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
    <path d="M10 11v5" />
    <path d="M14 11v5" />
  </>,
)

export const IconeMonter = creerIconeContour(<path d="m6 15 6-6 6 6" />)

export const IconeDescendre = creerIconeContour(<path d="m6 9 6 6 6-6" />)

export const IconeFermer = creerIconeContour(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </>,
)

// ------------------------------------------------------------
// Une icone par type de question (les 8 types du backend)
// ------------------------------------------------------------

const IconeTypeEtoiles = creerIconeContour(
  <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />,
)

const IconeTypeEmojis = creerIconeContour(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.2a4 4 0 0 0 7 0" />
    <path d="M9 9.5h.01" />
    <path d="M15 9.5h.01" />
  </>,
)

const IconeTypeNps = creerIconeContour(
  <>
    <path d="M5 20v-5" />
    <path d="M10 20v-9" />
    <path d="M15 20V8" />
    <path d="M20 20V4" />
  </>,
)

const IconeTypeChoixUnique = creerIconeContour(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
  </>,
)

const IconeTypeChoixMultiple = creerIconeContour(
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="m8.5 12.3 2.4 2.4 4.6-5" />
  </>,
)

const IconeTypeOuiNon = creerIconeContour(
  <>
    <rect x="2.5" y="7" width="19" height="10" rx="5" />
    <circle cx="16.5" cy="12" r="2.5" />
  </>,
)

const IconeTypeEchelle = creerIconeContour(
  <>
    <path d="M4 12h16" />
    <path d="M4 9v6" />
    <path d="M20 9v6" />
    <circle cx="10" cy="12" r="2.5" />
  </>,
)

const IconeTypeTexteLibre = creerIconeContour(
  <>
    <path d="M4 6h16" />
    <path d="M4 11h16" />
    <path d="M4 16h10" />
  </>,
)

// Icone de chaque type de question : const Icone = iconesParType[question.type]
export const iconesParType: Record<TypeQuestion, ComposantIcone> = {
  ETOILES: IconeTypeEtoiles,
  EMOJIS: IconeTypeEmojis,
  NPS: IconeTypeNps,
  CHOIX_UNIQUE: IconeTypeChoixUnique,
  CHOIX_MULTIPLE: IconeTypeChoixMultiple,
  OUI_NON: IconeTypeOuiNon,
  ECHELLE: IconeTypeEchelle,
  TEXTE_LIBRE: IconeTypeTexteLibre,
}

// ------------------------------------------------------------
// Etat vide du panneau de detail (aucun questionnaire choisi)
// ------------------------------------------------------------

// Grande icone avec un anneau qui pulse. L'animation de l'anneau est dans le CSS
// (classe qdet-vide-anneau) ; la taille vient du conteneur.
export const IconeVideSelection = creerIconeLibre(
  '0 0 80 80',
  <>
    <rect x="14" y="18" width="52" height="34" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.35" />
    <path d="M22 26H42M22 34H36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
    <circle cx="52" cy="42" r="4.5" className="qdet-vide-anneau" stroke="currentColor" strokeWidth="2" />
    <circle cx="52" cy="42" r="4.5" fill="currentColor" />
  </>,
)