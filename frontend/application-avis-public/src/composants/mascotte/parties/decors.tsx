import type { CSSProperties } from 'react'
import { CONFETTIS, ETOILE } from '../constantes'

// Ombre au sol.
export function OmbreSol() {
  return <ellipse cx="100" cy="196" rx="42" ry="6" style={{ fill: 'var(--texte)', opacity: 0.12 }} />
}

// Confettis (merci).
export function Confettis() {
  return (
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
  )
}

// Eclats (content et ravi). Chaque etoile est placee par un groupe,
// et c'est l'etoile a l'interieur qui scintille.
export function Eclats() {
  return (
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
  )
}