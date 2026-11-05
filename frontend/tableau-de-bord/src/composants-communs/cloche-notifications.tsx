import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserNotifications } from '../hooks/utiliser-notifications'
import type { NotificationRecue } from '../types/notifications'
import { formaterDateHeure } from '../utilitaires/periodes'

// Cloche de notifications de la barre du haut (jour 16) :
// - un compteur de non lues sur la cloche ;
// - un panneau avec la liste (la plus recente d'abord) ;
// - un bouton pour marquer une notification comme lue ;
// - un clic sur une notification la marque comme lue et ouvre l'avis concerne.
// Le panneau se ferme avec la touche Echap, par un clic a l'exterieur ou apres l'ouverture d'un avis.
// A afficher seulement pour un Responsable ou un Gestionnaire (voir le hook).

// Au-dela, le compteur affiche "99+".
const PLAFOND_COMPTEUR = 99

export function ClocheNotifications() {
  const { t, langue } = utiliserLangue()
  const navigate = useNavigate()
  const {
    notifications,
    nonLues,
    tronque,
    chargementInitial,
    erreur,
    erreurLecture,
    actualiser,
    marquerLue,
  } = utiliserNotifications()

  const [ouvert, setOuvert] = useState(false)
  const racineRef = useRef<HTMLDivElement>(null)
  const boutonRef = useRef<HTMLButtonElement>(null)
  const idPanneau = useId()

  // Panneau ouvert : Echap ou clic a l'exterieur le referme.
  useEffect(() => {
    if (!ouvert) {
      return
    }

    function auClicExterieur(evenement: PointerEvent): void {
      const racine = racineRef.current
      if (racine !== null && evenement.target instanceof Node && !racine.contains(evenement.target)) {
        setOuvert(false)
      }
    }

    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key === 'Escape') {
        setOuvert(false)
        boutonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', auClicExterieur)
    window.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('pointerdown', auClicExterieur)
      window.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  // Un clic sur une notification : elle est marquee comme lue (sans attendre la reponse),
  // puis l'avis s'ouvre si elle en a un.
  function ouvrirNotification(notification: NotificationRecue): void {
    if (notification.lue_le === null) {
      void marquerLue(notification.id)
    }
    if (notification.avis_id !== null) {
      setOuvert(false)
      void navigate(`/avis/${notification.avis_id}`)
    }
  }

  function libelleBouton(): string {
    if (nonLues === 0) {
      return t('cloche.ouvrir')
    }
    if (nonLues === 1) {
      return t('cloche.ouvrirUneNonLue')
    }
    return t('cloche.ouvrirNonLues', { nombre: nonLues })
  }

  function resume(): string {
    if (nonLues === 0) {
      return t('cloche.resumeToutLu')
    }
    if (nonLues === 1) {
      return t('cloche.resumeUneNonLue')
    }
    return t('cloche.resumeNonLues', { nombre: nonLues })
  }

  const compteur = nonLues > PLAFOND_COMPTEUR ? `${PLAFOND_COMPTEUR}+` : String(nonLues)

  function contenuListe() {
    // Aucune donnee et une erreur : on propose de reessayer.
    if (erreur !== null && notifications.length === 0) {
      return (
        <div className="px-4 py-6 text-center">
          <p role="alert" className="text-sm text-erreur">
            {t('cloche.erreur')}
          </p>
          <button
            type="button"
            onClick={actualiser}
            className="mt-3 min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte hover:bg-accent-fond"
          >
            {t('commun.reessayer')}
          </button>
        </div>
      )
    }

    if (chargementInitial) {
      return <p className="px-4 py-6 text-center text-sm text-texte-secondaire">{t('cloche.chargement')}</p>
    }

    if (notifications.length === 0) {
      return <p className="px-4 py-6 text-center text-sm text-texte-secondaire">{t('cloche.vide')}</p>
    }

    return (
      <ul>
        {notifications.map((notification) => {
          const nonLue = notification.lue_le === null
          return (
            <li
              key={notification.id}
              className={`flex items-stretch border-b border-bordure last:border-b-0 ${
                nonLue ? 'bg-fond-alt' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => ouvrirNotification(notification)}
                className="flex min-h-11 min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-accent-fond"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${nonLue ? 'bg-info' : ''}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm text-texte ${nonLue ? 'font-semibold' : ''}`}>
                    {notification.titre}
                  </span>
                  {notification.message !== null && (
                    <span className="mt-0.5 line-clamp-2 block text-sm text-texte-secondaire">
                      {notification.message}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-texte-secondaire">
                    {formaterDateHeure(notification.cree_le, langue)}
                  </span>
                </span>
                {nonLue && <span className="sr-only">{t('cloche.nonLue')}</span>}
              </button>

              {nonLue && (
                <button
                  type="button"
                  onClick={() => void marquerLue(notification.id)}
                  aria-label={t('cloche.marquerLue')}
                  title={t('cloche.marquerLue')}
                  className="flex min-h-11 min-w-11 items-center justify-center text-texte-secondaire hover:bg-accent-fond hover:text-texte"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div ref={racineRef} className="relative">
      <button
        ref={boutonRef}
        type="button"
        onClick={() => setOuvert((valeur) => !valeur)}
        aria-label={libelleBouton()}
        title={t('cloche.titre')}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-md text-texte-secondaire transition-colors hover:bg-accent-fond hover:text-texte"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {nonLues > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-erreur px-1 text-xs font-bold leading-none text-white"
          >
            {compteur}
          </span>
        )}
      </button>

      {ouvert && (
        <div
          id={idPanneau}
          role="dialog"
          aria-label={t('cloche.titre')}
          className="fixed inset-x-3 top-[4.25rem] z-40 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-lg border border-bordure bg-surface shadow-fort sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-bordure px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-texte">{t('cloche.titre')}</h2>
              <p className="text-sm text-texte-secondaire">{resume()}</p>
            </div>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label={t('cloche.fermer')}
              title={t('cloche.fermer')}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-texte-secondaire hover:bg-accent-fond hover:text-texte sm:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Avertissements : les notifications deja affichees restent a l'ecran */}
          {erreur !== null && notifications.length > 0 && (
            <p role="alert" className="border-b border-bordure px-4 py-2 text-sm text-erreur">
              {t('cloche.erreur')}
            </p>
          )}
          {erreurLecture !== null && (
            <p role="alert" className="border-b border-bordure px-4 py-2 text-sm text-erreur">
              {t('cloche.erreurLecture')}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">{contenuListe()}</div>

          {tronque && (
            <p className="border-t border-bordure px-4 py-2 text-xs text-texte-secondaire">
              {t('cloche.limite', { nombre: notifications.length })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}