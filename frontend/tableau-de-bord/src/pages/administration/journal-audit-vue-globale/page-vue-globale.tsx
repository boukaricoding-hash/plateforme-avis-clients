import { Navigate } from 'react-router'
import { CartesVueGlobale } from '../../../composants-admin/cartes-vue-globale'
import { CourbeAvisParJour } from '../../../composants-admin/courbe-avis-par-jour'
import { ListeErreursRecentes } from '../../../composants-admin/liste-erreurs-recentes'
import { utiliserLangue } from '../../../hooks/utiliser-langue'
import { utiliserVueGlobale } from '../../../hooks/utiliser-vue-globale'
import type { ErreurService } from '../../../services/api'

// Ecran E19 : vue globale de la plateforme (jour 24), administrateur DTS seulement.
// - cartes : organisations par statut et utilisateurs actifs par role ;
// - courbe : avis par jour de toute la plateforme sur 30 jours ;
// - erreurs recentes : les echecs du journal des 7 derniers jours.
// Les autres roles n'ont rien a faire ici : ils sont renvoyes a l'accueil (le serveur refuse
// aussi avec 403). La vue se lit seulement : le bouton "Actualiser" relit les chiffres.
// La page n'appelle pas l'API : tout vient de utiliserVueGlobale.
// Textes : suiviDts.vueGlobale.page.*

const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

type PropsEchec = {
  erreur: ErreurService
  surReessayer: () => void
}

// Echec du chargement : pas de reseau (statut 0), droits refuses ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  let message: string
  if (erreur.statut === 0) {
    message = t('commun.erreurReseau')
  } else if (erreur.statut === 403) {
    message = t('suiviDts.vueGlobale.page.erreurDroits')
  } else {
    message = t('suiviDts.vueGlobale.page.erreur')
  }

  return (
    <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
      <p role="alert" className="m-0 text-sm text-erreur">
        {message}
      </p>
      <button type="button" onClick={surReessayer} className={`mt-3 ${CLASSE_BOUTON_SECONDAIRE}`}>
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

export function PageVueGlobale() {
  const { t } = utiliserLangue()
  const { acces, vue, chargement, erreur, recharger } = utiliserVueGlobale()

  // Les autres roles n'ont rien a voir ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-titre text-2xl font-bold text-texte">
            {t('suiviDts.vueGlobale.page.titre')}
          </h1>
          <p className="mt-1 text-texte-secondaire">{t('suiviDts.vueGlobale.page.sousTitre')}</p>
        </div>
        <button
          type="button"
          disabled={chargement}
          onClick={recharger}
          className={CLASSE_BOUTON_SECONDAIRE}
        >
          {t('suiviDts.vueGlobale.page.actualiser')}
        </button>
      </header>

      {chargement && vue === null && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('suiviDts.vueGlobale.page.chargement')}
        </p>
      )}
      {erreur !== null && <BlocEchec erreur={erreur} surReessayer={recharger} />}

      {vue !== null && (
        <div aria-busy={chargement} className="flex flex-col gap-6">
          <CartesVueGlobale organisations={vue.organisations} utilisateurs={vue.utilisateurs} />
          <CourbeAvisParJour avisParJour={vue.avis_par_jour} />
          <ListeErreursRecentes erreurs={vue.erreurs_recentes} />
        </div>
      )}
    </div>
  )
}