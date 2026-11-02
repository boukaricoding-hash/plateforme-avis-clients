import { useMemo, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'
import { BarreFiltresAvis } from '../../composants-avis/barre-filtres-avis'
import { DetailAvis } from '../../composants-avis/detail-avis'
import { ListeCartesAvis } from '../../composants-avis/liste-cartes-avis'
import { utiliserCartesParPage } from '../../hooks/utiliser-cartes-par-page'
import { utiliserFiltresAvis } from '../../hooks/utiliser-filtres-avis'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserListeAvis } from '../../hooks/utiliser-liste-avis'
import type { OrdreTri, TriAvis } from '../../types/avis'
import '../../styles/avis.css'

// Page des avis (jour 15 design) : ecrans E8 et E9 reunis en une seule page, a l'adresse /avis
// et /avis/:id (le clic sur un avis recent de l'accueil arrive avec l'avis deja choisi).
// Les filtres, le tri et la page sont dans l'adresse (utiliserFiltresAvis) : un clic de l'accueil
// arrive deja filtre.
// Cette page assemble les pieces : barre de filtres en haut, liste des avis a gauche,
// detail de l'avis choisi a droite. Elle charge la liste et choisit l'avis ; le detail charge
// lui-meme sa fiche (composant DetailAvis).
// Sur grand ecran la page ne defile pas : le nombre de cartes par page vient de la hauteur
// disponible (utiliserCartesParPage) et part dans la limite envoyee a l'API.

export function PageListeAvis() {
  const { t } = utiliserLangue()
  const { id: idAdresse } = useParams()
  const [parametresAdresse] = useSearchParams()
  const { filtres, nombreFiltresActifs, changerFiltres, reinitialiserFiltres } =
    utiliserFiltresAvis()
  const { refZone, cartesParPage } = utiliserCartesParPage()

  // Avis choisi par un clic sur une carte. Tant qu'on n'a pas clique, c'est celui de l'adresse.
  const [idClique, setIdClique] = useState<string | null>(null)
  const avisChoisi = idClique ?? idAdresse ?? null

  // La limite s'ajoute aux filtres de l'adresse. L'objet ne change que si les filtres ou le
  // nombre de cartes changent : sinon la liste serait rechargee a chaque affichage.
  const filtresAvecLimite = useMemo(
    () => ({ ...filtres, limite: cartesParPage ?? filtres.limite }),
    [filtres, cartesParPage],
  )
  // En ecran fixe, rien n'est charge tant que la zone des cartes n'est pas mesuree.
  const { reponse, chargementInitial, chargementEnCours, erreur, recharger } = utiliserListeAvis(
    filtresAvecLimite,
    cartesParPage !== null,
  )

  // Le hook donne toujours un tri, un ordre et une page : les valeurs de secours sont seulement
  // pour le typage (ces trois champs sont facultatifs dans les parametres de l'API).
  const tri: TriAvis = filtres.tri ?? 'soumis_le'
  const ordre: OrdreTri = filtres.ordre ?? 'desc'
  const pageDemandee = filtres.page ?? 1

  // Page trop grande (adresse tapee a la main, avis supprimes, ou fenetre agrandie : plus de
  // cartes par page donc moins de pages) : la reponse est vide alors qu'il y a des avis.
  // On remplace l'adresse par celle de la derniere page.
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

  // Ce que la liste montre a la place des cartes : erreur, chargement ou aucun resultat.
  let message = null
  if (erreur !== null) {
    message = (
      <div role="alert" className="space-y-3">
        <p className="m-0 text-erreur">
          {erreur.statut === 0 ? t('commun.erreurReseau') : t('avis.liste.erreur')}
        </p>
        <button
          type="button"
          onClick={recharger}
          disabled={chargementEnCours}
          className="avis-bouton-principal"
        >
          {chargementEnCours ? t('tableau.actualisationEnCours') : t('commun.reessayer')}
        </button>
      </div>
    )
  } else if (chargementInitial) {
    message = (
      <p role="status" className="m-0">
        {t('avis.liste.chargement')}
      </p>
    )
  } else if (reponse !== null && reponse.avis.length === 0) {
    message = <p className="m-0">{t('avis.liste.aucunAvis')}</p>
  }

  return (
    <div className="avis-ecran">
      <h1 className="sr-only">{t('avis.liste.titre')}</h1>

      {/* Les filtres restent utilisables meme avant la premiere reponse ou apres une erreur */}
      <BarreFiltresAvis
        filtres={filtres}
        nombreFiltresActifs={nombreFiltresActifs}
        onChanger={changerFiltres}
        onReinitialiser={reinitialiserFiltres}
        onActualiser={recharger}
        actualisationEnCours={chargementEnCours}
      />

      <div className="avis-corps">
        <ListeCartesAvis
          avis={reponse?.avis ?? []}
          pagination={reponse?.pagination ?? null}
          tri={tri}
          ordre={ordre}
          avisChoisi={avisChoisi}
          enChargement={chargementEnCours}
          message={message}
          refZone={refZone}
          onChoisir={setIdClique}
          onChangerTri={(nouveauTri, nouvelOrdre) =>
            changerFiltres({ tri: nouveauTri, ordre: nouvelOrdre })
          }
          onChangerPage={(page) => changerFiltres({ page })}
        />
        <DetailAvis id={avisChoisi} onStatutChange={recharger} />
      </div>
    </div>
  )
}