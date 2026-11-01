import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { Variation } from './carte-indicateur'
import type { VariationCarte } from './carte-indicateur'

// Panneau qui s'ouvre sous les cartes de l'accueil quand on clique sur une carte ou une icone.
// Il reste dans la page meme ferme (cache, inerte) pour que sa fermeture soit animee.

type PropsPanneau = {
  id: string
  ouvert: boolean
  // true = pleine largeur (graphiques, tableaux) ; false = petit panneau d'une carte
  large: boolean
  // Quand cette cle change, le contenu apparait de nouveau avec l'animation
  cleContenu: string
  children: ReactNode
}

export function PanneauDetail({ id, ouvert, large, cleContenu, children }: PropsPanneau) {
  const classes = [
    'accueil-panneau',
    large ? 'accueil-panneau--large' : '',
    ouvert ? 'accueil-panneau--ouvert' : '',
  ]
    .filter((classe) => classe !== '')
    .join(' ')

  return (
    <section id={id} className={classes} aria-live="polite" inert={!ouvert}>
      <div className="accueil-panneau-interieur">
        <div key={cleContenu} className="accueil-panneau-contenu">
          {children}
        </div>
      </div>
    </section>
  )
}

// Bouton "×" qui ferme le panneau
export function BoutonFermer({ onFermer }: { onFermer: () => void }) {
  const { t } = utiliserLangue()
  return (
    <button
      type="button"
      className="accueil-fermer"
      onClick={onFermer}
      aria-label={t('tableau.accueil.fermerDetail')}
    >
      ×
    </button>
  )
}

type PropsDetailCarte = {
  titre: string
  description: string
  variation?: VariationCarte
  aide?: string
  // Lien vers la liste des avis concernes (le meme que celui de l'ancienne carte)
  lien: string
  onFermer: () => void
}

// Contenu du panneau quand on clique sur une carte d'indicateur
export function DetailCarte({ titre, description, variation, aide, lien, onFermer }: PropsDetailCarte) {
  const { t } = utiliserLangue()

  return (
    <div className="accueil-detail">
      <div className="accueil-detail-texte">
        <h2 className="accueil-detail-titre">{titre}</h2>
        <p className="accueil-detail-description">{description}</p>
        {variation !== undefined && <Variation variation={variation} />}
        {aide !== undefined && aide !== '' && <p className="accueil-detail-aide">{aide}</p>}
      </div>
      <div className="accueil-detail-actions">
        <Link to={lien} className="accueil-detail-bouton">
          {t('tableau.cartes.voirAvis')}
        </Link>
        <BoutonFermer onFermer={onFermer} />
      </div>
    </div>
  )
}
