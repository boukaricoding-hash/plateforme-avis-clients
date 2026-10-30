import { CLAIR, CORPS, QUEUE, SOMBRE } from '../constantes'

// Lumiere du bord (cote ombre) et lumiere qui rebondit sur le sol : toutes deux tirees
// de la couleur principale, donc elles suivent la teinte de l'organisation.
const LUMIERE_BORD = 'color-mix(in srgb, var(--couleur-principale) 50%, white)'
const LUMIERE_REBOND = 'color-mix(in srgb, var(--couleur-principale) 60%, white)'
const MILIEU_SOMBRE = 'color-mix(in srgb, var(--couleur-principale) 92%, black)'

type Proprietes = {
  // Identifiant unique de cette mascotte, pour les degrades et les masques.
  id: string
}

// Le corps : une bulle de dialogue en volume. La lumiere vient d'en haut a gauche.
// - degrade en 4 tons (clair, couleur principale, un peu plus sombre, sombre) ;
// - ombre de forme : le bas droit s'assombrit, et le dessous du corps encore plus ;
// - lumiere de rebond discrete en bas a droite ;
// - bord eclaire cote ombre (la lumiere qui contourne la bulle) ;
// - ombre de contact au-dessus de la queue, et queue plus sombre ;
// - gros reflet doux, trait net le long du coin et petits points.
// Que des degrades : pas de filtre SVG, donc leger meme sur un petit telephone.
export function Corps({ id }: Proprietes) {
  return (
    <>
      <defs>
        {/* Degrade principal, 4 tons */}
        <linearGradient
          id={id + '-corps'}
          gradientUnits="userSpaceOnUse"
          x1="46"
          y1="30"
          x2="156"
          y2="182"
        >
          <stop offset="0%" style={{ stopColor: CLAIR }} />
          <stop offset="38%" style={{ stopColor: 'var(--couleur-principale)' }} />
          <stop offset="72%" style={{ stopColor: MILIEU_SOMBRE }} />
          <stop offset="100%" style={{ stopColor: SOMBRE }} />
        </linearGradient>

        {/* Ombre de forme : transparente cote lumiere, de plus en plus sombre vers le bas droit */}
        <radialGradient
          id={id + '-forme'}
          gradientUnits="userSpaceOnUse"
          cx="68"
          cy="58"
          r="140"
        >
          <stop offset="45%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.3" />
        </radialGradient>

        {/* Dessous du corps plus sombre */}
        <linearGradient
          id={id + '-dessous'}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="108"
          x2="0"
          y2="152"
        >
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.2" />
        </linearGradient>

        {/* Lumiere qui rebondit sur le sol, en bas a droite */}
        <radialGradient
          id={id + '-rebond'}
          gradientUnits="userSpaceOnUse"
          cx="150"
          cy="132"
          r="44"
        >
          <stop offset="0%" style={{ stopColor: LUMIERE_REBOND, stopOpacity: 0.4 }} />
          <stop offset="100%" style={{ stopColor: LUMIERE_REBOND, stopOpacity: 0 }} />
        </radialGradient>

        {/* Bord eclaire : visible seulement vers le bas droit */}
        <linearGradient
          id={id + '-bord'}
          gradientUnits="userSpaceOnUse"
          x1="40"
          y1="40"
          x2="170"
          y2="160"
        >
          <stop offset="50%" style={{ stopColor: LUMIERE_BORD, stopOpacity: 0 }} />
          <stop offset="100%" style={{ stopColor: LUMIERE_BORD, stopOpacity: 0.95 }} />
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
          x2="54"
          y2="178"
        >
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.3" />
        </linearGradient>

        {/* Gros reflet doux en haut a gauche */}
        <radialGradient
          id={id + '-reflet'}
          gradientUnits="userSpaceOnUse"
          cx="62"
          cy="48"
          r="32"
        >
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
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
        strokeWidth="6"
        strokeLinejoin="round"
        style={{ fill: 'url(#' + id + '-corps)', stroke: 'url(#' + id + '-corps)' }}
      />

      {/* Ombres et lumieres de volume, decoupees dans le corps */}
      <g clipPath={'url(#' + id + '-decoupe)'}>
        <rect x="20" y="24" width="160" height="160" fill={'url(#' + id + '-forme)'} />
        <rect x="20" y="24" width="160" height="160" fill={'url(#' + id + '-dessous)'} />
        <rect x="20" y="24" width="160" height="160" fill={'url(#' + id + '-rebond)'} />
        <ellipse cx="94" cy="148" rx="26" ry="8" fill={'url(#' + id + '-contact)'} />
      </g>

      {/* Queue plus sombre */}
      <path d={QUEUE} fill={'url(#' + id + '-queue)'} />

      {/* Bord eclaire cote ombre */}
      <path
        d={CORPS}
        strokeWidth="3.4"
        strokeLinejoin="round"
        fill="none"
        stroke={'url(#' + id + '-bord)'}
      />

      {/* Reflet : zone douce, trait net le long du coin, petits points */}
      <ellipse
        cx="62"
        cy="48"
        rx="32"
        ry="16"
        transform="rotate(-24 62 48)"
        fill={'url(#' + id + '-reflet)'}
      />
      <path
        d="M40 76 A34 34 0 0 1 74 42"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: 'white', opacity: 0.6 }}
      />
      <circle cx="88" cy="41" r="2.6" style={{ fill: 'white', opacity: 0.65 }} />
      <circle cx="36" cy="92" r="1.9" style={{ fill: 'white', opacity: 0.5 }} />
    </>
  )
}