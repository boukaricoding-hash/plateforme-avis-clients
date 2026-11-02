import { useRef } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { BarreFiltresAvis } from '../../composants-avis/barre-filtres-avis'
import { TableauAvis } from '../../composants-avis/tableau-avis'
import { utiliserFiltresAvis } from '../../hooks/utiliser-filtres-avis'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserListeAvis } from '../../hooks/utiliser-liste-avis'
import type { OrdreTri, TriAvis } from '../../types/avis'

// Ecran E8 : la liste des avis (jour 15), a l'adresse /avis.
// Les filtres, le tri et la page sont dans l'adresse (utiliserFiltresAvis) : un clic de l'accueil
// arrive deja filtre, et la fiche d'un avis sait revenir a la meme liste.
// Cet ecran assemble les pieces : barre de filtres, chargement, tableau, messages d'etat.

export function PageListeAvis() {
  const { t } = utiliserLangue()
  const [parametresAdresse] = useSearchParams()
  const { filtres, nombreFiltresActifs, changerFiltres, reinitialiserFiltres } =
    utiliserFiltresAvis()
  const { reponse, chargementInitial, chargementEnCours, erreur, recharger } =
    utiliserListeAvis(filtres)
  const refTitre = useRef<HTMLHeadingElement>(null)

  // Le hook donne toujours un tri, un ordre et une page : les valeurs de secours sont seulement
  // pour le typage (ces trois champs sont facultatifs dans les parametres de l'API).
  const tri: TriAvis = filtres.tri ?? 'soumis_le'
  const ordre: OrdreTri = filtres.ordre ?? 'desc'
  const pageDemandee = filtres.page ?? 1

  // Page trop grande (adresse tapee a la main, ou avis supprimes entre-temps) : la reponse est
  // vide alors qu'il y a des avis. On remplace l'adresse par celle de la derniere page.
  // Seulement une fois le chargement termine, pour ne pas reagir a une ancienne reponse.
  if (
    !chargementEnCours &&
    reponse !== null &&
    reponse.avis.length === 0 &&
    reponse.pagination.total > 0 &&
    pageDemandee > 1
  ) {
    const adresse = new URLSearchParams(parametresAdresse)
    if (reponse.pagination.pages > 1) {
      adresse.set('page', String(reponse.pagination.pages))
    } else {
      adresse.delete('page')
    }
    return <Navigate to={{ search: `?${adresse.toString()}` }} replace />
  }

  function changerPage(page: number): void {
    changerFiltres({ page })
    // Le tableau est long : on remonte en haut de la liste pour voir les nouveaux avis.
    refTitre.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 ref={refTitre} className="font-titre text-2xl font-bold text-texte">
            {t('avis.liste.titre')}
          </h1>
          {reponse !== null && (
            <p aria-live="polite" className="mt-1 text-sm text-texte-secondaire">
              {t('avis.liste.resultats', { total: reponse.pagination.total })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={recharger}
          disabled={chargementEnCours}
          className="min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-medium text-texte transition-colors hover:bg-fond-alt disabled:cursor-not-allowed disabled:opacity-50"
        >
          {chargementEnCours ? t('tableau.actualisationEnCours') : t('tableau.actualiser')}
        </button>
      </div>

      {/* Les filtres restent utilisables meme avant la premiere reponse ou apres une erreur */}
      <BarreFiltresAvis
        filtres={filtres}
        nombreFiltresActifs={nombreFiltresActifs}
        onChanger={changerFiltres}
        onReinitialiser={reinitialiserFiltres}
      />

      {chargementInitial && (
        <p role="status" className="text-texte-secondaire">
          {t('avis.liste.chargement')}
        </p>
      )}

      {erreur !== null && (
        <div role="alert" className="space-y-3 rounded-lg bg-surface/50 p-5">
          <p className="text-erreur">
            {erreur.statut === 0 ? t('commun.erreurReseau') : t('avis.liste.erreur')}
          </p>
          <button
            type="button"
            onClick={recharger}
            disabled={chargementEnCours}
            className="min-h-11 rounded-md bg-principale px-4 text-sm font-medium text-texte-sur-principale transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('commun.reessayer')}
          </button>
        </div>
      )}

      {reponse !== null && reponse.avis.length === 0 && (
        <p className="rounded-lg bg-surface/50 p-5 text-texte-secondaire">
          {t('avis.liste.aucunAvis')}
        </p>
      )}

      {reponse !== null && reponse.avis.length > 0 && (
        <TableauAvis
          avis={reponse.avis}
          pagination={reponse.pagination}
          tri={tri}
          ordre={ordre}
          enChargement={chargementEnCours}
          onChangerTri={(nouveauTri, nouvelOrdre) =>
            changerFiltres({ tri: nouveauTri, ordre: nouvelOrdre })
          }
          onChangerPage={changerPage}
        />
      )}
    </div>
  )
}