import { useId, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { ConfirmationSuspension } from '../../../composants-admin/confirmation-suspension'
import { FormulaireInvitationResponsable } from '../../../composants-admin/formulaire-invitation-responsable'
import { FormulaireOrganisation } from '../../../composants-admin/formulaire-organisation'
import { PastilleStatutOrganisation } from '../../../composants-admin/pastille-statut-organisation'
import { utiliserLangue } from '../../../hooks/utiliser-langue'
import { utiliserOrganisationsAdmin } from '../../../hooks/utiliser-organisations-admin'
import type { ErreurService } from '../../../services/api'
import type { OrganisationAdmin, StatutOrganisation } from '../../../types/admin'

// Ecran E17 : organisations clientes (jour 23), administrateur DTS seulement.
// - liste des organisations (recherche par nom, filtre de statut, pagination) ;
// - creation : le formulaire s'ouvre en haut ; juste apres, le formulaire d'invitation du premier
//   responsable prend le relais (une invitation ratee ne bloque rien, on peut la renvoyer) ;
// - sur chaque organisation : modifier, inviter le premier responsable, suspendre ou reactiver
//   (toujours avec une confirmation qui nomme l'organisation) ;
// - les tables de l'organisation sont creees par son premier responsable, dans l'ecran E12.
// Les autres roles n'ont rien a faire ici : ils sont renvoyes a l'accueil (le serveur refuse
// aussi avec 403).
// La page n'appelle pas l'API : tout vient de utiliserOrganisationsAdmin.

type ActionOrganisation = 'modifier' | 'inviter' | 'suspendre' | 'reactiver'

// Ce que la page montre en plus de la liste : rien, la creation, l'invitation qui suit une
// creation, ou un bloc ouvert sous une organisation.
type Panneau =
  | { type: 'aucun' }
  | { type: 'creation' }
  | { type: 'apresCreation'; organisation: OrganisationAdmin; questionnaireCopie: boolean }
  | { type: 'organisation'; action: ActionOrganisation; id: string }

const STATUTS: StatutOrganisation[] = ['ESSAI', 'ACTIF', 'SUSPENDU']

const CLASSE_BOUTON_PRINCIPAL =
  'min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_CHAMP =
  'min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte'

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
    message = t('admin.organisations.page.erreurDroits')
  } else {
    message = t('admin.organisations.page.erreur')
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

export function PageOrganisations() {
  const { t, langue } = utiliserLangue()
  const idTitreListe = useId()
  const idRecherche = useId()
  const idStatut = useId()
  const {
    acces,
    filtres,
    appliquerFiltres,
    allerPage,
    organisations,
    pagination,
    chargement,
    erreur,
    secteurs,
    erreurSecteurs,
    recharger,
    creation,
    actions,
    invitation,
  } = utiliserOrganisationsAdmin()

  const [panneau, setPanneau] = useState<Panneau>({ type: 'aucun' })
  // Ce que la personne tape dans la recherche ; la liste ne change qu'a l'envoi.
  const [recherche, setRecherche] = useState('')

  // Les autres roles n'ont rien a gerer ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  function ouvrirCreation(): void {
    creation.reinitialiser()
    actions.reinitialiser()
    invitation.reinitialiser()
    setPanneau({ type: 'creation' })
  }

  function ouvrirSurOrganisation(action: ActionOrganisation, id: string): void {
    creation.reinitialiser()
    actions.reinitialiser()
    invitation.reinitialiser()
    setPanneau({ type: 'organisation', action, id })
  }

  function fermerPanneau(): void {
    creation.reinitialiser()
    actions.reinitialiser()
    invitation.reinitialiser()
    setPanneau({ type: 'aucun' })
  }

  function chercher(evenement: FormEvent<HTMLFormElement>): void {
    evenement.preventDefault()
    appliquerFiltres({ q: recherche.trim() })
  }

  function changerStatut(valeur: string): void {
    const statut = STATUTS.find((s) => s === valeur) ?? null
    appliquerFiltres({ statut })
  }

  async function confirmer(action: 'suspendre' | 'reactiver', id: string): Promise<void> {
    const fait = action === 'suspendre' ? await actions.suspendre(id) : await actions.reactiver(id)
    if (fait) {
      setPanneau({ type: 'aucun' })
    }
  }

  const formatDate = new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
  })
  const nomSecteur = (organisation: OrganisationAdmin): string =>
    langue === 'en' ? organisation.secteur.nom_en : organisation.secteur.nom_fr
  const filtreActif = filtres.q !== '' || filtres.statut !== null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-titre text-2xl font-bold text-texte">
            {t('admin.organisations.page.titre')}
          </h1>
          <p className="mt-1 text-texte-secondaire">{t('admin.organisations.page.sousTitre')}</p>
        </div>
        <button
          type="button"
          disabled={panneau.type === 'creation'}
          onClick={ouvrirCreation}
          className={CLASSE_BOUTON_PRINCIPAL}
        >
          {t('admin.organisations.page.nouvelle')}
        </button>
      </header>

      {panneau.type === 'creation' && (
        <FormulaireOrganisation
          mode="creation"
          secteurs={secteurs}
          erreurSecteurs={erreurSecteurs}
          enCours={creation.enCours}
          erreur={creation.erreur}
          succes={creation.succes}
          surEnvoyer={async (corps) => {
            const reponse = await creation.creer(corps)
            if (reponse === null) {
              return false
            }
            // Le hook repart d'une liste sans filtre : la recherche tapee est effacee aussi.
            setRecherche('')
            invitation.reinitialiser()
            setPanneau({
              type: 'apresCreation',
              organisation: reponse.organisation,
              questionnaireCopie: reponse.questionnaire_id !== null,
            })
            return true
          }}
          surFermer={fermerPanneau}
        />
      )}

      {panneau.type === 'apresCreation' && (
        <FormulaireInvitationResponsable
          key={panneau.organisation.id}
          organisation={panneau.organisation}
          invitation={invitation}
          apresCreation
          questionnaireCopie={panneau.questionnaireCopie}
          surFermer={fermerPanneau}
        />
      )}

      <section aria-labelledby={idTitreListe} className="flex flex-col gap-4">
        <h2 id={idTitreListe} className="m-0 font-titre text-lg font-bold text-texte">
          {pagination === null
            ? t('admin.organisations.page.liste.titreSansNombre')
            : t('admin.organisations.page.liste.titre', { nombre: pagination.total })}
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <form
            onSubmit={chercher}
            role="search"
            className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
          >
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <label htmlFor={idRecherche} className="text-sm font-semibold text-texte">
                {t('admin.organisations.page.recherche.label')}
              </label>
              <input
                id={idRecherche}
                type="search"
                autoComplete="off"
                maxLength={120}
                value={recherche}
                placeholder={t('admin.organisations.page.recherche.placeholder')}
                onChange={(evenement) => setRecherche(evenement.target.value)}
                className={CLASSE_CHAMP}
              />
            </div>
            <button type="submit" className={CLASSE_BOUTON_SECONDAIRE}>
              {t('admin.organisations.page.recherche.bouton')}
            </button>
          </form>

          <div className="flex min-w-40 flex-col gap-1">
            <label htmlFor={idStatut} className="text-sm font-semibold text-texte">
              {t('admin.organisations.page.filtreStatut.label')}
            </label>
            <select
              id={idStatut}
              value={filtres.statut ?? ''}
              onChange={(evenement) => changerStatut(evenement.target.value)}
              className={CLASSE_CHAMP}
            >
              <option value="">{t('admin.organisations.page.filtreStatut.tous')}</option>
              {STATUTS.map((statut) => (
                <option key={statut} value={statut}>
                  {t(`admin.organisations.statuts.${statut}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chargement && (
          <p role="status" className="m-0 text-sm text-texte-secondaire">
            {t('admin.organisations.page.chargement')}
          </p>
        )}
        {erreur !== null && <BlocEchec erreur={erreur} surReessayer={recharger} />}

        {organisations !== null && organisations.length === 0 && !chargement && (
          <p className="m-0 text-sm text-texte-secondaire">
            {filtreActif
              ? t('admin.organisations.page.liste.aucunResultat')
              : t('admin.organisations.page.liste.vide')}
          </p>
        )}

        {organisations !== null && organisations.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-busy={chargement}>
            {organisations.map((organisation) => {
              const ouvert =
                panneau.type === 'organisation' && panneau.id === organisation.id ? panneau : null
              const suspendue = organisation.statut === 'SUSPENDU'
              // Action de la confirmation ouverte sous cette organisation (null = aucune).
              const actionConfirmation =
                ouvert?.action === 'suspendre' || ouvert?.action === 'reactiver'
                  ? ouvert.action
                  : null
              const couleur = organisation.couleur_principale
              return (
                <li
                  key={organisation.id}
                  className="flex flex-col gap-4 rounded-lg border border-bordure bg-surface p-5 shadow-doux"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-2">
                      <h3 className="m-0 break-words font-titre text-lg font-bold text-texte">
                        {organisation.nom}
                      </h3>
                      <PastilleStatutOrganisation statut={organisation.statut} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => ouvrirSurOrganisation('modifier', organisation.id)}
                        className={CLASSE_BOUTON_SECONDAIRE}
                      >
                        {t('admin.organisations.page.actions.modifier')}
                      </button>
                      <button
                        type="button"
                        onClick={() => ouvrirSurOrganisation('inviter', organisation.id)}
                        className={CLASSE_BOUTON_SECONDAIRE}
                      >
                        {t('admin.organisations.page.actions.inviter')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          ouvrirSurOrganisation(suspendue ? 'reactiver' : 'suspendre', organisation.id)
                        }
                        className={CLASSE_BOUTON_SECONDAIRE}
                      >
                        {suspendue
                          ? t('admin.organisations.page.actions.reactiver')
                          : t('admin.organisations.page.actions.suspendre')}
                      </button>
                    </div>
                  </div>

                  <dl className="m-0 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col">
                      <dt className="text-xs text-texte-secondaire">
                        {t('admin.organisations.page.carte.secteur')}
                      </dt>
                      <dd className="m-0 break-words text-texte">{nomSecteur(organisation)}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-texte-secondaire">
                        {t('admin.organisations.page.carte.pays')}
                      </dt>
                      <dd className="m-0 text-texte">{organisation.pays}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-texte-secondaire">
                        {t('admin.organisations.page.carte.fuseau')}
                      </dt>
                      <dd className="m-0 break-words text-texte">{organisation.fuseau_horaire}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-texte-secondaire">
                        {t('admin.organisations.page.carte.langue')}
                      </dt>
                      <dd className="m-0 text-texte">
                        {t(
                          `admin.organisations.page.langues.${
                            organisation.langue_defaut === 'en' ? 'en' : 'fr'
                          }`,
                        )}
                      </dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-texte-secondaire">
                        {t('admin.organisations.page.carte.creeLe')}
                      </dt>
                      <dd className="m-0 text-texte">
                        {formatDate.format(new Date(organisation.cree_le))}
                      </dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-texte-secondaire">
                        {t('admin.organisations.page.carte.couleur')}
                      </dt>
                      <dd className="m-0 flex items-center gap-2 text-texte">
                        {couleur === null ? (
                          t('admin.organisations.page.carte.aucuneCouleur')
                        ) : (
                          <>
                            <span
                              aria-hidden="true"
                              className="size-4 rounded-full border border-bordure-champ"
                              style={{ backgroundColor: couleur }}
                            />
                            {couleur.toLowerCase()}
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {ouvert?.action === 'modifier' && (
                    <FormulaireOrganisation
                      key={organisation.id}
                      mode="modification"
                      organisation={organisation}
                      enCours={actions.enCours}
                      erreur={actions.erreur}
                      succes={actions.succes}
                      surEnvoyer={(corps) => actions.modifier(organisation.id, corps)}
                      surFermer={fermerPanneau}
                    />
                  )}

                  {ouvert?.action === 'inviter' && (
                    <FormulaireInvitationResponsable
                      key={organisation.id}
                      organisation={organisation}
                      invitation={invitation}
                      surFermer={fermerPanneau}
                    />
                  )}

                  {actionConfirmation !== null && (
                    <ConfirmationSuspension
                      action={actionConfirmation}
                      organisation={organisation}
                      enCours={actions.enCours}
                      erreur={actions.erreur}
                      surConfirmer={() => {
                        void confirmer(actionConfirmation, organisation.id)
                      }}
                      surAnnuler={fermerPanneau}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {pagination !== null && pagination.pages > 1 && (
          <nav
            aria-label={t('admin.organisations.page.pagination.pageSur', {
              numero: pagination.page,
              total: pagination.pages,
            })}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <button
              type="button"
              disabled={pagination.page <= 1 || chargement}
              onClick={() => allerPage(pagination.page - 1)}
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              {t('admin.organisations.page.pagination.precedent')}
            </button>
            <span aria-live="polite" className="text-sm text-texte-secondaire">
              {t('admin.organisations.page.pagination.pageSur', {
                numero: pagination.page,
                total: pagination.pages,
              })}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages || chargement}
              onClick={() => allerPage(pagination.page + 1)}
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              {t('admin.organisations.page.pagination.suivant')}
            </button>
          </nav>
        )}
      </section>
    </div>
  )
}