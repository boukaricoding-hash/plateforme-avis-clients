import { Navigate } from 'react-router'
import { SectionAlertes } from '../../composants-parametres/section-alertes'
import { SectionLogo } from '../../composants-parametres/section-logo'
import { SectionNotifications } from '../../composants-parametres/section-notifications'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserParametres } from '../../hooks/utiliser-parametres'
import type { ErreurService } from '../../services/api'

// Ecran E14 : parametres de l'organisation (jour 16).
// - Le Responsable voit tout : logo, couleur et seuils d'alerte, preference d'alerte.
// - Le Gestionnaire voit seulement sa preference d'alerte.
// - L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// La page n'appelle pas l'API : tout vient de utiliserParametres. Chaque bloc a son propre
// chargement et sa propre erreur, avec un bouton "Reessayer".

type PropsEchec = {
  erreur: ErreurService
  cleGenerale: string
  surReessayer: () => void
}

// Echec d'un chargement : pas de reseau (statut 0) ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, cleGenerale, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  return (
    <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
      <p role="alert" className="m-0 text-sm text-erreur">
        {erreur.statut === 0 ? t('commun.erreurReseau') : t(cleGenerale)}
      </p>
      <button
        type="button"
        onClick={surReessayer}
        className="mt-3 min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond"
      >
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

export function PageParametres() {
  const { t } = utiliserLangue()
  const {
    acces,
    parametres,
    chargementParametres,
    erreurParametres,
    preferences,
    chargementPreferences,
    erreurPreferences,
    recharger,
    logo,
    alertes,
    notifications,
  } = utiliserParametres()

  // L'administrateur DTS n'a pas d'organisation : rien a regler ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <h1 className="font-titre text-2xl font-bold text-texte">{t('parametres.titre')}</h1>
        <p className="mt-1 text-texte-secondaire">
          {acces === 'responsable'
            ? t('parametres.sousTitre')
            : t('parametres.sousTitreGestionnaire')}
        </p>
      </header>

      {/* Parametres de l'organisation : Responsable seulement */}
      {acces === 'responsable' && chargementParametres && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('parametres.chargement')}
        </p>
      )}
      {acces === 'responsable' && erreurParametres !== null && parametres === null && (
        <BlocEchec
          erreur={erreurParametres}
          cleGenerale="parametres.erreur"
          surReessayer={recharger}
        />
      )}
      {parametres !== null && (
        <>
          <SectionLogo parametres={parametres} etat={logo} />
          <SectionAlertes parametres={parametres} etat={alertes} />
        </>
      )}

      {/* Preference d'alerte : Responsable et Gestionnaire */}
      {chargementPreferences && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('parametres.notifications.chargement')}
        </p>
      )}
      {erreurPreferences !== null && preferences === null && (
        <BlocEchec
          erreur={erreurPreferences}
          cleGenerale="parametres.notifications.erreurLecture"
          surReessayer={recharger}
        />
      )}
      {preferences !== null && (
        <SectionNotifications preferences={preferences} etat={notifications} />
      )}
    </div>
  )
}