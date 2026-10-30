import { CLAIR, CORPS, OMBRE_CHAUDE, QUEUE, SOMBRE } from '../constantes'

// Reflet doux du haut et lumiere du bord : tires de la couleur principale.
const LUMIERE_BORD = 'color-mix(in srgb, var(--couleur-principale) 55%, white)'
const MILIEU_SOMBRE = 'color-mix(in srgb, var(--couleur-principale) 86%, ' + OMBRE_CHAUDE + ')'

type Proprietes = {
  // Identifiant unique de cette mascotte, pour les degrades et les masques.
  id: string
}

// Le corps : une bulle de dialogue en volume, eclairee d'en haut.
// - degrade vertical en 4 tons (clair en haut, couleur principale, puis de plus en plus sombre) ;
// - petite ombre sous le corps et ombre de contact au-dessus de la queue ;
// - gros reflet brillant en haut a gauche, trait net le long du coin, petits points ;
// - fin lisere clair en haut a droite.
// Que des degrades : pas de filtre SVG, donc leger meme sur un petit telephone.
export function Corps({ id }: Proprietes) {
  return (
    <>
      <defs>
        {/* Degrade principal : clair en haut, sombre en bas */}
        <linearGradient
          id={id + '-corps'}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="28"
          x2="0"
          y2="150"
        >
          <stop offset="0%" style={{ stopColor: CLAIR }} />
          <stop offset="35%" style={{ stopColor: 'var(--couleur-principale)' }} />
          <stop offset="80%" style={{ stopColor: MILIEU_SOMBRE }} />
          <stop offset="100%" style={{ stopColor: SOMBRE }} />
        </linearGradient>

        {/* Ombre de contact au-dessus de la queue */}
        <radialGradient id={id + '-contact'}>
          <stop offset="0%" stopColor="black" stopOpacity="0.3" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>

        {/* La queue devient plus sombre vers sa pointe */}
        <linearGradient
          id={id + '-queue'}
          gradientUnits="userSpaceOnUse"
          x1="90"
          y1="146"
          x2="60"
          y2="174"
        >
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.3" />
        </linearGradient>

        {/* Gros reflet brillant en haut a gauche */}
        <radialGradient
          id={id + '-reflet'}
          gradientUnits="userSpaceOnUse"
          cx="62"
          cy="46"
          r="40"
        >
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        {/* Tout ce qui est dessine dans le corps reste dans le corps */}
        <clipPath id={id + '-decoupe'}>
          <path d={CORPS} />
        </clipPath>
      </defs>

      {/* Forme de base : remplissage et contour en degrade */}
      <path
        d={CORPS}
        strokeWidth="4"
        strokeLinejoin="round"
        style={{ fill: 'url(#' + id + '-corps)', stroke: 'url(#' + id + '-corps)' }}
      />

      {/* Reflet et ombre de contact, decoupes dans le corps */}
      <g clipPath={'url(#' + id + '-decoupe)'}>
        <ellipse
          cx="62"
          cy="46"
          rx="40"
          ry="20"
          transform="rotate(-18 62 46)"
          fill={'url(#' + id + '-reflet)'}
        />
        <ellipse cx="94" cy="148" rx="26" ry="8" fill={'url(#' + id + '-contact)'} />
      </g>

      {/* Queue plus sombre */}
      <path d={QUEUE} fill={'url(#' + id + '-queue)'} />

      {/* Trait brillant le long du coin, petit point, lisere clair en haut a droite */}
      <path
        d="M34 64 Q36 44 58 36"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: 'white', opacity: 0.5 }}
      />
      <circle cx="70" cy="34" r="2.4" style={{ fill: 'white', opacity: 0.7 }} />
      <path
        d="M132 36 Q150 38 158 52"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ stroke: LUMIERE_BORD, opacity: 0.6 }}
      />
    </>
  )
}