import { useId, useRef } from 'react'
import './mascotte.css'
import { utiliserMouvement } from './hooks/utiliser-mouvement'
import { utiliserRessort } from './hooks/utiliser-ressort'
import { PARAMETRES_HUMEURS } from './humeurs'
import { Corps } from './parties/corps'
import { Bras } from './parties/membres'
import { Confettis, Eclats, OmbreSol } from './parties/decors'
import { Visage } from './parties/visage'
import { MainMenton, TraitsSurprise } from './parties/effets'
import type { ProprietesMascotte } from './types'

// Couleur de base de la mascotte (blanc rose). Elle est fixe : elle ne suit plus la couleur
// de l'organisation. Tous les tons du corps, des bras, des yeux, des sourcils et de la bouche
// sont calcules a partir d'elle (voir constantes.ts et parties/).
// Les confettis et les eclats, eux, restent dans les couleurs de la page.
const COULEUR_MASCOTTE = '#f4ecec'

// La mascotte : une bulle de dialogue avec un visage.
export function Mascotte({ humeur, taille = 160, className, titre }: ProprietesMascotte) {
  // Identifiants uniques (sans les « : » que React met dans useId) pour les degrades et les masques.
  const id = 'mascotte-' + useId().replace(/:/g, '')
  const decorative = titre === undefined
  // Les nombres du visage glissent vers ceux de la nouvelle humeur, avec un petit rebond.
  const parametres = utiliserRessort(PARAMETRES_HUMEURS[humeur])
  // Le mouvement du corps et de l'ombre est calcule image par image (voir utiliser-mouvement).
  const refCorps = useRef<SVGGElement>(null)
  const refOmbre = useRef<SVGGElement>(null)
  utiliserMouvement(humeur, refCorps, refOmbre)

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
      <g ref={refOmbre} style={{ transformBox: 'view-box', transformOrigin: '100px 196px' }}>
        <OmbreSol />
      </g>
      <Confettis />

      {/* animation: none : le mouvement du corps ne vient plus du CSS mais de utiliserMouvement.
          --couleur-principale est redefinie ici : tout ce qui est dans le corps utilise la couleur de la mascotte. */}
      <g
        ref={refCorps}
        className="mascotte-corps"
        style={{ animation: 'none', ['--couleur-principale' as string]: COULEUR_MASCOTTE }}
      >
        {/* Bras, derriere le corps */}
        <Bras id={id} />

        {/* Corps : la bulle, en volume */}
        <Corps id={id} />

        <Visage id={id} parametres={parametres} />

        {/* Devant le corps : main au menton (reflexion) et traits de surprise */}
        <MainMenton id={id} />
        <TraitsSurprise />
      </g>

      <Eclats />
    </svg>
  )
}