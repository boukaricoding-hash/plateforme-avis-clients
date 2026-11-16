import { useEffect, useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'

// Les trois messages qui defilent a gauche des ecrans de connexion.
// Les textes sont dans traductions/fr/textes.ts et en/textes.ts, sous la cle "carrousel".
const NOMBRE_DIAPOS = 3
const DUREE_DIAPO_MS = 6000

// Petite etoile du badge (la meme que sur la maquette)
const ICONE_ETOILE = 'M12 2l2.9 6.6 7.1.7-5.3 4.8 1.5 7-6.2-3.6-6.2 3.6 1.5-7L2 9.3l7.1-.7L12 2Z'

// Fleche du bouton "Acceder a mon espace"
const ICONE_FLECHE = 'M5 12h14M13 6l6 6-6 6'

type EtatDiapo = 'actif' | 'passee' | 'avenir'

type Proprietes = {
  // Si elle est donnee, le bouton "Acceder a mon espace" s'affiche sous le message.
  surAcces?: () => void
}

// Deux chiffres : 1 devient 01
function deuxChiffres(nombre: number): string {
  return String(nombre).padStart(2, '0')
}

export function CarrouselConnexion({ surAcces }: Proprietes) {
  const { t } = utiliserLangue()
  const [actif, setActif] = useState(0)
  // Le defilement s'arrete quand la souris ou le clavier est sur le message.
  const [enPause, setEnPause] = useState(false)

  // Une minuterie par message : un clic sur un point la relance de zero.
  useEffect(() => {
    if (enPause) {
      return
    }
    const minuterie = window.setTimeout(() => {
      setActif((courant) => (courant + 1) % NOMBRE_DIAPOS)
    }, DUREE_DIAPO_MS)
    return () => window.clearTimeout(minuterie)
  }, [actif, enPause])

  // Le message qui vient de partir glisse vers la gauche, les autres attendent a droite.
  function etatDe(indice: number): EtatDiapo {
    if (indice === actif) {
      return 'actif'
    }
    return indice === (actif + NOMBRE_DIAPOS - 1) % NOMBRE_DIAPOS ? 'passee' : 'avenir'
  }

  const diapos = Array.from({ length: NOMBRE_DIAPOS }, (_, indice) => indice + 1)

  return (
    <div
      className="connexion-carrousel"
      role="region"
      aria-roledescription="carrousel"
      aria-label={t('carrousel.titre')}
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
      onFocus={() => setEnPause(true)}
      onBlur={() => setEnPause(false)}
    >
      <div className="connexion-diapos" aria-live={enPause ? 'polite' : 'off'}>
        {diapos.map((numero, indice) => (
          <div
            key={numero}
            className="connexion-diapo"
            data-etat={etatDe(indice)}
            aria-hidden={indice !== actif}
          >
            <p className="connexion-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d={ICONE_ETOILE} />
              </svg>
              {t(`carrousel.diapo${numero}Badge`)}
            </p>
            <h2 className="connexion-titre">
              {t(`carrousel.diapo${numero}Titre`)}
              <span className="connexion-accent">{t(`carrousel.diapo${numero}Accent`)}</span>
            </h2>
            <p className="connexion-texte">{t(`carrousel.diapo${numero}Texte`)}</p>
          </div>
        ))}
      </div>

      {/* Le bouton qui ouvre le formulaire, et la phrase qui rassure */}
      {surAcces !== undefined && (
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
      )}

      {/* Les trois points et le compteur : 01 / 03 */}
      <div className="connexion-navigation">
        <div className="connexion-points">
          {diapos.map((numero, indice) => (
            <button
              key={numero}
              type="button"
              className="connexion-point-bouton"
              aria-label={t('carrousel.afficher', { nombre: numero })}
              aria-current={indice === actif}
              onClick={() => setActif(indice)}
            >
              <span className="connexion-point" />
            </button>
          ))}
        </div>
        <p className="connexion-compteur" aria-hidden="true">
          {deuxChiffres(actif + 1)} / {deuxChiffres(NOMBRE_DIAPOS)}
        </p>
      </div>
    </div>
  )
}