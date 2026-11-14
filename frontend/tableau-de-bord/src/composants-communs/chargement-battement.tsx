import { utiliserLangue } from '../hooks/utiliser-langue'
import '../styles/chargement.css'

// Trace du battement : une ligne plate, deux battements, puis une derniere descente
// qui arrive exactement a la base du D (x 236, y 116), la ou la lettre commence.
const TRACE_BATTEMENT =
  'M 8 70 H 60 L 70 62 L 80 70 H 96 L 104 78 L 116 18 L 128 110 L 136 70 ' +
  'H 150 L 162 56 L 176 70 H 190 L 200 78 L 212 40 L 224 116 H 236'

// Trace du D : la haste montante, puis la courbe, jusqu'a revenir a la base.
const TRACE_LETTRE =
  'M 236 116 V 24 H 262 C 300 24 318 46 318 70 C 318 94 300 116 262 116 H 236'

type Proprietes = {
  // true : le loader se termine, il s'efface en fondu (voir cadre-protege.tsx)
  sortie?: boolean
}

// Ecran de demarrage : un battement de coeur se trace, puis dessine la lettre D.
// Les animations sont dans styles/chargement.css. Les couleurs suivent le theme.
export function ChargementBattement({ sortie = false }: Proprietes) {
  const { t } = utiliserLangue()

  return (
    <div
      role="status"
      className={sortie ? 'chargement-ecran chargement-ecran--sortie' : 'chargement-ecran'}
    >
      <div className="chargement-centre">
        <div className="chargement-halo" aria-hidden="true" />
        <svg
          className="chargement-dessin"
          viewBox="0 0 360 140"
          aria-hidden="true"
          focusable="false"
        >
          {/* pathLength={1} : les animations vont de 0 a 1, quelle que soit la longueur */}
          <path className="chargement-ligne" d={TRACE_BATTEMENT} pathLength={1} />
          <path className="chargement-lettre" d={TRACE_LETTRE} pathLength={1} />
        </svg>
      </div>
      {/* Texte pour les lecteurs d'ecran : le dessin, lui, est decoratif */}
      <span className="sr-only">{t('commun.chargement')}</span>
    </div>
  )
}