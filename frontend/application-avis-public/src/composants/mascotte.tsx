import { useId } from 'react'
import type { CSSProperties } from 'react'

// Les humeurs de la mascotte. Chaque ecran choisit celle qui lui va :
// - accueil : elle sourit et fait coucou ;
// - attentif : elle regarde la question ;
// - content : bonne note, elle saute de joie ;
// - triste : mauvaise note, elle est embetee (sans dramatiser) ;
// - ecoute : le client ecrit son commentaire, elle penche la tete ;
// - ravi : merci, elle est ravie et il y a des confettis.
export type HumeurMascotte = 'accueil' | 'attentif' | 'content' | 'triste' | 'ecoute' | 'ravi'

type Proprietes = {
  humeur: HumeurMascotte
  // Largeur en pixels (la hauteur suit).
  taille?: number
  className?: string
  // Texte lu par les lecteurs d'ecran. Sans lui, la mascotte est purement decoratrice.
  titre?: string
}

// Couleurs tirees de la couleur principale de l'organisation : la mascotte change de teinte
// avec elle. Le reste vient de tes variables (texte, decor, alerte, info...).
const CLAIR = 'color-mix(in srgb, var(--couleur-principale) 62%, white)'
const FONCE = 'color-mix(in srgb, var(--couleur-principale) 78%, black)'
const JOUE = 'color-mix(in srgb, var(--couleur-decor) 70%, white)'

// Forme du corps : une bulle de dialogue avec sa petite queue en bas a gauche.
const CORPS =
  'M74 30 H126 A46 46 0 0 1 172 76 V102 A46 46 0 0 1 126 148 H106 Q88 152 54 178 Q68 162 76 148 A46 46 0 0 1 28 102 V76 A46 46 0 0 1 74 30 Z'

// Etoile a 4 branches (centree sur 0,0) pour les eclats.
const ETOILE = 'M0 -9 Q1.6 -1.6 9 0 Q1.6 1.6 0 9 Q-1.6 1.6 -9 0 Q-1.6 -1.6 0 -9 Z'

// Confettis du merci : position, couleur, retard et duree de chute.
const CONFETTIS = [
  { x: 18, c: 'var(--couleur-decor)', r: 0, d: 2.4 },
  { x: 40, c: 'var(--alerte)', r: 0.5, d: 2.8 },
  { x: 62, c: 'var(--info)', r: 0.2, d: 2.5 },
  { x: 84, c: 'var(--succes)', r: 0.9, d: 3 },
  { x: 106, c: 'var(--couleur-principale)', r: 0.3, d: 2.6 },
  { x: 128, c: 'var(--alerte)', r: 1.1, d: 2.9 },
  { x: 150, c: 'var(--couleur-decor)', r: 0.6, d: 2.5 },
  { x: 172, c: 'var(--info)', r: 0.1, d: 2.7 },
  { x: 30, c: 'var(--succes)', r: 1.3, d: 3 },
  { x: 140, c: 'var(--couleur-principale)', r: 1.5, d: 2.6 },
]

// Tous les mouvements et toutes les poses. Les noms commencent par « mascotte- ».
// Une humeur = un attribut data-humeur sur le dessin : le CSS fait apparaitre la bonne bouche,
// les bons sourcils, la bonne pose des bras, avec un fondu doux entre deux humeurs.
const STYLES = `
@keyframes mascotte-flotte {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes mascotte-saut {
  0%, 100% { transform: translateY(0) scale(1.03, 0.96); }
  40% { transform: translateY(-14px) scale(0.98, 1.03); }
  70% { transform: translateY(0) scale(1.03, 0.96); }
}
@keyframes mascotte-saut-grand {
  0%, 100% { transform: translateY(0) scale(1.04, 0.95); }
  40% { transform: translateY(-22px) scale(0.97, 1.04) rotate(-3deg); }
  70% { transform: translateY(0) scale(1.04, 0.95); }
}
@keyframes mascotte-affaisse {
  0%, 100% { transform: translateY(2px) rotate(-2deg) scale(1, 0.97); }
  50% { transform: translateY(4px) rotate(-1deg) scale(1, 0.96); }
}
@keyframes mascotte-penche {
  0%, 100% { transform: rotate(4deg); }
  50% { transform: rotate(7deg) translateY(-2px); }
}
@keyframes mascotte-regarde {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(-4deg) translateY(-2px); }
}
@keyframes mascotte-clignement {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.08); }
}
@keyframes mascotte-coucou {
  0%, 100% { transform: rotate(-135deg); }
  50% { transform: rotate(-172deg); }
}
@keyframes mascotte-eclat {
  0%, 100% { opacity: 0.25; transform: scale(0.6) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.1) rotate(25deg); }
}
@keyframes mascotte-goutte {
  0% { transform: translateY(0); opacity: 0; }
  20% { opacity: 0.9; }
  100% { transform: translateY(18px); opacity: 0; }
}
@keyframes mascotte-confetti {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(200px) rotate(320deg); opacity: 0.9; }
}

.mascotte-corps {
  transform-box: view-box;
  transform-origin: 100px 190px;
  animation: mascotte-flotte 3.4s ease-in-out infinite;
}
.mascotte[data-humeur='content'] .mascotte-corps { animation: mascotte-saut 1.5s ease-in-out infinite; }
.mascotte[data-humeur='ravi'] .mascotte-corps { animation: mascotte-saut-grand 1.1s ease-in-out infinite; }
.mascotte[data-humeur='triste'] .mascotte-corps { animation: mascotte-affaisse 4s ease-in-out infinite; }
.mascotte[data-humeur='ecoute'] .mascotte-corps { animation: mascotte-penche 3.6s ease-in-out infinite; }
.mascotte[data-humeur='attentif'] .mascotte-corps { animation: mascotte-regarde 3.8s ease-in-out infinite; }

.mascotte-yeux {
  transform-box: view-box;
  transform-origin: 100px 86px;
  animation: mascotte-clignement 5s ease-in-out infinite;
}
.mascotte-pupilles { transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.mascotte[data-humeur='attentif'] .mascotte-pupilles { transform: translate(4px, 3px); }
.mascotte[data-humeur='ecoute'] .mascotte-pupilles { transform: translate(-3px, -4px); }
.mascotte[data-humeur='triste'] .mascotte-pupilles { transform: translate(0, 4px); }
.mascotte[data-humeur='content'] .mascotte-pupilles { transform: translate(0, -1px); }

.mascotte-bras {
  transform-box: view-box;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mascotte-bras-g { transform-origin: 30px 104px; }
.mascotte-bras-d { transform-origin: 170px 104px; }
.mascotte[data-humeur='accueil'] .mascotte-bras-d { animation: mascotte-coucou 1.2s ease-in-out infinite; }
.mascotte[data-humeur='content'] .mascotte-bras-g { transform: rotate(140deg); }
.mascotte[data-humeur='content'] .mascotte-bras-d { transform: rotate(-140deg); }
.mascotte[data-humeur='ravi'] .mascotte-bras-g { transform: rotate(160deg); }
.mascotte[data-humeur='ravi'] .mascotte-bras-d { transform: rotate(-160deg); }

/* Les variantes (bouches, sourcils, yeux, extras) sont toutes dessinees, une seule est visible. */
.mascotte-v { opacity: 0; transition: opacity 0.3s ease; }
.mascotte[data-humeur='accueil'] .mascotte-v-accueil,
.mascotte[data-humeur='attentif'] .mascotte-v-attentif,
.mascotte[data-humeur='content'] .mascotte-v-content,
.mascotte[data-humeur='triste'] .mascotte-v-triste,
.mascotte[data-humeur='ecoute'] .mascotte-v-ecoute,
.mascotte[data-humeur='ravi'] .mascotte-v-ravi,
.mascotte[data-humeur='content'] .mascotte-v-joyeux,
.mascotte[data-humeur='ravi'] .mascotte-v-joyeux,
.mascotte:not([data-humeur='ravi']) .mascotte-v-yeux-ouverts { opacity: 1; }

.mascotte-joues { opacity: 0.45; transition: opacity 0.3s ease; }
.mascotte[data-humeur='content'] .mascotte-joues,
.mascotte[data-humeur='ravi'] .mascotte-joues { opacity: 0.9; }

.mascotte-eclat {
  transform-box: fill-box;
  transform-origin: center;
  animation: mascotte-eclat 1.4s ease-in-out infinite;
}
.mascotte-goutte { animation: mascotte-goutte 2.2s ease-in infinite; }
.mascotte-confetti {
  transform-box: fill-box;
  transform-origin: center;
  animation: mascotte-confetti var(--duree) ease-in var(--retard) infinite both;
}

@media (prefers-reduced-motion: reduce) {
  .mascotte *, .mascotte-corps, .mascotte-yeux {
    animation: none !important;
    transition: none !important;
  }
  .mascotte-confetti { display: none; }
}
`

// La mascotte : une bulle de dialogue avec un visage. Elle prend la couleur principale
// de l'organisation, donc elle convient a tous les secteurs.
export function Mascotte({ humeur, taille = 160, className, titre }: Proprietes) {
  // Identifiants uniques (sans les « : » que React met dans useId) pour le degrade et les masques.
  const id = 'mascotte-' + useId().replace(/:/g, '')
  const decorative = titre === undefined

  return (
    <svg
      viewBox="0 0 200 210"
      width={taille}
      height={(taille * 210) / 200}
      className={'mascotte ' + (className ?? '')}
      data-humeur={humeur}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : titre}
      aria-hidden={decorative ? true : undefined}
      fill="none"
    >
      <style>{STYLES}</style>
      <defs>
        <linearGradient
          id={id + '-corps'}
          gradientUnits="userSpaceOnUse"
          x1="40"
          y1="30"
          x2="160"
          y2="186"
        >
          <stop offset="0%" style={{ stopColor: CLAIR }} />
          <stop offset="100%" style={{ stopColor: 'var(--couleur-principale)' }} />
        </linearGradient>
        <clipPath id={id + '-bouche-content'}>
          <path d="M80 106 Q100 134 120 106 Q100 112 80 106 Z" />
        </clipPath>
        <clipPath id={id + '-bouche-ravi'}>
          <path d="M76 104 Q100 142 124 104 Q100 112 76 104 Z" />
        </clipPath>
      </defs>

      {/* Ombre au sol */}
      <ellipse cx="100" cy="196" rx="42" ry="6" style={{ fill: 'var(--texte)', opacity: 0.12 }} />

      {/* Confettis (merci) */}
      <g aria-hidden="true" className="mascotte-v mascotte-v-ravi">
        {CONFETTIS.map((c, index) => (
          <rect
            key={index}
            x={c.x}
            y={0}
            width="6"
            height="10"
            rx="1.5"
            className="mascotte-confetti"
            style={
              {
                fill: c.c,
                '--duree': c.d + 's',
                '--retard': c.r + 's',
              } as CSSProperties
            }
          />
        ))}
      </g>

      <g className="mascotte-corps">
        {/* Bras, derriere le corps */}
        <g className="mascotte-bras mascotte-bras-g">
          <path
            d="M30 104 Q14 116 16 134"
            strokeWidth="11"
            strokeLinecap="round"
            style={{ stroke: FONCE }}
          />
          <circle cx="16" cy="138" r="8" style={{ fill: FONCE }} />
        </g>
        <g className="mascotte-bras mascotte-bras-d">
          <path
            d="M170 104 Q186 116 184 134"
            strokeWidth="11"
            strokeLinecap="round"
            style={{ stroke: FONCE }}
          />
          <circle cx="184" cy="138" r="8" style={{ fill: FONCE }} />
        </g>

        {/* Corps : la bulle */}
        <path
          d={CORPS}
          strokeWidth="6"
          strokeLinejoin="round"
          style={{ fill: 'url(#' + id + '-corps)', stroke: 'url(#' + id + '-corps)' }}
        />
        {/* Reflet de lumiere en haut a gauche */}
        <ellipse
          cx="64"
          cy="48"
          rx="22"
          ry="9"
          transform="rotate(-24 64 48)"
          style={{ fill: 'white', opacity: 0.28 }}
        />

        {/* Joues */}
        <g className="mascotte-joues">
          <ellipse cx="57" cy="108" rx="11" ry="6.5" style={{ fill: JOUE }} />
          <ellipse cx="143" cy="108" rx="11" ry="6.5" style={{ fill: JOUE }} />
        </g>

        {/* Yeux ouverts (qui clignent) */}
        <g className="mascotte-v mascotte-v-yeux-ouverts">
          <g className="mascotte-yeux">
            <ellipse cx="78" cy="84" rx="14" ry="16" style={{ fill: 'var(--surface)' }} />
            <ellipse cx="122" cy="84" rx="14" ry="16" style={{ fill: 'var(--surface)' }} />
            <g className="mascotte-pupilles">
              <circle cx="78" cy="86" r="8.5" style={{ fill: 'var(--texte)' }} />
              <circle cx="122" cy="86" r="8.5" style={{ fill: 'var(--texte)' }} />
              <circle cx="75" cy="82.5" r="3" style={{ fill: 'white' }} />
              <circle cx="119" cy="82.5" r="3" style={{ fill: 'white' }} />
              <circle cx="81" cy="90" r="1.4" style={{ fill: 'white', opacity: 0.8 }} />
              <circle cx="125" cy="90" r="1.4" style={{ fill: 'white', opacity: 0.8 }} />
            </g>
          </g>
        </g>

        {/* Yeux fermes qui rient (ravi) */}
        <g className="mascotte-v mascotte-v-ravi">
          <path
            d="M63 90 Q78 70 93 90"
            strokeWidth="5.5"
            strokeLinecap="round"
            style={{ stroke: 'var(--texte)' }}
          />
          <path
            d="M107 90 Q122 70 137 90"
            strokeWidth="5.5"
            strokeLinecap="round"
            style={{ stroke: 'var(--texte)' }}
          />
        </g>

        {/* Sourcils */}
        <g
          className="mascotte-v mascotte-v-attentif"
          strokeWidth="4.5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        >
          <path d="M64 62 Q78 54 92 60" />
          <path d="M108 60 Q122 54 136 62" />
        </g>
        <g
          className="mascotte-v mascotte-v-triste"
          strokeWidth="4.5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        >
          <path d="M64 70 Q78 66 92 58" />
          <path d="M136 70 Q122 66 108 58" />
        </g>
        <g
          className="mascotte-v mascotte-v-ecoute"
          strokeWidth="4.5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        >
          <path d="M66 64 Q78 60 90 63" />
          <path d="M110 58 Q122 52 134 60" />
        </g>

        {/* Bouches */}
        <path
          className="mascotte-v mascotte-v-accueil"
          d="M82 108 Q100 126 118 108"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        />
        <path
          className="mascotte-v mascotte-v-attentif"
          d="M90 114 Q100 120 110 114"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        />
        <g className="mascotte-v mascotte-v-content">
          <path d="M80 106 Q100 134 120 106 Q100 112 80 106 Z" style={{ fill: 'var(--texte)' }} />
          <ellipse
            cx="100"
            cy="119"
            rx="9"
            ry="5"
            clipPath={'url(#' + id + '-bouche-content)'}
            style={{ fill: JOUE }}
          />
        </g>
        <g className="mascotte-v mascotte-v-ravi">
          <path d="M76 104 Q100 142 124 104 Q100 112 76 104 Z" style={{ fill: 'var(--texte)' }} />
          <ellipse
            cx="100"
            cy="124"
            rx="12"
            ry="7"
            clipPath={'url(#' + id + '-bouche-ravi)'}
            style={{ fill: JOUE }}
          />
        </g>
        <path
          className="mascotte-v mascotte-v-triste"
          d="M86 123 Q100 109 114 123"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        />
        <path
          className="mascotte-v mascotte-v-ecoute"
          d="M91 116 Q100 121 109 116"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        />

        {/* Goutte de gene (triste) */}
        <g className="mascotte-v mascotte-v-triste">
          <path
            className="mascotte-goutte"
            d="M156 56 Q164 70 156 78 Q148 70 156 56 Z"
            style={{ fill: 'var(--info)', opacity: 0.85 }}
          />
        </g>
      </g>

      {/* Eclats (content et ravi). Chaque etoile est placee par un groupe,
          et c'est l'etoile a l'interieur qui scintille. */}
      <g className="mascotte-v mascotte-v-joyeux" aria-hidden="true">
        <g transform="translate(22 52)">
          <path className="mascotte-eclat" d={ETOILE} style={{ fill: 'var(--alerte)' }} />
        </g>
        <g transform="translate(180 44) scale(0.8)">
          <path
            className="mascotte-eclat"
            d={ETOILE}
            style={{ fill: 'var(--couleur-decor)', animationDelay: '0.4s' }}
          />
        </g>
        <g transform="translate(158 14) scale(0.6)">
          <path
            className="mascotte-eclat"
            d={ETOILE}
            style={{ fill: 'var(--alerte)', animationDelay: '0.8s' }}
          />
        </g>
      </g>
    </svg>
  )
}