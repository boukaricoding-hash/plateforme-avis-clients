import type { ComposantIcone } from '../composants-tableau/icones-accueil'

// Icones de la barre laterale : chevron des groupes, replier et deplier le menu, deconnexion.
// Meme principe que composants-tableau/icones-accueil.tsx : trace SVG sur une grille de 24 x 24,
// couleur du texte (currentColor) et taille donnee par le CSS.

// Fabrique une icone a partir d'un trace SVG sur une grille de 24 x 24
function creerIcone(chemin: string): ComposantIcone {
  return function Icone(props) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
        <path d={chemin} />
      </svg>
    )
  }
}

// Chevron vers le bas : le CSS le fait tourner quand le groupe se ferme
export const IconeChevron = creerIcone('M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41Z')

// Bouton du bas du menu : replier (fleche vers la barre) et deplier (fleche qui s'en eloigne)
export const IconeReplier = creerIcone(
  'M18.41 16.59 13.82 12l4.59-4.59L17 6l-6 6 6 6 1.41-1.41ZM6 6h2v12H6V6Z',
)
export const IconeDeplier = creerIcone(
  'M5.59 7.41 10.18 12l-4.59 4.59L7 18l6-6-6-6-1.41 1.41ZM16 6h2v12h-2V6Z',
)

// Bouton de deconnexion du bloc utilisateur
export const IconeDeconnexion = creerIcone(
  'm17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5ZM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5Z',
)