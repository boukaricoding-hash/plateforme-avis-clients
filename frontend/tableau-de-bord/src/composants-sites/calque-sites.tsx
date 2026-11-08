import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { utiliserLangue } from '../hooks/utiliser-langue'
import '../styles/sites.css'

// Calque de l'ecran E12 (sites et tables) : deux formes au-dessus de la page.
// - 'tiroir' : un panneau qui glisse de la droite vers la gauche (creer un site, gerer le site,
//   creer en masse, ajouter une table). On y saisit sans rien deplacer dans la page.
// - 'fenetre' : un petit pop-up au centre (modifier un point de contact depuis sa carte).
// Les deux se ferment avec la croix, un clic sur le fond sombre ou la touche Echap.
// Le calque est affiche dans <body> (createPortal) : une carte qui se soleve au survol ne peut
// pas le deplacer ni le couper. Il reprend la classe sites-ecran pour garder les memes couleurs.
// Le contenu (formulaire) est fourni par la page ; ce composant ne connait ni l'API ni les textes
// du formulaire.

type Proprietes = {
  forme: 'tiroir' | 'fenetre'
  // Nom lu par les lecteurs d'ecran pour la fenetre.
  libelle: string
  surFermer: () => void
  children: ReactNode
}

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function CalqueSites({ forme, libelle, surFermer, children }: Proprietes) {
  const { t } = utiliserLangue()
  const refBoite = useRef<HTMLDivElement | null>(null)
  // Toujours la derniere fonction de fermeture, sans relancer l'effet a chaque affichage.
  const refFermer = useRef(surFermer)

  useEffect(() => {
    refFermer.current = surFermer
  })

  // A l'ouverture : le focus entre dans la boite ; a la fermeture : il revient au bouton d'origine.
  // Echap ferme, ou que soit le focus.
  useEffect(() => {
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null
    refBoite.current?.focus()

    const surTouche = (evenement: globalThis.KeyboardEvent): void => {
      if (evenement.key === 'Escape') {
        refFermer.current()
      }
    }
    document.addEventListener('keydown', surTouche)

    return () => {
      document.removeEventListener('keydown', surTouche)
      origine?.focus()
    }
  }, [])

  // Tab reste dans la boite tant qu'elle est ouverte.
  function garderLeFocus(evenement: KeyboardEvent<HTMLDivElement>): void {
    if (evenement.key !== 'Tab') {
      return
    }
    const boite = refBoite.current
    if (boite === null) {
      return
    }
    const elements = Array.from(boite.querySelectorAll<HTMLElement>(FOCALISABLES))
    const premier = elements[0]
    const dernier = elements[elements.length - 1]
    if (premier === undefined || dernier === undefined) {
      evenement.preventDefault()
      return
    }
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault()
      dernier.focus()
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault()
      premier.focus()
    }
  }

  return createPortal(
    <div className={`sites-ecran sites-calque sites-calque--${forme}`}>
      <div
        className="sites-fond"
        aria-hidden="true"
        onMouseDown={(evenement) => {
          if (evenement.target === evenement.currentTarget) {
            surFermer()
          }
        }}
      />
      <div
        ref={refBoite}
        role="dialog"
        aria-modal="true"
        aria-label={libelle}
        tabIndex={-1}
        className={forme === 'tiroir' ? 'sites-tiroir' : 'sites-fenetre'}
        onKeyDown={garderLeFocus}
      >
        <button
          type="button"
          onClick={surFermer}
          className="sites-croix"
          aria-label={t('sites.fermer')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}