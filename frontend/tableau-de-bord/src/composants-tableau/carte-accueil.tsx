import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { formaterNombre } from '../utilitaires/periodes'
import type { ComposantIcone } from './icones-accueil'

// Une carte de l'accueil (ecran E7) : un bouton avec une icone, un titre, un chiffre qui monte
// en animation et une petite ligne dessous. Un clic ouvre le panneau de detail de la page.
// Une valeur a null veut dire "aucune donnee" : on ecrit "Pas de donnees", jamais 0.

const DUREE_ANIMATION_MS = 650

// Variation par rapport a la periode precedente (meme forme que celle de carte-indicateur).
export type VariationAccueil = {
  valeur: number | null
  unite: string
  decimales: number
}

type PropsValeur = {
  valeur: number
  decimales: number
  // true = toujours le meme nombre de decimales (4,10 au lieu de 4,1), comme sur l'ancienne carte
  fixe: boolean
}

// Le chiffre part de la valeur precedente (0 au premier affichage) et monte jusqu'a la cible.
// Si l'ordinateur demande moins de mouvement, il saute directement a la cible.
function ValeurAnimee({ valeur, decimales, fixe }: PropsValeur) {
  const { langue } = utiliserLangue()
  const [affichee, setAffichee] = useState(0)
  const depart = useRef(0)

  useEffect(() => {
    const reduire = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duree = reduire ? 1 : DUREE_ANIMATION_MS
    const de = depart.current
    const debut = performance.now()
    let animation = 0

    const avancer = (maintenant: number) => {
      const progression = Math.min((maintenant - debut) / duree, 1)
      const douceur = 1 - (1 - progression) ** 3
      const courante = progression === 1 ? valeur : de + (valeur - de) * douceur
      depart.current = courante
      setAffichee(courante)
      if (progression < 1) {
        animation = requestAnimationFrame(avancer)
      }
    }

    animation = requestAnimationFrame(avancer)
    return () => cancelAnimationFrame(animation)
  }, [valeur])

  // Pendant la montee, le nombre de decimales reste fixe pour que le chiffre ne saute pas
  const enCours = affichee !== valeur
  return (
    <>
      {/* Le lecteur d'ecran lit la valeur finale, pas les chiffres qui defilent */}
      <span aria-hidden="true">
        {formaterNombre(affichee, langue, { decimales, fixe: fixe || enCours })}
      </span>
      <span className="sr-only">{formaterNombre(valeur, langue, { decimales, fixe })}</span>
    </>
  )
}

// Petite ligne de variation : "▲ +0,3 pts". Le sens est aussi ecrit en texte pour le lecteur d'ecran.
function LigneVariation({ variation }: { variation: VariationAccueil }) {
  const { t, langue } = utiliserLangue()
  const { valeur, unite, decimales } = variation

  if (valeur === null) {
    return <>{t('tableau.cartes.evolution.aucune')}</>
  }
  if (valeur === 0) {
    return <>{t('tableau.cartes.evolution.stable')}</>
  }

  const hausse = valeur > 0
  const nombre = formaterNombre(Math.abs(valeur), langue, { decimales })
  const texteValeur = unite === '' ? nombre : `${nombre} ${unite}`
  const resume = t(hausse ? 'tableau.cartes.evolution.hausse' : 'tableau.cartes.evolution.baisse', {
    valeur: texteValeur,
  })

  return (
    <>
      <span aria-hidden="true" className={hausse ? 'accueil-hausse' : 'accueil-baisse'}>
        {hausse ? '▲ +' : '▼ −'}
        {texteValeur}
      </span>
      <span className="sr-only">{resume}</span>
    </>
  )
}

type Proprietes = {
  titre: string
  Icone: ComposantIcone
  // Couleur de l'icone, du chiffre et du trait du haut (une couleur de la palette, ex. var(--note-bonne))
  couleur: string
  // null = aucune donnee
  valeur: number | null
  decimales?: number
  fixe?: boolean
  // Petite unite a cote du chiffre : "%", "/ 5"...
  unite?: string
  // Nombre affiche dans la pastille rouge (alertes ouvertes), si superieur a 0
  pastille?: number
  // Texte libre sous le chiffre. S'il est donne, il remplace l'etiquette et la variation.
  sousTitre?: ReactNode
  // Petit mot avant la variation : le niveau de la note ("Bonne"...)
  etiquette?: string
  variation?: VariationAccueil
  // Carte dont le panneau est ouvert
  active: boolean
  // Identifiant du panneau que la carte ouvre (pour aria-controls)
  idPanneau: string
  // Retard de l'animation d'apparition, pour que les cartes arrivent l'une apres l'autre
  rang: number
  onClick: () => void
}

export function CarteAccueil({
  titre,
  Icone,
  couleur,
  valeur,
  decimales = 0,
  fixe = false,
  unite,
  pastille,
  sousTitre,
  etiquette,
  variation,
  active,
  idPanneau,
  rang,
  onClick,
}: Proprietes) {
  const { t } = utiliserLangue()

  const style = {
    '--couleur-carte': couleur,
    animationDelay: `${rang * 70}ms`,
  } as CSSProperties

  return (
    <button
      type="button"
      className="accueil-carte"
      style={style}
      aria-expanded={active}
      aria-controls={idPanneau}
      onClick={onClick}
    >
      <div className="accueil-carte-en-tete">
        <span className="accueil-carte-icone">
          <Icone />
        </span>
        <span className="accueil-carte-titre">{titre}</span>
        {pastille !== undefined && pastille > 0 && (
          <span className="accueil-pastille">{pastille}</span>
        )}
      </div>

      <div className="accueil-carte-donnees">
        <span className="accueil-carte-valeur">
          {valeur === null ? (
            <span className="accueil-carte-vide">{t('tableau.aucuneDonnee')}</span>
          ) : (
            <>
              <ValeurAnimee valeur={valeur} decimales={decimales} fixe={fixe} />
              {unite !== undefined && unite !== '' && <span className="accueil-carte-unite">{unite}</span>}
            </>
          )}
        </span>
        <span className="accueil-carte-sous-titre">
          {sousTitre ?? (
            <>
              {etiquette}
              {etiquette !== undefined && variation !== undefined && ' · '}
              {variation !== undefined && <LigneVariation variation={variation} />}
            </>
          )}
        </span>
      </div>
    </button>
  )
}
