// Elements dessines devant le corps et effets propres a certaines humeurs.
// Leur apparition est geree par le CSS (mascotte.css), selon data-humeur.

const PLI = 'color-mix(in srgb, var(--couleur-principale) 38%, black)'

type Proprietes = {
  // Identifiant unique de cette mascotte (le degrade des bras est defini dans membres.tsx).
  id: string
}

// Reflexion : le bras droit vient devant le corps, le poing sous le menton, pouce vers le haut.
export function MainMenton({ id }: Proprietes) {
  const remplissage = 'url(#' + id + '-bras)'

  return (
    <g className="mascotte-main-menton" aria-hidden="true">
      {/* Haut du bras, coude et avant-bras */}
      <path d="M170 108 L177 132" strokeWidth="12" strokeLinecap="round" stroke={remplissage} />
      <path d="M177 132 L138 137" strokeWidth="10.5" strokeLinecap="round" stroke={remplissage} />
      <circle cx="177" cy="132" r="6.3" fill={remplissage} />

      {/* Poing, pouce, plis des doigts, reflet */}
      <ellipse cx="121" cy="137" rx="9.8" ry="9" fill={remplissage} />
      <ellipse
        cx="118"
        cy="127.5"
        rx="3.8"
        ry="6.4"
        transform="rotate(-12 118 127.5)"
        fill={remplissage}
      />
      <path
        d="M117 135 L117 143 M121 135.5 L121 144 M125 135 L125 143"
        strokeWidth="1.3"
        strokeLinecap="round"
        style={{ stroke: PLI, opacity: 0.55 }}
      />
      <ellipse cx="117.5" cy="133" rx="3.6" ry="2.4" style={{ fill: 'white', opacity: 0.25 }} />
    </g>
  )
}

// Surpris : trois petits traits jaunes qui pulsent en haut a gauche.
export function TraitsSurprise() {
  return (
    <g
      className="mascotte-traits-surprise"
      aria-hidden="true"
      strokeWidth="4.2"
      strokeLinecap="round"
      style={{ stroke: 'var(--alerte)' }}
    >
      <path className="mascotte-trait" d="M24 56 L12 52" />
      <path className="mascotte-trait" style={{ animationDelay: '0.15s' }} d="M30 38 L20 30" />
      <path className="mascotte-trait" style={{ animationDelay: '0.3s' }} d="M46 24 L40 12" />
    </g>
  )
}