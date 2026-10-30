import { CLAIR, OMBRE_CHAUDE } from '../constantes'

// Les bras sont de la couleur du corps en haut et un peu plus sombres en bas (ils sont derriere le corps).
const BRAS_CLAIR = 'var(--couleur-principale)'
const BRAS_SOMBRE = 'color-mix(in srgb, var(--couleur-principale) 84%, ' + OMBRE_CHAUDE + ')'
// Plis entre les doigts du poing.
const PLI = 'color-mix(in srgb, var(--couleur-principale) 38%, black)'

type Proprietes = {
  // Identifiant unique de cette mascotte, pour le degrade des bras.
  id: string
}

// Un bras gauche, dessine le long du corps (pose de repos), avec ses deux articulations :
// - le bras (epaule en 24,108) pivote autour de l'epaule ;
// - l'avant-bras et la main (coude en 14,122) pivotent autour du coude.
// Les membres sont gros et arrondis, comme ceux d'un personnage de dessin anime.
// La main existe en deux versions : un poing (pose de repos) et une main ouverte a quatre
// doigts (coucou). Le CSS choisit laquelle voir.
// Le bras droit est le meme dessin retourne comme dans un miroir : les deux cotes
// utilisent donc exactement les memes angles (voir mascotte.css).
function BrasDessine({ id }: Proprietes) {
  const remplissage = 'url(#' + id + '-bras)'

  return (
    <g className="mascotte-haut-bras">
      {/* Epaule, haut du bras et coude */}
      <circle cx="24" cy="108" r="8" fill={remplissage} />
      <path
        d="M24 108 L14 122"
        strokeWidth="14"
        strokeLinecap="round"
        stroke={remplissage}
      />
      <path
        d="M22 106 L15 116"
        strokeWidth="2.4"
        strokeLinecap="round"
        style={{ stroke: CLAIR, opacity: 0.3 }}
      />

      <g className="mascotte-avant-bras">
        {/* Avant-bras */}
        <path
          d="M14 122 L14 135"
          strokeWidth="12.5"
          strokeLinecap="round"
          stroke={remplissage}
        />

        {/* Pouce, du cote exterieur */}
        <ellipse
          cx="4.6"
          cy="141"
          rx="4"
          ry="6.4"
          transform="rotate(28 4.6 141)"
          fill={remplissage}
        />

        {/* Poing : paume ronde, plis des doigts, reflet */}
        <g className="mascotte-main-poing">
          <ellipse cx="14" cy="144.5" rx="10.8" ry="10" fill={remplissage} />
          <path
            d="M10.4 145 L10.4 153 M14 145 L14 154 M17.6 145 L17.6 153"
            strokeWidth="1.3"
            strokeLinecap="round"
            style={{ stroke: PLI, opacity: 0.55 }}
          />
          <ellipse cx="10.6" cy="140.4" rx="4" ry="2.8" style={{ fill: 'white', opacity: 0.25 }} />
        </g>

        {/* Main ouverte : quatre doigts ronds et une paume */}
        <g className="mascotte-main-ouverte">
          <g
            strokeWidth="5.4"
            strokeLinecap="round"
            fill="none"
            style={{ stroke: BRAS_SOMBRE }}
          >
            <path d="M7.6 149 L6 157" />
            <path d="M12 151 L11.6 159.5" />
            <path d="M16.4 151 L17 159" />
            <path d="M20.4 149 L22.4 156" />
          </g>
          <ellipse cx="14" cy="144.5" rx="10.4" ry="9.2" fill={remplissage} />
          <ellipse cx="10.8" cy="140.6" rx="3.8" ry="2.6" style={{ fill: 'white', opacity: 0.25 }} />
        </g>
      </g>
    </g>
  )
}

// Les deux bras, dessines derriere le corps.
export function Bras({ id }: Proprietes) {
  return (
    <>
      <defs>
        <linearGradient
          id={id + '-bras'}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="100"
          x2="0"
          y2="152"
        >
          <stop offset="0%" style={{ stopColor: BRAS_CLAIR }} />
          <stop offset="100%" style={{ stopColor: BRAS_SOMBRE }} />
        </linearGradient>
      </defs>
      <g className="mascotte-bras-g">
        <BrasDessine id={id} />
      </g>
      {/* Miroir autour de la ligne verticale du milieu (x = 100) */}
      <g className="mascotte-bras-d" transform="translate(200 0) scale(-1 1)">
        <BrasDessine id={id} />
      </g>
    </>
  )
}