import type { ReactNode } from 'react'
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
import { IconeChevronDroite, IconeChevronGauche } from './icones-avis'
import { PastilleStatut } from './pastille-statut'

// Liste des avis de la page unique (jour 15 design) : les avis en cartes sur 2 colonnes,
// une pastille de tri au-dessus, et la pagination en bulles numerotees en dessous.
// Remplace tableau-avis.tsx. Le tri et la pagination viennent de l'API : ce composant affiche
// la page recue et demande les changements. Il ne charge rien.
// Un clic sur une carte ne change pas de page : il choisit l'avis, la page l'affiche a droite.
// Le style vient de styles/avis.css (classes avis-liste, avis-cartes, avis-carte, avis-bulle...).
//
// La zone des cartes (classe avis-liste-zone) est toujours presente, meme sans avis : la page
// y met refZone pour mesurer sa hauteur (hook utiliserCartesParPage) avant de charger la liste.
// La zone de pagination est elle aussi toujours presente, avec une hauteur reservee : sans cela,
// la hauteur de la zone des cartes changerait quand la pagination apparait, et le nombre de
// cartes par page serait recalcule (donc la liste rechargee) pour rien.

// Les 6 choix de tri : chaque colonne, du plus grand au plus petit, puis l'inverse.
type ChoixTri = {
  tri: TriAvis
  ordre: OrdreTri
}

const CHOIX_TRI: readonly ChoixTri[] = [
  { tri: 'soumis_le', ordre: 'desc' },
  { tri: 'soumis_le', ordre: 'asc' },
  { tri: 'note_globale', ordre: 'desc' },
  { tri: 'note_globale', ordre: 'asc' },
  { tri: 'nps', ordre: 'desc' },
  { tri: 'nps', ordre: 'asc' },
]

// Textes des colonnes : ceux du tableau de la liste (traductions deja en place)
const CLES_COLONNES: Record<TriAvis, string> = {
  soumis_le: 'avis.tableau.colonnes.date',
  note_globale: 'avis.tableau.colonnes.note',
  nps: 'avis.tableau.colonnes.nps',
}

// Au-dela de ce nombre de pages, on abrege avec des points de suspension.
const PAGES_TOUTES_AFFICHEES = 7

function valeurChoixTri(choix: ChoixTri): string {
  return `${choix.tri}:${choix.ordre}`
}

// ------------------------------------------------------------
// Pastilles d'une carte
// ------------------------------------------------------------

type PropsPastilleNote = {
  note: number | null
}

// Note sur 5, coloree comme dans les avis recents de l'accueil. Sans note : texte discret.
function PastilleNote({ note }: PropsPastilleNote) {
  const { t, langue } = utiliserLangue()

  if (note === null) {
    return <span className="shrink-0 text-xs text-texte-discret">{t('avis.sansNote')}</span>
  }
  const niveau = niveauDeLaNoteAvis(note)
  return (
    <span
      className={`${CLASSE_BASE_PASTILLE} shrink-0 border-transparent ${classeFondClairNote(niveau)} ${classeTexteNote(niveau)}`}
    >
      {t('avis.noteSur5', { note: formaterNombre(note, langue) })}
    </span>
  )
}

type PropsPastilleAlerte = {
  avis: LigneAvis
}

// Une seule pastille d'alerte, pour gagner de la place : "Prioritaire" si l'alerte l'est,
// sinon "Alerte". Rien si l'avis n'a pas declenche d'alerte.
function PastilleAlerte({ avis }: PropsPastilleAlerte) {
  const { t } = utiliserLangue()

  if (avis.niveau_alerte === 'PRIORITAIRE') {
    return (
      <span className={`${CLASSES_PASTILLE_PRIORITAIRE} shrink-0`}>{t('avis.prioritaire')}</span>
    )
  }
  if (avis.en_alerte) {
    return <span className={`${CLASSES_PASTILLE_ALERTE} shrink-0`}>{t('avis.alerte')}</span>
  }
  return null
}

// ------------------------------------------------------------
// Une carte
// ------------------------------------------------------------

type PropsCarteAvis = {
  avis: LigneAvis
  choisie: boolean
  onChoisir: (id: string) => void
}

// Deux lignes (la hauteur de la carte est fixe, voir --v-hauteur-carte dans avis.css) :
// date et note, puis statut, alerte et lieu. Le texte reste lisible par un lecteur d'ecran.
function CarteAvis({ avis, choisie, onChoisir }: PropsCarteAvis) {
  const { t, langue } = utiliserLangue()
  const lieu = t('avis.lieu', { point: avis.point_contact.nom, site: avis.site.nom })

  return (
    <li>
      <button
        type="button"
        onClick={() => onChoisir(avis.id)}
        aria-pressed={choisie}
        className={choisie ? 'avis-carte avis-carte--choisie' : 'avis-carte'}
      >
        <span className="avis-carte-ligne">
          <span className="avis-carte-date">{formaterDateHeure(avis.soumis_le, langue)}</span>
          <PastilleNote note={avis.note_globale} />
        </span>
        <span className="avis-carte-ligne">
          <span className="shrink-0">
            <PastilleStatut statut={avis.statut_traitement} />
          </span>
          <PastilleAlerte avis={avis} />
          <span className="avis-carte-lieu" title={lieu}>
            {lieu}
          </span>
        </span>
      </button>
    </li>
  )
}

// ------------------------------------------------------------
// Tri
// ------------------------------------------------------------

type PropsTriListe = {
  tri: TriAvis
  ordre: OrdreTri
  onChangerTri: (tri: TriAvis, ordre: OrdreTri) => void
}

// Petite pastille au-dessus de la liste : une liste deroulante avec les colonnes triables,
// chacune dans les deux sens (fleche vers le bas : du plus grand au plus petit).
function TriListe({ tri, ordre, onChangerTri }: PropsTriListe) {
  const { t } = utiliserLangue()

  function choisir(valeur: string): void {
    const choix = CHOIX_TRI.find((possible) => valeurChoixTri(possible) === valeur)
    if (choix !== undefined) {
      onChangerTri(choix.tri, choix.ordre)
    }
  }

  return (
    <select
      value={valeurChoixTri({ tri, ordre })}
      onChange={(evenement) => choisir(evenement.target.value)}
      aria-label={t('avis.tableau.trierPar', { colonne: t(CLES_COLONNES[tri]) })}
      className="min-h-11 max-w-full rounded-full border border-bordure-champ bg-surface-douce px-3 text-xs font-medium text-texte"
    >
      {CHOIX_TRI.map((choix) => (
        <option key={valeurChoixTri(choix)} value={valeurChoixTri(choix)}>
          {`${t(CLES_COLONNES[choix.tri])} ${choix.ordre === 'asc' ? '▲' : '▼'}`}
        </option>
      ))}
    </select>
  )
}

// ------------------------------------------------------------
// Pagination en bulles
// ------------------------------------------------------------

type ElementPagination = {
  cle: string
  // Numero de la page, ou null pour des points de suspension
  numero: number | null
}

// Les pages a montrer : la premiere, la derniere, la page courante et ses voisines.
// Un trou entre deux numeros donne des points de suspension. Exemple : 1 … 4 5 6 … 20
function elementsPagination(page: number, pages: number): ElementPagination[] {
  const numeros =
    pages <= PAGES_TOUTES_AFFICHEES
      ? Array.from({ length: pages }, (_, index) => index + 1)
      : [...new Set([1, page - 1, page, page + 1, pages])]
          .filter((numero) => numero >= 1 && numero <= pages)
          .sort((a, b) => a - b)

  const elements: ElementPagination[] = []
  numeros.forEach((numero, index) => {
    const precedent = numeros[index - 1]
    if (precedent !== undefined && numero - precedent > 1) {
      elements.push({ cle: `trou-${numero}`, numero: null })
    }
    elements.push({ cle: `page-${numero}`, numero })
  })
  return elements
}

type PropsPaginationBulles = {
  pagination: PaginationAvis | null
  onChangerPage: (page: number) => void
}

function PaginationBulles({ pagination, onChangerPage }: PropsPaginationBulles) {
  const { t } = utiliserLangue()

  // Hauteur reservee (une bulle) meme sans pagination : voir le commentaire en haut du fichier.
  if (pagination === null || pagination.pages <= 1) {
    return <div className="min-h-8" aria-hidden="true" />
  }

  return (
    <nav aria-label={t('avis.tableau.pagination')} className="avis-pagination min-h-8">
      <button
        type="button"
        className="avis-bulle"
        disabled={pagination.page <= 1}
        onClick={() => onChangerPage(pagination.page - 1)}
        aria-label={t('avis.tableau.pagePrecedente')}
      >
        <IconeChevronGauche width={16} height={16} />
      </button>
      {elementsPagination(pagination.page, pagination.pages).map((element) =>
        element.numero === null ? (
          <span key={element.cle} aria-hidden="true" className="px-0.5 text-texte-secondaire">
            …
          </span>
        ) : (
          <button
            key={element.cle}
            type="button"
            className={
              element.numero === pagination.page ? 'avis-bulle avis-bulle--active' : 'avis-bulle'
            }
            aria-current={element.numero === pagination.page ? 'page' : undefined}
            aria-label={t('avis.tableau.pageSur', {
              page: element.numero,
              pages: pagination.pages,
            })}
            onClick={() => onChangerPage(element.numero ?? pagination.page)}
          >
            {element.numero}
          </button>
        ),
      )}
      <button
        type="button"
        className="avis-bulle"
        disabled={pagination.page >= pagination.pages}
        onClick={() => onChangerPage(pagination.page + 1)}
        aria-label={t('avis.tableau.pageSuivante')}
      >
        <IconeChevronDroite width={16} height={16} />
      </button>
    </nav>
  )
}

// ------------------------------------------------------------
// La liste
// ------------------------------------------------------------

type Proprietes = {
  // Les avis de la page affichee. Vide pendant le premier chargement, apres une erreur
  // ou quand aucun avis ne correspond aux filtres (voir message).
  avis: LigneAvis[]
  // null tant que la liste n'est pas arrivee
  pagination: PaginationAvis | null
  tri: TriAvis
  ordre: OrdreTri
  // Identifiant de l'avis affiche a droite, ou null
  avisChoisi: string | null
  // Vrai pendant un rechargement : la liste reste affichee, un peu estompee.
  enChargement: boolean
  // Texte ou bloc montre a la place des cartes quand il n'y a aucun avis a afficher
  // (chargement, erreur, aucun resultat). La page choisit quoi dire.
  message?: ReactNode
  // A mettre en ref sur la zone des cartes : donne par utiliserCartesParPage
  refZone: (element: HTMLDivElement | null) => void
  onChoisir: (id: string) => void
  onChangerTri: (tri: TriAvis, ordre: OrdreTri) => void
  onChangerPage: (page: number) => void
}

export function ListeCartesAvis({
  avis,
  pagination,
  tri,
  ordre,
  avisChoisi,
  enChargement,
  message,
  refZone,
  onChoisir,
  onChangerTri,
  onChangerPage,
}: Proprietes) {
  const { t } = utiliserLangue()

  return (
    <section className="avis-liste" aria-label={t('avis.tableau.navigation')}>
      <div className="avis-liste-tete">
        <p aria-live="polite" className="m-0">
          {pagination !== null ? t('avis.liste.resultats', { total: pagination.total }) : null}
        </p>
        <TriListe tri={tri} ordre={ordre} onChangerTri={onChangerTri} />
      </div>

      <div
        ref={refZone}
        aria-busy={enChargement}
        className={`avis-liste-zone transition-opacity ${enChargement ? 'opacity-60' : ''}`}
      >
        {avis.length > 0 ? (
          <ul className="avis-cartes">
            {avis.map((unAvis) => (
              <CarteAvis
                key={unAvis.id}
                avis={unAvis}
                choisie={unAvis.id === avisChoisi}
                onChoisir={onChoisir}
              />
            ))}
          </ul>
        ) : message !== undefined ? (
          <div className="avis-vide">{message}</div>
        ) : null}
      </div>

      <PaginationBulles pagination={pagination} onChangerPage={onChangerPage} />
    </section>
  )
}