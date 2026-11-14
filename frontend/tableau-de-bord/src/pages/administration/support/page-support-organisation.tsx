import { Link, Navigate, useParams } from 'react-router'
import { ConsultationSupport } from '../../../composants-admin/consultation-support'
import { utiliserLangue } from '../../../hooks/utiliser-langue'
import { utiliserSupport } from '../../../hooks/utiliser-support'
import type { ErreurService } from '../../../services/api'

// Page de consultation de support d'une organisation (jour 24), administrateur DTS seulement.
// Adresse : /admin/organisations/:id/support (bouton "Support" de l'ecran E17).
// Elle montre en lecture seule ce que l'organisation a accepte de laisser voir.
// Les cas, selon le statut du hook utiliserSupport :
// - chargement : message d'attente ;
// - sans-accord : message clair (pas d'accord, accord expire ou retire), le serveur a repondu 403 ;
// - introuvable : l'organisation n'existe pas (404) ;
// - erreur : pas de reseau, droits refuses ou erreur generale, avec "Reessayer" ;
// - pret : la consultation (composant ConsultationSupport).
// Les autres roles n'ont rien a faire ici : ils sont renvoyes a l'accueil (le serveur refuse
// aussi avec 403). Aucune action n'existe sur cette page : le bouton "Actualiser" relit seulement.
// La page n'appelle pas l'API : tout vient de utiliserSupport.
// Textes : suiviDts.support.page.* ; commun.erreurReseau et commun.reessayer existent deja.

const CLASSE_BOUTON_SECONDAIRE =
  'inline-flex min-h-11 items-center rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

type PropsEchec = {
  erreur: ErreurService
  surReessayer: () => void
}

// Echec de la lecture de la fiche : pas de reseau (statut 0), droits refuses ou erreur generale.
function BlocEchec({ erreur, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  let message: string
  if (erreur.statut === 0) {
    message = t('commun.erreurReseau')
  } else if (erreur.statut === 403) {
    message = t('suiviDts.support.page.erreurDroits')
  } else {
    message = t('suiviDts.support.page.erreur')
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

export function PageSupportOrganisation() {
  const { t } = utiliserLangue()
  const { id } = useParams()
  const support = utiliserSupport(id ?? '')
  const { acces, statut, organisation, erreur, recharger } = support

  // Les autres roles n'ont rien a voir ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-titre text-2xl font-bold text-texte">
            {t('suiviDts.support.page.titre')}
          </h1>
          <p className="mt-1 text-texte-secondaire">
            {organisation !== null
              ? t('suiviDts.support.page.sousTitreOrganisation', { nom: organisation.nom })
              : t('suiviDts.support.page.sousTitre')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/organisations" className={CLASSE_BOUTON_SECONDAIRE}>
            {t('suiviDts.support.page.retour')}
          </Link>
          <button
            type="button"
            disabled={statut === 'chargement'}
            onClick={recharger}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {t('suiviDts.support.page.actualiser')}
          </button>
        </div>
      </header>

      {statut === 'chargement' && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('suiviDts.support.page.chargement')}
        </p>
      )}

      {statut === 'sans-accord' && (
        <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
          <h2 className="m-0 font-titre text-lg font-bold text-texte">
            {t('suiviDts.support.page.sansAccord.titre')}
          </h2>
          <p role="alert" className="mb-0 mt-2 text-sm text-texte-secondaire">
            {t('suiviDts.support.page.sansAccord.texte')}
          </p>
        </div>
      )}

      {statut === 'introuvable' && (
        <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
          <p role="alert" className="m-0 text-sm text-texte-secondaire">
            {t('suiviDts.support.page.introuvable')}
          </p>
        </div>
      )}

      {statut === 'erreur' && erreur !== null && <BlocEchec erreur={erreur} surReessayer={recharger} />}

      {statut === 'pret' && <ConsultationSupport support={support} />}
    </div>
  )
}