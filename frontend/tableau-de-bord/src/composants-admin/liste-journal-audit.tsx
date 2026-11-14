import type { ReactNode } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import {
  ACTIONS_JOURNAL,
  type DetailsJournal,
  type EntreeJournal,
  type PaginationJournal,
} from '../types/suivi-dts'
import { Pagination } from '../composants-tableau/pagination'

// Liste du journal d'audit (back-office DTS, jour 24), administrateur seulement.
// Chaque ligne est une carte : date et heure (en UTC, comme le serveur), libelle de l'action,
// auteur (son e-mail), organisation et un petit resume des details.
// Ce composant ne charge rien : la page lui donne la page de lignes recue et la pagination.
// - action inconnue de cette version (le serveur a pu en ajouter) : le code est affiche tel quel ;
// - action sans compte (exemple : echec de connexion sur une adresse inconnue) : texte "sans compte" ;
// - action sans organisation (exemple : connexion de l'administrateur DTS) : texte "sans organisation" ;
// - details : les 4 premieres valeurs simples, sans les identifiants techniques (cles qui finissent
//   par id), le reste est resume par "+ N autres". Le serveur a deja retire tout secret.
// Textes : suiviDts.journal.liste.* et suiviDts.journal.actions.<CODE>.
// La pagination reprend celle de l'accueil (textes tableau.accueil.*).

// Nombre maximum de valeurs montrees dans le resume des details.
const DETAILS_MAX = 4

// Cles techniques qu'on ne montre pas : id, utilisateur_cible_id, secteur_id...
const CLE_IDENTIFIANT = /(^|_)id$/

type ValeurDetail = DetailsJournal[string]

type Proprietes = {
  // Les lignes de la page affichee. Vide pendant le chargement, apres une erreur
  // ou quand aucune ligne ne correspond aux filtres (voir message).
  entrees: EntreeJournal[]
  // null tant que la liste n'est pas arrivee
  pagination: PaginationJournal | null
  // Vrai pendant un rechargement : la liste reste affichee, un peu estompee.
  enChargement: boolean
  // Texte ou bloc montre a la place des lignes quand il n'y a rien a afficher
  // (chargement, erreur, aucun resultat). La page choisit quoi dire.
  message?: ReactNode
  // Numero de la page demandee, a partir de 1
  surChangerPage: (page: number) => void
}

// Les valeurs simples d'une ligne, sans les identifiants techniques.
function valeursVisibles(details: DetailsJournal | null): [string, ValeurDetail][] {
  if (details === null) {
    return []
  }
  return Object.entries(details).filter(([cle]) => !CLE_IDENTIFIANT.test(cle))
}

export function ListeJournalAudit({
  entrees,
  pagination,
  enChargement,
  message,
  surChangerPage,
}: Proprietes) {
  const { t, langue } = utiliserLangue()

  const formatDate = new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  function libelleAction(action: string): string {
    const connue = ACTIONS_JOURNAL.find((code) => code === action)
    return connue === undefined ? action : t(`suiviDts.journal.actions.${connue}`)
  }

  function texteValeur(valeur: ValeurDetail): string {
    if (valeur === null) {
      return '—'
    }
    if (typeof valeur === 'boolean') {
      return valeur ? t('suiviDts.journal.liste.oui') : t('suiviDts.journal.liste.non')
    }
    return String(valeur)
  }

  return (
    <section className="flex flex-col gap-3" aria-label={t('suiviDts.journal.liste.navigation')}>
      <p aria-live="polite" className="m-0 min-h-5 text-sm text-texte-secondaire">
        {pagination !== null
          ? t('suiviDts.journal.liste.resultats', { total: pagination.total })
          : null}
      </p>

      {entrees.length > 0 ? (
        <ul
          aria-busy={enChargement}
          className={`m-0 flex list-none flex-col gap-3 p-0 transition-opacity ${enChargement ? 'opacity-60' : ''}`}
        >
          {entrees.map((entree) => {
            const valeurs = valeursVisibles(entree.details)
            const affichees = valeurs.slice(0, DETAILS_MAX)
            const restantes = valeurs.length - affichees.length
            return (
              <li
                key={entree.id}
                className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4 shadow-doux"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="m-0 break-words text-base font-semibold text-texte">
                    {libelleAction(entree.action)}
                  </h3>
                  <time dateTime={entree.cree_le} className="text-sm text-texte-secondaire">
                    {formatDate.format(new Date(entree.cree_le))}
                  </time>
                </div>

                <dl className="m-0 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col">
                    <dt className="text-xs text-texte-discret">
                      {t('suiviDts.journal.liste.auteur')}
                    </dt>
                    <dd className="m-0 break-words text-texte">
                      {entree.utilisateur !== null
                        ? entree.utilisateur.email
                        : t('suiviDts.journal.liste.sansCompte')}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <dt className="text-xs text-texte-discret">
                      {t('suiviDts.journal.liste.organisation')}
                    </dt>
                    <dd className="m-0 break-words text-texte">
                      {entree.organisation !== null
                        ? entree.organisation.nom
                        : t('suiviDts.journal.liste.sansOrganisation')}
                    </dd>
                  </div>
                </dl>

                {affichees.length > 0 && (
                  <p className="m-0 break-words text-xs text-texte-secondaire">
                    {affichees
                      .map(([cle, valeur]) => `${cle} : ${texteValeur(valeur)}`)
                      .join(' · ')}
                    {restantes > 0 &&
                      ` · ${t('suiviDts.journal.liste.autres', { nombre: restantes })}`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      ) : message !== undefined ? (
        <div className="rounded-lg border border-bordure bg-surface p-5 text-sm text-texte-secondaire">
          {message}
        </div>
      ) : null}

      {pagination !== null && (
        <Pagination
          pageCourante={pagination.page - 1}
          nbPages={pagination.pages}
          onAller={(page) => surChangerPage(page + 1)}
        />
      )}
    </section>
  )
}