import { useId } from 'react'
import './mascotte.css'
import { Corps } from './parties/corps'
import { Bras } from './parties/membres'
import { Confettis, Eclats, OmbreSol } from './parties/decors'
import { Visage } from './parties/visage'
import type { ProprietesMascotte } from './types'

// La mascotte : une bulle de dialogue avec un visage. Elle prend la couleur principale
// de l'organisation, donc elle convient a tous les secteurs.
export function Mascotte({ humeur, taille = 160, className, titre }: ProprietesMascotte) {
  // Identifiants uniques (sans les « : » que React met dans useId) pour les degrades et les masques.
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
      // Un bras leve ou une etoile peut depasser un peu du dessin sans etre coupe.
      overflow="visible"
    >
      <OmbreSol />
      <Confettis />

      <g className="mascotte-corps">
        {/* Bras, derriere le corps */}
        <Bras />

        {/* Corps : la bulle, en volume */}
        <Corps id={id} />

        <Visage id={id} />
      </g>

      <Eclats />
    </svg>
  )
}