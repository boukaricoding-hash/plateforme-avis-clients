import { useId, useState } from 'react'
import { Navigate } from 'react-router'
import { CreationMasse } from '../../composants-sites/creation-masse'
import { FormulaireSite } from '../../composants-sites/formulaire-site'
import { ListePoints } from '../../composants-sites/liste-points'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserSitesPoints } from '../../hooks/utiliser-sites-points'
import type { ErreurService } from '../../services/api'
import '../../styles/sites.css'

// Ecran E12 : sites et points de contact (jour 17, design).
// - Le Responsable cree et modifie ses sites, active ou desactive un site, cree ses tables en masse
//   et regle le questionnaire de chaque point.
// - Le Gestionnaire voit seulement les sites de son perimetre, en lecture seule.
// - L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// La page n'appelle pas l'API : tout vient de utiliserSitesPoints. Chaque bloc a son propre
// chargement et sa propre erreur, avec un bouton "Reessayer".
// Design (styles/sites.css) : ni tableau ni cadres, des traits de 1 px tres fins.
// - Ordinateur : la page ne defile pas, le contenu est centre. A gauche le site (choix,
//   coordonnees, actions), a droite les points de contact. Quand un formulaire est ouvert,
//   il prend toute la colonne de gauche (le choix du site et les actions se cachent).
// - Telephone : tout est l'un sous l'autre et la page defile.

type PropsEchec = {
  erreur: ErreurService
  cleGenerale: string
  surReessayer: () => void
}

// Echec d'un chargement : pas de reseau (statut 0) ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, cleGenerale, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  return (
    <div className="flex flex-col items-start gap-1">
      <p role="alert" className="m-0 text-sm text-erreur">
        {erreur.statut === 0 ? t('commun.erreurReseau') : t(cleGenerale)}
      </p>
      <button type="button" onClick={surReessayer} className="sites-bouton">
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

// Ce que montre la colonne du site : les coordonnees, le formulaire de creation,
// celui de modification ou la creation de points en masse (un seul a la fois).
type Formulaire = 'aucun' | 'creation' | 'modification' | 'masse'

type PropsCoordonnee = {
  libelle: string
  valeur: string | null
}

// Une coordonnee du site : libelle et valeur, ou "Non renseigné" si l'API envoie null.
function Coordonnee({ libelle, valeur }: PropsCoordonnee) {
  const { t } = utiliserLangue()

  return (
    <div className="sites-coordonnee">
      <dt>{libelle}</dt>
      <dd>{valeur ?? t('sites.nonRenseigne')}</dd>
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
    <div className="sites-ecran">
      <div className="sites-contenu">
        <header className="sites-tete">
          <div>
            <h1 className="font-titre text-2xl font-bold text-texte">{t('sites.titre')}</h1>
            <p className="mt-1 text-texte-secondaire">
              {peutModifier ? t('sites.sousTitre') : t('sites.sousTitreGestionnaire')}
            </p>
          </div>
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
          <p className="m-0 text-sm text-texte-secondaire">{t('sites.aucunSite')}</p>
        )}
        {aucunSite && peutModifier && (
          <>
            <p className="m-0 text-sm text-texte-secondaire">{t('sites.aucunSiteResponsable')}</p>
            <FormulaireSite site={null} actions={actionsSites} surFermer={fermerFormulaire} />
          </>
        )}

        {sites !== null && sites.length > 0 && siteChoisi !== null && (
          <div className="sites-corps">
            {/* Colonne du site : choix, actions, coordonnees ou formulaire */}
            <section
              aria-label={t('sites.choisirSite')}
              className={`sites-colonne ${formulaire !== 'aucun' ? 'sites-colonne--formulaire' : ''}`}
            >
              <div className="sites-champ">
                <label htmlFor={idChoixSite}>{t('sites.choisirSite')}</label>
                <select
                  id={idChoixSite}
                  value={siteChoisi.id}
                  onChange={(evenement) => {
                    setFormulaire('aucun')
                    choisirSite(evenement.target.value)
                  }}
                >
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.actif ? site.nom : `${site.nom} (${t('sites.statutInactif')})`}
                    </option>
                  ))}
                </select>
              </div>

              {peutModifier && (
                <div className="sites-actions">
                  <button
                    type="button"
                    onClick={() => setFormulaire('creation')}
                    className="sites-bouton"
                  >
                    {t('sites.nouveauSite')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaire('modification')}
                    className="sites-bouton"
                  >
                    {t('sites.modifierSite')}
                  </button>
                  <button
                    type="button"
                    disabled={actionsSites.enCours}
                    aria-busy={actionsSites.enCours}
                    onClick={() => void actionsSites.changerStatut(siteChoisi.id, !siteChoisi.actif)}
                    className="sites-bouton"
                  >
                    {siteChoisi.actif ? t('sites.desactiver') : t('sites.activer')}
                  </button>
                  <button
                    type="button"
                    aria-expanded={formulaire === 'masse'}
                    onClick={() => setFormulaire(formulaire === 'masse' ? 'aucun' : 'masse')}
                    className="sites-bouton"
                  >
                    {t('sites.masse.titre')}
                  </button>
                </div>
              )}

              {/* Les coordonnees laissent la place au formulaire quand il est ouvert */}
              {formulaire === 'aucun' && (
                <dl className="sites-coordonnees">
                  <Coordonnee libelle={t('sites.adresse')} valeur={siteChoisi.adresse} />
                  <Coordonnee libelle={t('sites.ville')} valeur={siteChoisi.ville} />
                  <Coordonnee libelle={t('sites.telephone')} valeur={siteChoisi.telephone} />
                  <div className="sites-coordonnee">
                    <dt>{t('sites.statut')}</dt>
                    <dd
                      className={`sites-statut ${siteChoisi.actif ? 'sites-statut--actif' : ''}`}
                    >
                      {siteChoisi.actif ? t('sites.statutActif') : t('sites.statutInactif')}
                    </dd>
                  </div>
                </dl>
              )}

              <p role="status" className="sites-message sites-message--succes">
                {formulaire === 'aucun' && actionsSites.succes ? t('sites.statutEnregistre') : ''}
              </p>
              {messageStatut !== null && (
                <p role="alert" className="sites-message sites-message--erreur">
                  {messageStatut}
                </p>
              )}

              {/* Formulaires : Responsable seulement */}
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

              {/* Creation en masse : Responsable seulement, on repart de zero a chaque site */}
              {peutModifier && formulaire === 'masse' && (
                <CreationMasse
                  key={siteChoisi.id}
                  siteId={siteChoisi.id}
                  questionnaires={questionnaires}
                  masse={masse}
                  surFermer={fermerFormulaire}
                />
              )}
            </section>

            {/* Points de contact du site choisi */}
            <div className="sites-droite">
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
