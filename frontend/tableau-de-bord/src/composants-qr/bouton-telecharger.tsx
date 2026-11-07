import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { ErreurService } from '../services/api'
import { telechargerFichier } from '../services/telechargement'

// Bouton de telechargement (ecran E11, QR codes et chevalets) avec loader.
// - Une seule option (la planche A4) : un clic lance le telechargement.
// - Plusieurs options (PNG, SVG, PDF A6, PDF A5) : le bouton ouvre un menu, les formats ne sont
//   pas affiches en dur sur la carte. La liste vient entierement de la propriete "options".
// Pendant le telechargement : cercle qui tourne et barre de progression sur le bouton, puis une
// coche quand c'est fini. La page est prevenue par surSucces et surEchec (pour son avis en bas).
// Le composant n'appelle pas l'API lui-meme : le fichier vient de telechargerFichier.

export type OptionTelechargement = {
  cle: string
  libelle: string
  // Petite precision a droite du libelle, par exemple "Image" ou "Impression".
  detail?: string
  // Texte lu par les lecteurs d'ecran pour cette option.
  libelleAccessible: string
  adresse: string
  nomParDefaut: string
}

type Proprietes = {
  libelle: string
  options: OptionTelechargement[]
  desactive?: boolean
  classeBouton?: string
  // Le menu s'ouvre au-dessus du bouton (haut) ou en dessous (bas).
  ouvrirVers?: 'haut' | 'bas'
  surSucces?: (nomFichier: string, option: OptionTelechargement) => void
  surEchec?: (erreur: ErreurService, option: OptionTelechargement) => void
}

type Phase = 'repos' | 'cours' | 'fait' | 'echec'

// Temps pendant lequel la coche ou la croix reste visible avant le retour au repos.
const DUREE_FAIT_MS = 1400
const DUREE_ECHEC_MS = 2000

function IconeTelecharger() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11" />
      <polyline points="7 11 12 16 17 11" />
      <path d="M5 20h14" />
    </svg>
  )
}

function IconeCoche() {
  return (
    <svg
      className="qr-coche"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="5 12.5 10 17.5 19 7.5" />
    </svg>
  )
}

function IconeCroix() {
  return (
    <svg
      className="qr-coche"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}

function IconeChevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      className={`qr-chevron${ouvert ? ' qr-chevron--ouvert' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 15 12 9 18 15" />
    </svg>
  )
}

export function BoutonTelecharger({
  libelle,
  options,
  desactive = false,
  classeBouton = 'qr-bouton-principal',
  ouvrirVers = 'haut',
  surSucces,
  surEchec,
}: Proprietes) {
  const { t } = utiliserLangue()
  const idMenu = useId()
  const conteneur = useRef<HTMLDivElement | null>(null)
  const minuterie = useRef<number | null>(null)
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [phase, setPhase] = useState<Phase>('repos')
  const [cleActive, setCleActive] = useState<string | null>(null)

  const optionUnique = options.length === 1
  const enCours = phase === 'cours'

  // Ferme le menu d'un clic a l'exterieur ou avec Echap.
  useEffect(() => {
    if (!menuOuvert) {
      return
    }

    function surClicExterieur(evenement: MouseEvent): void {
      if (conteneur.current !== null && !conteneur.current.contains(evenement.target as Node)) {
        setMenuOuvert(false)
      }
    }

    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key === 'Escape') {
        setMenuOuvert(false)
      }
    }

    document.addEventListener('mousedown', surClicExterieur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClicExterieur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [menuOuvert])

  // A la fermeture de la page, plus de retour au repos programme.
  useEffect(() => {
    return () => {
      if (minuterie.current !== null) {
        window.clearTimeout(minuterie.current)
      }
    }
  }, [])

  function programmerRepos(duree: number): void {
    if (minuterie.current !== null) {
      window.clearTimeout(minuterie.current)
    }
    minuterie.current = window.setTimeout(() => {
      setPhase('repos')
      setCleActive(null)
      setMenuOuvert(false)
    }, duree)
  }

  async function lancer(option: OptionTelechargement): Promise<void> {
    if (enCours) {
      return
    }
    if (minuterie.current !== null) {
      window.clearTimeout(minuterie.current)
    }
    setCleActive(option.cle)
    setPhase('cours')
    try {
      const nom = await telechargerFichier(option.adresse, option.nomParDefaut)
      setPhase('fait')
      programmerRepos(DUREE_FAIT_MS)
      surSucces?.(nom, option)
    } catch (e) {
      const erreur =
        e instanceof ErreurService
          ? e
          : new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
      setPhase('echec')
      programmerRepos(DUREE_ECHEC_MS)
      surEchec?.(erreur, option)
    }
  }

  function surClicBouton(): void {
    if (optionUnique) {
      void lancer(options[0])
      return
    }
    setMenuOuvert((ouvert) => !ouvert)
  }

  let contenuBouton
  if (phase === 'cours') {
    contenuBouton = (
      <>
        <span className="qr-spinner" aria-hidden="true" />
        {t('qrCodes.telechargement.encours')}
      </>
    )
  } else if (phase === 'fait') {
    contenuBouton = (
      <>
        <IconeCoche />
        {t('qrCodes.telechargement.termine')}
      </>
    )
  } else {
    contenuBouton = (
      <>
        <IconeTelecharger />
        {libelle}
        {!optionUnique && <IconeChevron ouvert={menuOuvert} />}
      </>
    )
  }

  return (
    <div className="qr-telecharger" ref={conteneur}>
      <button
        type="button"
        disabled={desactive || enCours}
        aria-busy={enCours}
        aria-haspopup={optionUnique ? undefined : 'menu'}
        aria-expanded={optionUnique ? undefined : menuOuvert}
        aria-controls={optionUnique ? undefined : idMenu}
        onClick={surClicBouton}
        className={`${classeBouton}${enCours ? ' qr-bouton--occupe' : ''}`}
      >
        {contenuBouton}
      </button>

      {!optionUnique && menuOuvert && (
        <div
          id={idMenu}
          role="menu"
          aria-label={t('qrCodes.telechargement.formats')}
          className={`qr-menu-telechargement${ouvrirVers === 'bas' ? ' qr-menu-telechargement--bas' : ''}`}
        >
          {options.map((option, index) => {
            const active = cleActive === option.cle
            let etat = null
            let classeEtat = ''
            if (active && phase === 'cours') {
              etat = <span className="qr-spinner" aria-hidden="true" />
            } else if (active && phase === 'fait') {
              etat = <IconeCoche />
              classeEtat = ' qr-option--fait'
            } else if (active && phase === 'echec') {
              etat = <IconeCroix />
              classeEtat = ' qr-option--echec'
            }
            return (
              <button
                key={option.cle}
                type="button"
                role="menuitem"
                disabled={enCours}
                aria-label={option.libelleAccessible}
                onClick={() => void lancer(option)}
                className={`qr-option${classeEtat}`}
                style={{ '--i': index } as CSSProperties}
              >
                <span className="qr-option-libelle">{option.libelle}</span>
                {option.detail !== undefined && (
                  <span className="qr-option-detail">{option.detail}</span>
                )}
                <span className="qr-option-etat">{etat}</span>
              </button>
            )
          })}
        </div>
      )}

      <span className="sr-only" role="status">
        {phase === 'cours' ? t('qrCodes.telechargement.encours') : ''}
        {phase === 'fait' ? t('qrCodes.telechargement.termine') : ''}
      </span>
    </div>
  )
}