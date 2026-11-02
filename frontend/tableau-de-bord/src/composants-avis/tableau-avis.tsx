import { Link, useLocation } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { LigneAvis, OrdreTri, PaginationAvis, TriAvis } from '../types/avis'
import { classeFondClairNote, classeTexteNote } from '../utilitaires/couleurs-notes'
import { formaterDateHeure, formaterNombre } from '../utilitaires/periodes'
import {
  CLASSE_BASE_PASTILLE,
  CLASSES_PASTILLE_ALERTE,
  CLASSES_PASTILLE_PRIORITAIRE,
  niveauDeLaNoteAvis,
} from '../utilitaires/statuts-avis'
import { PastilleStatut } from './pastille-statut'

// Liste des avis de l'ecran E8 : un tableau sur ordinateur et tablette, des cartes sur telephone.
// Le tri (date, note, NPS) et la pagination viennent de l'API : ce composant n'affiche que
// la page recue et demande les changements. Il ne charge rien.
// Un clic sur un avis ouvre /avis/:id. L'adresse de la liste (avec ses filtres) est donnee
// a la fiche dans l'etat de navigation (listeAdresse) pour que "Retour a la liste"
// retrouve les memes filtres, le meme tri et la meme page.

type PropsPastilleNote = {
  note: number | null
}

// Note sur 5, coloree comme dans les avis recents de l'accueil. Sans note : texte discret.
function PastilleNote({ note }: PropsPastilleNote) {
  const { t, langue } = utiliserLangue()

  if (note === null) {
    return <span className="text-xs text-texte-discret">{t('avis.sansNote')}</span>
  }
  const niveau = niveauDeLaNoteAvis(note)
  return (
    <span
      className={`${CLASSE_BASE_PASTILLE} border-transparent ${classeFondClairNote(niveau)} ${classeTexteNote(niveau)}`}
    >
      {t('avis.noteSur5', { note: formaterNombre(note, langue) })}
    </span>
  )
}

type PropsPastillesAlerte = {
  avis: LigneAvis
}

// "Alerte" pour un avis qui a declenche une alerte, et "Prioritaire" en plus si elle l'est.
function PastillesAlerte({ avis }: PropsPastillesAlerte) {
  const { t } = utiliserLangue()

  return (
    <>
      {avis.en_alerte ? (
        <span className={CLASSES_PASTILLE_ALERTE}>{t('avis.alerte')}</span>
      ) : null}
      {avis.niveau_alerte === 'PRIORITAIRE' ? (
        <span className={CLASSES_PASTILLE_PRIORITAIRE}>{t('avis.prioritaire')}</span>
      ) : null}
    </>
  )
}

type PropsBoutonTri = {
  colonne: TriAvis
  libelle: string
  tri: TriAvis
  ordre: OrdreTri
  // 'entete' : dans l'en-tete du tableau. 'pastille' : au-dessus des cartes, sur telephone.
  variante: 'entete' | 'pastille'
  onTrier: (colonne: TriAvis) => void
}

// Bouton qui trie sur une colonne : un clic trie du plus grand au plus petit, un second clic inverse.
function BoutonTri({ colonne, libelle, tri, ordre, variante, onTrier }: PropsBoutonTri) {
  const { t } = utiliserLangue()
  const actif = tri === colonne
  const fleche = actif ? (ordre === 'asc' ? '▲' : '▼') : '↕'
  const classes =
    variante === 'entete'
      ? 'inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-texte-secondaire hover:bg-fond-alt'
      : `inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-medium transition-colors ${
          actif
            ? 'bg-principale text-texte-sur-principale'
            : 'bg-fond-alt text-texte hover:bg-surface-douce'
        }`

  return (
    <button
      type="button"
      onClick={() => onTrier(colonne)}
      aria-label={t('avis.tableau.trierPar', { colonne: libelle })}
      className={classes}
    >
      <span>{libelle}</span>
      <span aria-hidden="true" className={actif ? '' : 'opacity-50'}>
        {fleche}
      </span>
    </button>
  )
}

function valeurAriaSort(
  colonne: TriAvis,
  tri: TriAvis,
  ordre: OrdreTri,
): 'ascending' | 'descending' | 'none' {
  if (colonne !== tri) {
    return 'none'
  }
  return ordre === 'asc' ? 'ascending' : 'descending'
}

type PropsNavigationPages = {
  pagination: PaginationAvis
  nombreAffiches: number
  onChangerPage: (page: number) => void
}

// "Avis 21 a 40 sur 87" et les boutons Page precedente / Page suivante.
function NavigationPages({ pagination, nombreAffiches, onChangerPage }: PropsNavigationPages) {
  const { t } = utiliserLangue()
  const debut = (pagination.page - 1) * pagination.limite + 1
  const fin = debut + nombreAffiches - 1
  const classesBouton =
    'min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-medium text-texte transition-colors hover:bg-fond-alt disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <nav
      aria-label={t('avis.tableau.pagination')}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-texte-secondaire">
        {t('avis.tableau.affichage', { debut, fin, total: pagination.total })}
      </p>
      {pagination.pages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onChangerPage(pagination.page - 1)}
            className={classesBouton}
          >
            <span aria-hidden="true">‹ </span>
            {t('avis.tableau.pagePrecedente')}
          </button>
          <span className="text-sm text-texte">
            {t('avis.tableau.pageSur', { page: pagination.page, pages: pagination.pages })}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onChangerPage(pagination.page + 1)}
            className={classesBouton}
          >
            {t('avis.tableau.pageSuivante')}
            <span aria-hidden="true"> ›</span>
          </button>
        </div>
      ) : null}
    </nav>
  )
}

type Proprietes = {
  // Les avis de la page affichee (jamais vide : l'ecran gere le cas "aucun avis").
  avis: LigneAvis[]
  pagination: PaginationAvis
  tri: TriAvis
  ordre: OrdreTri
  // Vrai pendant un rechargement : la liste reste affichee, un peu estompee.
  enChargement: boolean
  onChangerTri: (tri: TriAvis, ordre: OrdreTri) => void
  onChangerPage: (page: number) => void
}

export function TableauAvis({
  avis,
  pagination,
  tri,
  ordre,
  enChargement,
  onChangerTri,
  onChangerPage,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const { search } = useLocation()
  const etatNavigation = { listeAdresse: search }

  function trierSur(colonne: TriAvis): void {
    onChangerTri(colonne, colonne === tri && ordre === 'desc' ? 'asc' : 'desc')
  }

  const libelleDate = t('avis.tableau.colonnes.date')
  const libelleNote = t('avis.tableau.colonnes.note')
  const libelleNps = t('avis.tableau.colonnes.nps')
  const classesEntete = 'px-3 py-2 text-left align-bottom text-sm font-medium text-texte-secondaire'

  return (
    <div className={`transition-opacity ${enChargement ? 'opacity-60' : ''}`} aria-busy={enChargement}>
      {/* Telephone : boutons de tri, puis une carte par avis */}
      <div className="mb-3 flex flex-wrap gap-2 md:hidden">
        <BoutonTri colonne="soumis_le" libelle={libelleDate} tri={tri} ordre={ordre} variante="pastille" onTrier={trierSur} />
        <BoutonTri colonne="note_globale" libelle={libelleNote} tri={tri} ordre={ordre} variante="pastille" onTrier={trierSur} />
        <BoutonTri colonne="nps" libelle={libelleNps} tri={tri} ordre={ordre} variante="pastille" onTrier={trierSur} />
      </div>

      <ul className="space-y-2 md:hidden">
        {avis.map((unAvis) => {
          const dateTexte = formaterDateHeure(unAvis.soumis_le, langue)
          return (
            <li key={unAvis.id}>
              <Link
                to={`/avis/${unAvis.id}`}
                state={etatNavigation}
                aria-label={t('avis.ouvrir', { date: dateTexte })}
                className="block rounded-md bg-surface/50 p-3 transition-colors hover:bg-fond-alt"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-texte-secondaire">{dateTexte}</span>
                  <PastilleNote note={unAvis.note_globale} />
                  {unAvis.nps !== null ? (
                    <span className="text-xs font-medium text-texte-secondaire">
                      {t('avis.npsValeur', { valeur: unAvis.nps })}
                    </span>
                  ) : null}
                  <PastilleStatut statut={unAvis.statut_traitement} />
                  <PastillesAlerte avis={unAvis} />
                </div>
                {unAvis.commentaire_extrait !== null ? (
                  <p className="mt-1.5 line-clamp-2 break-words text-sm text-texte">
                    {unAvis.commentaire_extrait}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm italic text-texte-discret">{t('avis.sansCommentaire')}</p>
                )}
                <p className="mt-0.5 text-xs text-texte-secondaire">
                  {t('avis.lieu', { point: unAvis.point_contact.nom, site: unAvis.site.nom })}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Ordinateur et tablette : tableau */}
      <div className="hidden overflow-x-auto rounded-lg bg-surface/50 md:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('avis.tableau.navigation')}</caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={valeurAriaSort('soumis_le', tri, ordre)} className={classesEntete}>
                <BoutonTri colonne="soumis_le" libelle={libelleDate} tri={tri} ordre={ordre} variante="entete" onTrier={trierSur} />
              </th>
              <th scope="col" aria-sort={valeurAriaSort('note_globale', tri, ordre)} className={classesEntete}>
                <BoutonTri colonne="note_globale" libelle={libelleNote} tri={tri} ordre={ordre} variante="entete" onTrier={trierSur} />
              </th>
              <th scope="col" aria-sort={valeurAriaSort('nps', tri, ordre)} className={classesEntete}>
                <BoutonTri colonne="nps" libelle={libelleNps} tri={tri} ordre={ordre} variante="entete" onTrier={trierSur} />
              </th>
              <th scope="col" className={`${classesEntete} pb-3`}>
                {t('avis.tableau.colonnes.statut')}
              </th>
              <th scope="col" className={`${classesEntete} pb-3`}>
                {t('avis.tableau.colonnes.lieu')}
              </th>
              <th scope="col" className={`${classesEntete} pb-3`}>
                {t('avis.tableau.colonnes.commentaire')}
              </th>
            </tr>
          </thead>
          <tbody>
            {avis.map((unAvis) => {
              const dateTexte = formaterDateHeure(unAvis.soumis_le, langue)
              return (
                <tr key={unAvis.id} className="relative border-t border-bordure hover:bg-fond-alt/50">
                  <td className="whitespace-nowrap px-3 py-3 align-top text-sm text-texte-secondaire">
                    {/* Lien etire sur toute la ligne : un clic n'importe ou ouvre l'avis */}
                    <Link
                      to={`/avis/${unAvis.id}`}
                      state={etatNavigation}
                      aria-label={t('avis.ouvrir', { date: dateTexte })}
                      className="before:absolute before:inset-0 before:content-['']"
                    >
                      {dateTexte}
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <PastilleNote note={unAvis.note_globale} />
                  </td>
                  <td className="px-3 py-3 align-top text-sm font-medium text-texte-secondaire">
                    {unAvis.nps !== null ? (
                      unAvis.nps
                    ) : (
                      <span className="text-texte-discret">
                        <span aria-hidden="true">–</span>
                        <span className="sr-only">{t('avis.nonRenseigne')}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PastilleStatut statut={unAvis.statut_traitement} />
                      <PastillesAlerte avis={unAvis} />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-sm text-texte-secondaire">
                    {t('avis.lieu', { point: unAvis.point_contact.nom, site: unAvis.site.nom })}
                  </td>
                  <td className="max-w-xs px-3 py-3 align-top text-sm">
                    {unAvis.commentaire_extrait !== null ? (
                      <span className="line-clamp-2 break-words text-texte">{unAvis.commentaire_extrait}</span>
                    ) : (
                      <span className="italic text-texte-discret">{t('avis.sansCommentaire')}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <NavigationPages
        pagination={pagination}
        nombreAffiches={avis.length}
        onChangerPage={onChangerPage}
      />
    </div>
  )
}