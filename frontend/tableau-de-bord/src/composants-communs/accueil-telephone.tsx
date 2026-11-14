import type { ReactNode } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { BasDePageConnexion } from './bas-de-page-connexion'

// Accueil de l'ecran de connexion sur telephone et petite tablette (moins de 1024 px).
// Sur ecran large, on voit le message qui defile et la scene animee ; ici, une seule colonne
// courte, sans animation lourde (telephones d'entree de gamme, connexions lentes).
// Le bouton "Acceder a mon espace" ouvre le formulaire (voir cadre-authentification.tsx).
// Les textes reprennent ceux du carrousel (traductions, cle "carrousel") et de la bande
// du bas (cle "vitrine"). Les styles sont dans styles/connexion.css.
const POINTS_FORTS = [1, 2, 3]

// Petite etoile du badge, coche et fleche du bouton (memes dessins que sur grand ecran)
const ICONE_ETOILE = 'M12 2l2.9 6.6 7.1.7-5.3 4.8 1.5 7-6.2-3.6-6.2 3.6 1.5-7L2 9.3l7.1-.7L12 2Z'
const ICONE_COCHE = 'M5 12.5l4.5 4.5L19 7.5'
const ICONE_FLECHE = 'M5 12h14M13 6l6 6-6 6'

type Proprietes = {
  // Ouvre le formulaire de connexion.
  surAcces: () => void
  // Bouton ou lien facultatif place sous le bouton d'acces (par exemple "Demander une demo").
  contact?: ReactNode
}

export function AccueilTelephone({ surAcces, contact }: Proprietes) {
  const { t } = utiliserLangue()

  return (
    <section className="connexion-accueil-tel" aria-label={t('carrousel.titre')}>
      <p className="connexion-badge">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d={ICONE_ETOILE} />
        </svg>
        {t('carrousel.diapo1Badge')}
      </p>

      <h1 className="connexion-titre">
        {t('carrousel.diapo1Titre')}
        <span className="connexion-accent">{t('carrousel.diapo1Accent')}</span>
      </h1>
      <p className="connexion-texte">{t('carrousel.diapo1Texte')}</p>

      <div className="connexion-actions">
        <button type="button" className="connexion-bouton-acces" onClick={surAcces}>
          {t('carrousel.acces')}
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={ICONE_FLECHE} />
          </svg>
        </button>
        <p className="connexion-note">{t('carrousel.sansApplication')}</p>
      </div>

      {contact !== undefined && <div className="connexion-contact-zone">{contact}</div>}

      {/* Les trois messages du carrousel, en liste fixe */}
      <ul className="connexion-points-forts">
        {POINTS_FORTS.map((numero) => (
          <li key={numero} className="connexion-point-fort">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={ICONE_COCHE} />
            </svg>
            {t(`carrousel.diapo${numero}Badge`)}
          </li>
        ))}
      </ul>

      <BasDePageConnexion />
    </section>
  )
}