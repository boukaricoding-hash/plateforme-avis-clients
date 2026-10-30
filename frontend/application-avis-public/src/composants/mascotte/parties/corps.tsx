import { CLAIR, CORPS, QUEUE, SOMBRE } from '../constantes'

type Proprietes = {
  // Identifiant unique de cette mascotte, pour les degrades et les masques.
  id: string
}

// Le corps : une bulle de dialogue en volume. La lumiere vient d'en haut a gauche.
// - degrade en 3 tons (clair, couleur principale, sombre) ;
// - ombre de forme : le bas droit s'assombrit doucement ;
// - bord eclaire fin cote ombre (la lumiere qui contourne la bulle) ;
// - ombre de contact au-dessus de la queue, et queue plus sombre ;
// - reflet net en haut a gauche.
// Que des degrades : pas de filtre SVG, donc leger meme sur un petit telephone.
export function Corps({ id }: Proprietes) {
  return (
    <>
      <defs>
        {/* Degrade principal, 3 tons */}
        <linearGradient
          id={id + '-corps'}
          gradientUnits="userSpaceOnUse"
          x1="46"
          y1="30"
          x2="156"
          y2="182"
        >
          <stop offset="0%" style={{ stopColor: CLAIR }} />
          <stop offset="48%" style={{ stopColor: 'var(--couleur-principale)' }} />
          <stop offset="100%" style={{ stopColor: SOMBRE }} />
        </linearGradient>

        {/* Ombre de forme : transparente cote lumiere, de plus en plus sombre vers le bas droit */}
        <radialGradient
          id={id + '-forme'}
          gradientUnits="userSpaceOnUse"
          cx="70"
          cy="62"
          r="140"
        >
          <stop offset="55%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.22" />
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
          <stop offset="55%" style={{ stopColor: CLAIR, stopOpacity: 0 }} />
          <stop offset="100%" style={{ stopColor: CLAIR, stopOpacity: 0.75 }} />
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
          <stop offset="100%" stopColor="black" stopOpacity="0.28" />
        </linearGradient>

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

      {/* Ombre de forme et ombre de contact, decoupees dans le corps */}
      <g clipPath={'url(#' + id + '-decoupe)'}>
        <rect x="20" y="24" width="160" height="160" fill={'url(#' + id + '-forme)'} />
        <ellipse cx="94" cy="148" rx="26" ry="8" fill={'url(#' + id + '-contact)'} />
      </g>

      {/* Queue plus sombre */}
      <path d={QUEUE} fill={'url(#' + id + '-queue)'} />

      {/* Bord eclaire cote ombre */}
      <path
        d={CORPS}
        strokeWidth="3"
        strokeLinejoin="round"
        fill="none"
        stroke={'url(#' + id + '-bord)'}
      />

      {/* Reflet : zone douce, trait net le long du coin, deux petits points */}
      <ellipse
        cx="64"
        cy="48"
        rx="22"
        ry="9"
        transform="rotate(-24 64 48)"
        style={{ fill: 'white', opacity: 0.18 }}
      />
      <path
        d="M40 76 A34 34 0 0 1 74 42"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: 'white', opacity: 0.55 }}
      />
      <circle cx="88" cy="41" r="2.4" style={{ fill: 'white', opacity: 0.6 }} />
      <circle cx="36" cy="92" r="1.8" style={{ fill: 'white', opacity: 0.45 }} />
    </>
  )
}