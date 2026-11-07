import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as EvenementClavier } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { LigneQr } from '../types/qr-codes'
import { TYPES_POINT_CONTACT } from '../types/sites-points'

// Une ligne de la timeline (ecran E11, QR codes et chevalets) : un point de contact.
// - Un clic sur la ligne (ou Entree) la selectionne : la carte de gauche montre son QR code.
// - Le point de couleur donne l'etat : vert = valide, rouge = revoque, pointille = point desactive.
//   Il pulse pendant une revocation ou une regeneration de ce point.
// - Le menu des trois points (Revoquer, Regenerer) n'existe que pour le Responsable. Il garde
//   son etat ici : s'ouvrir ailleurs le ferme grace au clic exterieur.
// Le composant n'appelle pas l'API : la confirmation et l'action se font depuis la page.

type Proprietes = {
  ligne: LigneQr
  // Position dans la liste : decale l'apparition de chaque ligne.
  index: number
  selectionnee: boolean
  // Vrai tant qu'une action (revoquer, regenerer) est en cours sur ce point.
  occupee: boolean
  // Vrai pour le Responsable : lui seul a le menu des trois points.
  peutModifier: boolean
  surSelectionner: () => void
  surRevoquer: () => void
  surRegenerer: () => void
}

type Etat = 'valide' | 'revoque' | 'inactif'

export function LigneQrListe({
  ligne,
  index,
  selectionnee,
  occupee,
  peutModifier,
  surSelectionner,
  surRevoquer,
  surRegenerer,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const zoneActions = useRef<HTMLDivElement | null>(null)
  const [menuOuvert, setMenuOuvert] = useState(false)

  const { point, statistiques } = ligne
  const revoque = point.revoque_le !== null
  const etat: Etat = revoque ? 'revoque' : !point.actif ? 'inactif' : 'valide'

  const libelleType = (TYPES_POINT_CONTACT as readonly string[]).includes(point.type)
    ? t(`sites.types.${point.type}`)
    : point.type
  const soustitre = point.zone !== null ? `${libelleType} · ${point.zone}` : libelleType

  const nbScans =
    statistiques === null
      ? '—'
      : statistiques.nb_scans.toLocaleString(langue === 'en' ? 'en-US' : 'fr-FR')

  let libelleBadge = t('qrCodes.ligne.valide')
  if (etat === 'revoque') {
    libelleBadge = t('qrCodes.ligne.revoque')
  } else if (etat === 'inactif') {
    libelleBadge = t('qrCodes.carte.pointDesactive')
  }

  // Ferme le menu d'un clic a l'exterieur ou avec Echap.
  useEffect(() => {
    if (!menuOuvert) {
      return
    }

    function surClicExterieur(evenement: MouseEvent): void {
      if (
        zoneActions.current !== null &&
        !zoneActions.current.contains(evenement.target as Node)
      ) {
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

  function surToucheInfo(evenement: EvenementClavier<HTMLDivElement>): void {
    if (evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault()
      surSelectionner()
    }
  }

  return (
    <div
      className={`qr-ligne${selectionnee ? ' qr-ligne--selectionnee' : ''}${
        menuOuvert ? ' qr-ligne--menu-ouvert' : ''
      }`}
      style={{ animationDelay: `${index * 50}ms` } as CSSProperties}
      onClick={surSelectionner}
    >
      <span
        className={`qr-ligne-point qr-ligne-point--${etat}${occupee ? ' qr-ligne-point--occupe' : ''}`}
        aria-hidden="true"
      />

      <div
        className="qr-ligne-info"
        role="button"
        tabIndex={0}
        aria-pressed={selectionnee}
        onKeyDown={surToucheInfo}
      >
        <span className="qr-ligne-libelle">{point.nom}</span>
        <span className="qr-ligne-sous">{soustitre}</span>
      </div>

      <span className="qr-ligne-chiffre">
        {nbScans} {t('qrCodes.carte.scans').toLowerCase()}
      </span>

      <span className={`qr-badge qr-badge--${etat}`}>{libelleBadge}</span>

      {peutModifier && (
        <div
          className="qr-ligne-actions"
          ref={zoneActions}
          onClick={(evenement) => evenement.stopPropagation()}
        >
          <button
            type="button"
            className="qr-bouton-menu"
            disabled={occupee}
            aria-haspopup="menu"
            aria-expanded={menuOuvert}
            aria-label={t('qrCodes.ligne.actions', { nom: point.nom })}
            onClick={() => setMenuOuvert((ouvert) => !ouvert)}
          >
            •••
          </button>
          {menuOuvert && (
            <div className="qr-menu" role="menu">
              {!revoque && (
                <button
                  type="button"
                  role="menuitem"
                  className="qr-menu-danger"
                  onClick={() => {
                    setMenuOuvert(false)
                    surRevoquer()
                  }}
                >
                  {t('qrCodes.carte.revoquer')}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOuvert(false)
                  surRegenerer()
                }}
              >
                {t('qrCodes.carte.regenerer')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}