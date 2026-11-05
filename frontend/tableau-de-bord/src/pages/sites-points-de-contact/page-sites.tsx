import { useId, useState } from 'react'
import { Navigate } from 'react-router'
import { CreationMasse } from '../../composants-sites/creation-masse'
import { FormulaireSite } from '../../composants-sites/formulaire-site'
import { ListePoints } from '../../composants-sites/liste-points'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserSitesPoints } from '../../hooks/utiliser-sites-points'
import type { ErreurService } from '../../services/api'

// Ecran E12 : sites et points de contact (jour 17).
// - Le Responsable cree et modifie ses sites, active ou desactive un site, cree ses tables en masse
//   et regle le questionnaire de chaque point.
// - Le Gestionnaire voit seulement les sites de son perimetre, en lecture seule.
// - L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// La page n'appelle pas l'API : tout vient de utiliserSitesPoints. Chaque bloc a son propre
// chargement et sa propre erreur, avec un bouton "Reessayer".

type PropsEchec = {
  erreur: ErreurService
  cleGenerale: string
  surReessayer: () => void
}

// Echec d'un chargement : pas de reseau (statut 0) ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, cleGenerale, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  return (
    <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
      <p role="alert" className="m-0 text-sm text-erreur">
        {erreur.statut === 0 ? t('commun.erreurReseau') : t(cleGenerale)}
      </p>
      <button
        type="button"
        onClick={surReessayer}
        className="mt-3 min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond"
      >
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

// Ce que montre le bloc du site : rien, le formulaire de creation ou celui de modification.
type Formulaire = 'aucun' | 'creation' | 'modification'

type PropsCoordonnee = {
  libelle: string
  valeur: string | null
}

// Une coordonnee du site : libelle et valeur, ou "Non renseigné" si l'API envoie null.
function Coordonnee({ libelle, valeur }: PropsCoordonnee) {
  const { t } = utiliserLangue()

  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-texte-secondaire">{libelle}</dt>
      <dd className="m-0 text-sm text-texte">{valeur ?? t('sites.nonRenseigne')}</dd>
    </div>
  )
}

export function PageSites() {
  const { t } = utiliserLangue()
  const idChoixSite = useId()
  const {
    acces,
    peutModifier,
    sites,
    chargementSites,
    erreurSites,
    siteChoisi,
    choisirSite,
    points,
    chargementPoints,
    erreurPoints,
    questionnaires,
    erreurQuestionnaires,
    recharger,
    actionsSites,
    actionsPoints,
    masse,
  } = utiliserSitesPoints()

  const [formulaire, setFormulaire] = useState<Formulaire>('aucun')

  // L'administrateur DTS n'a pas d'organisation : rien a gerer ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  function fermerFormulaire(): void {
    setFormulaire('aucun')
  }

  // Message d'echec de l'activation ou de la desactivation du site (hors formulaire ouvert).
  let messageStatut: string | null = null
  if (formulaire === 'aucun' && actionsSites.erreur !== null) {
    if (actionsSites.erreur.statut === 0) {
      messageStatut = t('commun.erreurReseau')
    } else if (actionsSites.erreur.statut === 403) {
      messageStatut = t('sites.erreurDroits')
    } else {
      messageStatut = t('sites.erreurStatut')
    }
  }

  const aucunSite = sites !== null && sites.length === 0

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header>
        <h1 className="font-titre text-2xl font-bold text-texte">{t('sites.titre')}</h1>
        <p className="mt-1 text-texte-secondaire">
          {peutModifier ? t('sites.sousTitre') : t('sites.sousTitreGestionnaire')}
        </p>
      </header>

      {chargementSites && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('sites.chargement')}
        </p>
      )}
      {erreurSites !== null && sites === null && (
        <BlocEchec erreur={erreurSites} cleGenerale="sites.erreur" surReessayer={recharger} />
      )}

      {/* Aucun site : le Responsable cree le premier, le Gestionnaire attend qu'on lui en donne un */}
      {aucunSite && !peutModifier && (
        <p className="m-0 rounded-lg border border-bordure bg-surface p-5 text-sm text-texte-secondaire shadow-doux">
          {t('sites.aucunSite')}
        </p>
      )}
      {aucunSite && peutModifier && (
        <>
          <p className="m-0 text-sm text-texte-secondaire">{t('sites.aucunSiteResponsable')}</p>
          <FormulaireSite site={null} actions={actionsSites} surFermer={fermerFormulaire} />
        </>
      )}

      {sites !== null && sites.length > 0 && siteChoisi !== null && (
        <>
          {/* Choix du site et ses coordonnees */}
          <section
            aria-label={t('sites.choisirSite')}
            className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={idChoixSite} className="text-sm font-semibold text-texte">
                  {t('sites.choisirSite')}
                </label>
                <select
                  id={idChoixSite}
                  value={siteChoisi.id}
                  onChange={(evenement) => {
                    setFormulaire('aucun')
                    choisirSite(evenement.target.value)
                  }}
                  className="min-h-11 w-full min-w-56 rounded-md border border-bordure-champ bg-fond px-2 text-sm text-texte"
                >
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.actif ? site.nom : `${site.nom} (${t('sites.statutInactif')})`}
                    </option>
                  ))}
                </select>
              </div>

              {peutModifier && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormulaire('creation')}
                    className="min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond"
                  >
                    {t('sites.nouveauSite')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaire('modification')}
                    className="min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond"
                  >
                    {t('sites.modifierSite')}
                  </button>
                  <button
                    type="button"
                    disabled={actionsSites.enCours}
                    aria-busy={actionsSites.enCours}
                    onClick={() =>
                      void actionsSites.changerStatut(siteChoisi.id, !siteChoisi.actif)
                    }
                    className="min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {siteChoisi.actif ? t('sites.desactiver') : t('sites.activer')}
                  </button>
                </div>
              )}
            </div>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Coordonnee libelle={t('sites.adresse')} valeur={siteChoisi.adresse} />
              <Coordonnee libelle={t('sites.ville')} valeur={siteChoisi.ville} />
              <Coordonnee libelle={t('sites.telephone')} valeur={siteChoisi.telephone} />
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold text-texte-secondaire">{t('sites.statut')}</dt>
                <dd
                  className={`m-0 text-sm font-semibold ${
                    siteChoisi.actif ? 'text-succes' : 'text-texte-secondaire'
                  }`}
                >
                  {siteChoisi.actif ? t('sites.statutActif') : t('sites.statutInactif')}
                </dd>
              </div>
            </dl>

            <p role="status" className="m-0 mt-3 min-h-5 text-sm text-succes">
              {formulaire === 'aucun' && actionsSites.succes ? t('sites.statutEnregistre') : ''}
            </p>
            {messageStatut !== null && (
              <p role="alert" className="m-0 mt-1 text-sm text-erreur">
                {messageStatut}
              </p>
            )}
          </section>

          {/* Formulaire de creation ou de modification : Responsable seulement */}
          {peutModifier && formulaire === 'creation' && (
            <FormulaireSite
              key="nouveau"
              site={null}
              actions={actionsSites}
              surFermer={fermerFormulaire}
            />
          )}
          {peutModifier && formulaire === 'modification' && (
            <FormulaireSite
              key={siteChoisi.id}
              site={siteChoisi}
              actions={actionsSites}
              surFermer={fermerFormulaire}
            />
          )}

          {/* Points de contact du site choisi */}
          {chargementPoints && (
            <p role="status" className="m-0 text-sm text-texte-secondaire">
              {t('sites.chargementPoints')}
            </p>
          )}
          {erreurPoints !== null && points === null && (
            <BlocEchec
              erreur={erreurPoints}
              cleGenerale="sites.erreurPoints"
              surReessayer={recharger}
            />
          )}
          {points !== null && (
            <ListePoints
              points={points}
              questionnaires={questionnaires}
              erreurQuestionnaires={erreurQuestionnaires}
              peutModifier={peutModifier}
              actions={actionsPoints}
            />
          )}

          {/* Creation en masse : Responsable seulement, on repart de zero a chaque site */}
          {peutModifier && (
            <CreationMasse
              key={siteChoisi.id}
              siteId={siteChoisi.id}
              questionnaires={questionnaires}
              masse={masse}
            />
          )}
        </>
      )}
    </div>
  )
}