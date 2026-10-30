import { CLAIR, FONCE } from '../constantes'

// Un bras gauche, dessine le long du corps (pose de repos), avec ses deux articulations :
// - le bras (epaule en 32,104) pivote autour de l'epaule ;
// - l'avant-bras et la main (coude en 22,120) pivotent autour du coude.
// Les membres sont fins vers le poignet, la main a un pouce (visible a l'exterieur au repos).
// Le bras droit est le meme dessin retourne comme dans un miroir : les deux cotes
// utilisent donc exactement les memes angles (voir mascotte.css).
function BrasDessine() {
  return (
    <g className="mascotte-haut-bras">
      {/* Epaule, haut du bras et coude */}
      <circle cx="32" cy="104" r="7.5" style={{ fill: FONCE }} />
      <path d="M38.4 108.0 L27.3 123.3 L16.7 116.7 L25.6 100.0 Z" style={{ fill: FONCE }} />
      <circle cx="22" cy="120" r="6.2" style={{ fill: FONCE }} />
      <path
        d="M25 104.5 L19.5 116"
        strokeWidth="2.4"
        strokeLinecap="round"
        style={{ stroke: CLAIR, opacity: 0.3 }}
      />

      <g className="mascotte-avant-bras">
        {/* Avant-bras */}
        <path d="M28.2 120.0 L27.2 134.0 L16.8 134.0 L15.8 120.0 Z" style={{ fill: FONCE }} />
        <circle cx="22" cy="134" r="5.2" style={{ fill: FONCE }} />
        <path
          d="M19 123 L18.7 133"
          strokeWidth="2.4"
          strokeLinecap="round"
          style={{ stroke: CLAIR, opacity: 0.3 }}
        />

        {/* Main : pouce du cote exterieur au repos, puis paume ronde */}
        <ellipse
          cx="13.8"
          cy="137.5"
          rx="3.6"
          ry="6"
          transform="rotate(28 13.8 137.5)"
          style={{ fill: FONCE }}
        />
        <circle cx="22" cy="141" r="9" style={{ fill: FONCE }} />
        <ellipse cx="19" cy="138" rx="3.6" ry="2.6" style={{ fill: 'white', opacity: 0.22 }} />
      </g>
    </g>
  )
}

// Les deux bras, dessines derriere le corps.
export function Bras() {
  return (
    <>
      <g className="mascotte-bras-g">
        <BrasDessine />
      </g>
      {/* Miroir autour de la ligne verticale du milieu (x = 100) */}
      <g className="mascotte-bras-d" transform="translate(200 0) scale(-1 1)">
        <BrasDessine />
      </g>
    </>
  )
}