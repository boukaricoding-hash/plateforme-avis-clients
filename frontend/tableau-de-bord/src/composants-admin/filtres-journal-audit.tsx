import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { FiltresListeJournal, OrganisationChoixJournal } from '../hooks/utiliser-journal-audit'
import type { ErreurService } from '../services/api'
import {
  ACTIONS_JOURNAL,
  GROUPES_ACTIONS_JOURNAL,
  type GroupeActionsJournal,
} from '../types/suivi-dts'

// Barre de filtres du journal d'audit (back-office DTS, jour 24), administrateur seulement.
// - auteur : morceau de son adresse e-mail, applique a l'envoi (bouton ou touche Entree) ;
// - action (rangee par familles), organisation, date de debut et date de fin : appliques tout de suite ;
// - "Reinitialiser" efface tous les filtres, y compris ce qui est tape dans la recherche.
// Ce composant n'appelle pas l'API : la page lui donne les filtres et les fonctions du hook.
// Si la date de debut est apres la date de fin, un message l'explique et le hook n'envoie rien.
// Si la liste des organisations n'a pas pu etre chargee, le choix d'organisation est bloque
// et un message le dit : le reste du journal reste utilisable.

type Proprietes = {
  filtres: FiltresListeJournal
  // Organisations proposees ; null tant qu'elles ne sont pas chargees.
  organisations: OrganisationChoixJournal[] | null
  erreurOrganisations: ErreurService | null
  // Vrai si la date de debut est apres la date de fin.
  periodeInvalide: boolean
  // Change un ou plusieurs filtres (la liste revient a la page 1).
  surChanger: (changement: Partial<Omit<FiltresListeJournal, 'page'>>) => void
  // Efface tous les filtres.
  surReinitialiser: () => void
}

const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_CHAMP =
  'min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte disabled:cursor-not-allowed disabled:opacity-60'

const GROUPES = Object.keys(GROUPES_ACTIONS_JOURNAL) as GroupeActionsJournal[]

export function FiltresJournalAudit({
  filtres,
  organisations,
  erreurOrganisations,
  periodeInvalide,
  surChanger,
  surReinitialiser,
}: Proprietes) {
  const { t } = utiliserLangue()
  const idUtilisateur = useId()
  const idAction = useId()
  const idOrganisation = useId()
  const idMessageOrganisation = useId()
  const idDu = useId()
  const idAu = useId()
  const idMessagePeriode = useId()

  // Ce que la personne tape dans la recherche d'auteur ; la liste ne change qu'a l'envoi.
  const [recherche, setRecherche] = useState(filtres.utilisateur)

  const filtreActif =
    filtres.utilisateur !== '' ||
    filtres.action !== null ||
    filtres.organisation !== '' ||
    filtres.du !== '' ||
    filtres.au !== ''

  function chercher(evenement: FormEvent<HTMLFormElement>): void {
    evenement.preventDefault()
    surChanger({ utilisateur: recherche.trim() })
  }

  function changerAction(valeur: string): void {
    const action = ACTIONS_JOURNAL.find((a) => a === valeur) ?? null
    surChanger({ action })
  }

  function reinitialiser(): void {
    setRecherche('')
    surReinitialiser()
  }

  // Le choix d'organisation est bloque tant que la liste n'est pas la, ou si elle a echoue.
  const organisationsIndisponibles = erreurOrganisations !== null
  const choixOrganisationBloque = organisations === null

  return (
    <form
      onSubmit={chercher}
      role="search"
      aria-label={t('suiviDts.journal.filtres.titre')}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={idUtilisateur} className="text-sm font-semibold text-texte">
            {t('suiviDts.journal.filtres.utilisateur.label')}
          </label>
          <input
            id={idUtilisateur}
            type="search"
            autoComplete="off"
            maxLength={100}
            value={recherche}
            placeholder={t('suiviDts.journal.filtres.utilisateur.placeholder')}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            className={CLASSE_CHAMP}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idAction} className="text-sm font-semibold text-texte">
            {t('suiviDts.journal.filtres.action.label')}
          </label>
          <select
            id={idAction}
            value={filtres.action ?? ''}
            onChange={(evenement) => changerAction(evenement.target.value)}
            className={CLASSE_CHAMP}
          >
            <option value="">{t('suiviDts.journal.filtres.action.toutes')}</option>
            {GROUPES.map((groupe) => (
              <optgroup key={groupe} label={t(`suiviDts.journal.groupes.${groupe}`)}>
                {GROUPES_ACTIONS_JOURNAL[groupe].map((action) => (
                  <option key={action} value={action}>
                    {t(`suiviDts.journal.actions.${action}`)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idOrganisation} className="text-sm font-semibold text-texte">
            {t('suiviDts.journal.filtres.organisation.label')}
          </label>
          <select
            id={idOrganisation}
            value={filtres.organisation}
            disabled={choixOrganisationBloque}
            aria-describedby={organisationsIndisponibles ? idMessageOrganisation : undefined}
            onChange={(evenement) => surChanger({ organisation: evenement.target.value })}
            className={CLASSE_CHAMP}
          >
            <option value="">{t('suiviDts.journal.filtres.organisation.toutes')}</option>
            {(organisations ?? []).map((organisation) => (
              <option key={organisation.id} value={organisation.id}>
                {organisation.nom}
              </option>
            ))}
          </select>
          {organisationsIndisponibles && (
            <p id={idMessageOrganisation} role="status" className="m-0 text-xs text-texte-secondaire">
              {t('suiviDts.journal.filtres.organisation.indisponible')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idDu} className="text-sm font-semibold text-texte">
            {t('suiviDts.journal.filtres.du')}
          </label>
          <input
            id={idDu}
            type="date"
            value={filtres.du}
            max={filtres.au === '' ? undefined : filtres.au}
            aria-invalid={periodeInvalide}
            aria-describedby={periodeInvalide ? idMessagePeriode : undefined}
            onChange={(evenement) => surChanger({ du: evenement.target.value })}
            className={CLASSE_CHAMP}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idAu} className="text-sm font-semibold text-texte">
            {t('suiviDts.journal.filtres.au')}
          </label>
          <input
            id={idAu}
            type="date"
            value={filtres.au}
            min={filtres.du === '' ? undefined : filtres.du}
            aria-invalid={periodeInvalide}
            aria-describedby={periodeInvalide ? idMessagePeriode : undefined}
            onChange={(evenement) => surChanger({ au: evenement.target.value })}
            className={CLASSE_CHAMP}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className={CLASSE_BOUTON_SECONDAIRE}>
            {t('suiviDts.journal.filtres.rechercher')}
          </button>
          <button
            type="button"
            disabled={!filtreActif && recherche === ''}
            onClick={reinitialiser}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {t('suiviDts.journal.filtres.reinitialiser')}
          </button>
        </div>
      </div>

      {periodeInvalide && (
        <p id={idMessagePeriode} role="alert" className="m-0 text-xs text-erreur">
          {t('suiviDts.journal.filtres.periodeInvalide')}
        </p>
      )}
    </form>
  )
}
