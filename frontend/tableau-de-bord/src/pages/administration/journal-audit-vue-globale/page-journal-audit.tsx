import { useId } from 'react'
import { Navigate } from 'react-router'
import { FiltresJournalAudit } from '../../../composants-admin/filtres-journal-audit'
import { ListeJournalAudit } from '../../../composants-admin/liste-journal-audit'
import { utiliserJournalAudit } from '../../../hooks/utiliser-journal-audit'
import { utiliserLangue } from '../../../hooks/utiliser-langue'
import type { ErreurService } from '../../../services/api'

// Journal d'audit (jour 24), administrateur DTS seulement.
// - filtres : auteur, action, organisation, date de debut et date de fin ;
// - liste : les lignes de la plus recente a la plus ancienne, avec pagination.
// Les autres roles n'ont rien a faire ici : ils sont renvoyes a l'accueil (le serveur refuse
// aussi avec 403). Le journal se lit seulement : aucune action n'existe sur cet ecran.
// La page n'appelle pas l'API : tout vient de utiliserJournalAudit.
// Textes : suiviDts.journal.page.*

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
    message = t('suiviDts.journal.page.erreurDroits')
  } else {
    message = t('suiviDts.journal.page.erreur')
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

export function PageJournalAudit() {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const {
    acces,
    filtres,
    appliquerFiltres,
    reinitialiserFiltres,
    allerPage,
    periodeInvalide,
    entrees,
    pagination,
    chargement,
    erreur,
    organisations,
    erreurOrganisations,
    recharger,
  } = utiliserJournalAudit()

  // Les autres roles n'ont rien a voir ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  const filtreActif =
    filtres.utilisateur !== '' ||
    filtres.action !== null ||
    filtres.organisation !== '' ||
    filtres.du !== '' ||
    filtres.au !== ''

  // Ce que la liste dit quand elle n'a aucune ligne a montrer.
  let message: string | undefined
  if (chargement) {
    message = t('suiviDts.journal.page.chargement')
  } else if (erreur === null) {
    message = filtreActif
      ? t('suiviDts.journal.page.aucunResultat')
      : t('suiviDts.journal.page.vide')
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 id={idTitre} className="font-titre text-2xl font-bold text-texte">
          {t('suiviDts.journal.page.titre')}
        </h1>
        <p className="mt-1 text-texte-secondaire">{t('suiviDts.journal.page.sousTitre')}</p>
      </header>

      <section
        aria-labelledby={idTitre}
        className="flex flex-col gap-4 rounded-lg border border-bordure bg-surface p-5 shadow-doux"
      >
        <FiltresJournalAudit
          filtres={filtres}
          organisations={organisations}
          erreurOrganisations={erreurOrganisations}
          periodeInvalide={periodeInvalide}
          surChanger={appliquerFiltres}
          surReinitialiser={reinitialiserFiltres}
        />
      </section>

      {erreur !== null && <BlocEchec erreur={erreur} surReessayer={recharger} />}

      {!periodeInvalide && (
        <ListeJournalAudit
          entrees={entrees ?? []}
          pagination={pagination}
          enChargement={chargement && entrees !== null}
          message={message}
          surChangerPage={allerPage}
        />
      )}
    </div>
  )
}