import { CLAIR } from '../constantes'

// Les bras sont un peu plus clairs en haut (la lumiere vient d'en haut) et plus sombres en bas.
const BRAS_CLAIR = 'color-mix(in srgb, var(--couleur-principale) 90%, black)'
const BRAS_SOMBRE = 'color-mix(in srgb, var(--couleur-principale) 62%, black)'
// Plis entre les doigts du poing.
const PLI = 'color-mix(in srgb, var(--couleur-principale) 38%, black)'

type Proprietes = {
  // Identifiant unique de cette mascotte, pour le degrade des bras.
  id: string
}

// Un bras gauche, dessine le long du corps (pose de repos), avec ses deux articulations :
// - le bras (epaule en 32,104) pivote autour de l'epaule ;
// - l'avant-bras et la main (coude en 22,120) pivotent autour du coude.
// Les membres sont fins vers le poignet. La main existe en deux versions : un poing
// (pose de repos, bras leves) et une main ouverte (coucou). Le CSS choisit laquelle voir.
// Le bras droit est le meme dessin retourne comme dans un miroir : les deux cotes
// utilisent donc exactement les memes angles (voir mascotte.css).
function BrasDessine({ id }: Proprietes) {
  const remplissage = 'url(#' + id + '-bras)'

  return (
    <g className="mascotte-haut-bras">
      {/* Epaule, haut du bras et coude */}
      <circle cx="32" cy="104" r="7.5" fill={remplissage} />
      <path d="M38.4 108.0 L27.3 123.3 L16.7 116.7 L25.6 100.0 Z" fill={remplissage} />
      <circle cx="22" cy="120" r="6.2" fill={remplissage} />
      <path
        d="M25 104.5 L19.5 116"
        strokeWidth="2.4"
        strokeLinecap="round"
        style={{ stroke: CLAIR, opacity: 0.3 }}
      />

      <g className="mascotte-avant-bras">
        {/* Avant-bras et poignet */}
        <path d="M28.2 120.0 L27.2 134.0 L16.8 134.0 L15.8 120.0 Z" fill={remplissage} />
        <circle cx="22" cy="134" r="5.2" fill={remplissage} />
        <path
          d="M19 123 L18.7 133"
          strokeWidth="2.4"
          strokeLinecap="round"
          style={{ stroke: CLAIR, opacity: 0.3 }}
        />

        {/* Pouce, du cote exterieur */}
        <ellipse
          cx="13.6"
          cy="138"
          rx="3.8"
          ry="6.4"
          transform="rotate(28 13.6 138)"
          fill={remplissage}
        />

        {/* Poing : paume ronde, plis des doigts, reflet */}
        <g className="mascotte-main-poing">
          <ellipse cx="22" cy="141.5" rx="9.6" ry="8.8" fill={remplissage} />
          <path
            d="M18.6 142 L18.6 149 M22 142 L22 150 M25.4 142 L25.4 149"
            strokeWidth="1.3"
            strokeLinecap="round"
            style={{ stroke: PLI, opacity: 0.55 }}
          />
          <ellipse cx="19" cy="137.8" rx="3.8" ry="2.6" style={{ fill: 'white', opacity: 0.25 }} />
        </g>

        {/* Main ouverte : quatre doigts ecartes et une paume */}
        <g className="mascotte-main-ouverte">
          <g
            strokeWidth="4.2"
            strokeLinecap="round"
            fill="none"
            style={{ stroke: BRAS_SOMBRE }}
          >
            <path d="M16.2 146 L14.4 157.5" />
            <path d="M20.4 147 L19.8 160.5" />
            <path d="M24.6 147 L25.2 160" />
            <path d="M28.8 146 L30.8 156" />
          </g>
          <ellipse cx="22" cy="141.5" rx="9" ry="8" fill={remplissage} />
          <ellipse cx="19.2" cy="138.4" rx="3.6" ry="2.4" style={{ fill: 'white', opacity: 0.25 }} />
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