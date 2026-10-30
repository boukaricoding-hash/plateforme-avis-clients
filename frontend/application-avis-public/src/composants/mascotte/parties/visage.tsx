import { JOUE } from '../constantes'
import type { ParametresHumeur, Sourcil } from '../humeurs'

// Les yeux et les sourcils prennent la teinte de la couleur principale, assombrie :
// marron chocolat avec le terracotta, bleu nuit avec un bleu, etc.
const IRIS_CLAIR = 'color-mix(in srgb, var(--couleur-principale) 84%, black)'
const IRIS_SOMBRE = 'color-mix(in srgb, var(--couleur-principale) 48%, black)'
const PUPILLE = 'color-mix(in srgb, var(--couleur-principale) 12%, black)'
const SOURCIL = 'color-mix(in srgb, var(--couleur-principale) 34%, black)'
// Interieur de la bouche (rouge sombre) et langue (rose vif).
const BOUCHE_HAUT = 'color-mix(in srgb, var(--couleur-principale) 14%, black)'
const BOUCHE_BAS = 'color-mix(in srgb, var(--couleur-principale) 40%, #3a0a14)'
const LANGUE = 'color-mix(in srgb, var(--couleur-decor) 45%, #ff4f6d)'
const LANGUE_REFLET = 'color-mix(in srgb, var(--couleur-decor) 40%, white)'

type Proprietes = {
  // Identifiant unique de cette mascotte, pour les masques et les degrades.
  id: string
  // Les nombres de l'humeur du moment (deja adoucis par le ressort).
  parametres: ParametresHumeur
}

// Le ressort peut depasser un peu la cible : on garde les valeurs dans leur plage.
function limiter(valeur: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, valeur))
}

// Sourcil effile : la courbe est epaissie point par point (fin au bord exterieur,
// plus epais vers l'interieur du visage).
function traceSourcil(s: Sourcil, epaisseur: number): string {
  const POINTS = 10
  const haut: string[] = []
  const bas: string[] = []
  for (let i = 0; i <= POINTS; i += 1) {
    const t = i / POINTS
    const u = 1 - t
    const x = u * u * s.x1 + 2 * u * t * s.cx + t * t * s.x2
    const y = u * u * s.y1 + 2 * u * t * s.cy + t * t * s.y2
    const tx = 2 * u * (s.cx - s.x1) + 2 * t * (s.x2 - s.cx)
    const ty = 2 * u * (s.cy - s.y1) + 2 * t * (s.y2 - s.cy)
    const longueur = Math.hypot(tx, ty) || 1
    const nx = -ty / longueur
    const ny = tx / longueur
    const demi = (epaisseur / 2) * (1 - 0.6 * (1 - t) * (1 - t))
    haut.push((x + nx * demi).toFixed(1) + ' ' + (y + ny * demi).toFixed(1))
    bas.push((x - nx * demi).toFixed(1) + ' ' + (y - ny * demi).toFixed(1))
  }
  return 'M' + haut.join(' L') + ' L' + bas.reverse().join(' L') + ' Z'
}

type ProprietesOeil = {
  id: string
  nom: 'g' | 'd'
  // Centre de l'oeil (78 a gauche, 122 a droite).
  cx: number
  yeux: ParametresHumeur['yeux']
}

// Un oeil : blanc, iris avec pupille et reflets (qui bougent et se dilatent),
// ombre de la paupiere sur l'oeil, paupiere du haut et sa ligne epaisse.
// La paupiere est dessinee avec le degrade du corps : elle se fond dans la bulle.
function Oeil({ id, nom, cx, yeux }: ProprietesOeil) {
  const fermeture = 1 - limiter(yeux.ouverture)
  // Le blanc et l'iris s'effacent quand l'oeil est ferme (les yeux qui rient prennent le relais).
  const blanc = Math.min(1, (1 - fermeture) * 5)

  // Bord de la paupiere : une arche qui suit le haut de l'oeil quand il est ouvert,
  // puis qui descend et s'aplatit en se fermant.
  const bordY = 84 + 2 * fermeture
  const bordControle = 61.3 + 26.7 * fermeture
  const g = cx - 15
  const d = cx + 15
  const bord =
    'M' + g + ' ' + bordY + ' C' + g + ' ' + bordControle + ' ' + d + ' ' + bordControle + ' ' + d + ' ' + bordY

  // Les valeurs de rayonPupille (8 a 10) donnent la taille de l'iris ; la pupille se dilate avec lui.
  const iris = Math.max(0, yeux.rayonPupille) * 1.4
  const pupille = iris * 0.44
  const decoupe = 'url(#' + id + '-oeil-' + nom + ')'

  return (
    <>
      <g style={{ opacity: blanc }}>
        <ellipse cx={cx} cy="84" rx="15" ry="17" style={{ fill: 'var(--surface)' }} />
        <g clipPath={decoupe}>
          <g transform={'translate(' + yeux.pupilleX + ' ' + yeux.pupilleY + ')'}>
            <circle cx={cx} cy="86" r={iris} fill={'url(#' + id + '-iris)'} />
            <circle cx={cx} cy="86" r={pupille} style={{ fill: PUPILLE }} />
            <circle
              cx={cx - iris * 0.32}
              cy={86 - iris * 0.38}
              r={iris * 0.24}
              style={{ fill: 'white' }}
            />
            <circle
              cx={cx + iris * 0.38}
              cy={86 + iris * 0.42}
              r={iris * 0.14}
              style={{ fill: 'white', opacity: 0.85 }}
            />
          </g>
          {/* Ombre de la paupiere sur le haut de l'oeil */}
          <ellipse cx={cx} cy="84" rx="15" ry="17" fill={'url(#' + id + '-ombre-paupiere)'} />
        </g>
      </g>

      {/* Paupiere */}
      <g clipPath={decoupe}>
        <path d={bord + ' L' + d + ' 50 L' + g + ' 50 Z'} fill={'url(#' + id + '-corps)'} />
      </g>
      {/* Ligne epaisse de la paupiere */}
      <path
        d={bord}
        strokeWidth="2.8"
        strokeLinecap="round"
        style={{ stroke: PUPILLE, opacity: Math.min(1, limiter(yeux.ouverture) * 3) }}
      />
    </>
  )
}

// Tout le visage : joues, yeux, sourcils, bouche et goutte de gene.
// Rien n'apparait ni ne disparait d'un coup : tout est calcule a partir des nombres de l'humeur.
export function Visage({ id, parametres }: Proprietes) {
  const { bouche, sourcils, yeux, joues, goutte } = parametres

  const remplissage = limiter(bouche.remplissage)
  // Contour de la bouche : la courbe du bas, puis le retour par la courbe du haut.
  // Quand les deux courbes sont egales, c'est un simple trait.
  const traceBouche =
    'M' + bouche.gx + ' ' + bouche.gy +
    ' Q100 ' + bouche.bas + ' ' + bouche.dx + ' ' + bouche.dy +
    ' Q100 ' + bouche.haut + ' ' + bouche.gx + ' ' + bouche.gy + ' Z'
  const langueRx = Math.max(0, bouche.langueRx) * 1.15
  const langueRy = Math.max(0, bouche.langueRy) * 1.3

  return (
    <>
      <defs>
        <clipPath id={id + '-bouche'}>
          <path d={traceBouche} />
        </clipPath>
        <clipPath id={id + '-oeil-g'}>
          <ellipse cx="78" cy="84" rx="15" ry="17" />
        </clipPath>
        <clipPath id={id + '-oeil-d'}>
          <ellipse cx="122" cy="84" rx="15" ry="17" />
        </clipPath>
        {/* Iris : plus clair vers le bas, sombre sur le bord */}
        <radialGradient id={id + '-iris'} cx="50%" cy="60%" r="62%">
          <stop offset="0%" style={{ stopColor: IRIS_CLAIR }} />
          <stop offset="100%" style={{ stopColor: IRIS_SOMBRE }} />
        </radialGradient>
        {/* Ombre de la paupiere : sombre en haut de l'oeil, disparait vers le milieu */}
        <linearGradient
          id={id + '-ombre-paupiere'}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="67"
          x2="0"
          y2="101"
        >
          <stop offset="0%" stopColor="black" stopOpacity="0.28" />
          <stop offset="50%" stopColor="black" stopOpacity="0" />
        </linearGradient>
        {/* Joues : rose au centre, qui s'estompe sur les bords */}
        <radialGradient id={id + '-joue'}>
          <stop offset="0%" style={{ stopColor: JOUE, stopOpacity: 1 }} />
          <stop offset="55%" style={{ stopColor: JOUE, stopOpacity: 0.75 }} />
          <stop offset="100%" style={{ stopColor: JOUE, stopOpacity: 0 }} />
        </radialGradient>
        {/* Interieur de la bouche : tres sombre en haut, rouge sombre en bas */}
        <linearGradient
          id={id + '-bouche-interieur'}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="100"
          x2="0"
          y2="142"
        >
          <stop offset="0%" style={{ stopColor: BOUCHE_HAUT }} />
          <stop offset="100%" style={{ stopColor: BOUCHE_BAS }} />
        </linearGradient>
      </defs>

      {/* Joues */}
      <g style={{ opacity: limiter(joues.opacite) }}>
        <ellipse cx="56" cy="108" rx="13" ry="8.5" fill={'url(#' + id + '-joue)'} />
        <ellipse cx="144" cy="108" rx="13" ry="8.5" fill={'url(#' + id + '-joue)'} />
      </g>

      {/* Yeux (le clignement du CSS agit sur ce groupe) */}
      <g className="mascotte-yeux">
        <Oeil id={id} nom="g" cx={78} yeux={yeux} />
        <Oeil id={id} nom="d" cx={122} yeux={yeux} />
      </g>

      {/* Yeux qui rient : arcs qui apparaissent quand les paupieres sont fermees */}
      <g style={{ opacity: limiter(yeux.rire) }}>
        <path
          d="M63 90 Q78 70 93 90"
          strokeWidth="5.5"
          strokeLinecap="round"
          style={{ stroke: PUPILLE }}
        />
        <path
          d="M107 90 Q122 70 137 90"
          strokeWidth="5.5"
          strokeLinecap="round"
          style={{ stroke: PUPILLE }}
        />
      </g>

      {/* Sourcils effiles */}
      <g
        strokeWidth="1.4"
        strokeLinejoin="round"
        style={{ fill: SOURCIL, stroke: SOURCIL, opacity: limiter(sourcils.opacite) }}
      >
        <path d={traceSourcil(sourcils.g, 6.5)} />
        <path d={traceSourcil(sourcils.d, 6.5)} />
      </g>

      {/* Bouche : trait ou bouche ouverte, c'est le meme dessin qui se deforme */}
      <path
        d={traceBouche}
        strokeWidth={5 * (1 - remplissage)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={'url(#' + id + '-bouche-interieur)'}
        style={{ stroke: PUPILLE, fillOpacity: remplissage }}
      />
      <g clipPath={'url(#' + id + '-bouche)'}>
        <ellipse cx="100" cy={bouche.langueY} rx={langueRx} ry={langueRy} style={{ fill: LANGUE }} />
        <ellipse
          cx="100"
          cy={bouche.langueY - langueRy * 0.35}
          rx={langueRx * 0.45}
          ry={langueRy * 0.3}
          style={{ fill: LANGUE_REFLET, opacity: 0.55 }}
        />
      </g>

      {/* Goutte de gene (triste) */}
      <g style={{ opacity: limiter(goutte.opacite) }}>
        <path
          className="mascotte-goutte"
          d="M156 56 Q164 70 156 78 Q148 70 156 56 Z"
          style={{ fill: 'var(--info)', opacity: 0.85 }}
        />
      </g>
    </>
  )
}