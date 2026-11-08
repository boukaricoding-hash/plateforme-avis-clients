import { useId, useState } from 'react'
import { Navigate } from 'react-router'
import { CalqueSites } from '../../composants-sites/calque-sites'
import { CreationMasse } from '../../composants-sites/creation-masse'
import { FormulaireSite } from '../../composants-sites/formulaire-site'
import { ListePoints } from '../../composants-sites/liste-points'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserSitesPoints } from '../../hooks/utiliser-sites-points'
import type { ErreurService } from '../../services/api'
import '../../styles/sites.css'
import type { PointContact } from '../../types/sites-points'

// Ecran E12 : sites et points de contact (jour 17, design Premium).
// - Le Responsable cree et modifie ses sites, active ou desactive un site, cree ses tables
//   (une par une ou en masse) et regle le questionnaire de chaque point.
// - Le Gestionnaire voit seulement les sites de son perimetre, en lecture seule.
// - L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// La page n'appelle pas l'API : tout vient de utiliserSitesPoints. Chaque bloc a son propre
// chargement et sa propre erreur, avec un bouton "Reessayer".
// Design (styles/sites.css, maquette Premium) : en haut le choix du site et ses boutons, puis le
// titre et les coordonnees, la recherche, et la rangee de cartes des points de contact.
// Un seul panneau est ouvert a la fois : nouveau site, gerer le site (modifier, activer ou
// desactiver), creer en masse ou ajouter une table. Il s'ouvre dans un tiroir qui glisse de la
// droite vers la gauche (CalqueSites), au-dessus de la page, et non dans la page.
// La page defile normalement si l'ecran est trop bas.

type PropsEchec = {
  erreur: ErreurService
  cleGenerale: string
  surReessayer: () => void
}

// Echec d'un chargement : pas de reseau (statut 0) ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, cleGenerale, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="m-0 text-sm text-erreur">
        {erreur.statut === 0 ? t('commun.erreurReseau') : t(cleGenerale)}
      </p>
      <button type="button" onClick={surReessayer} className="sites-bouton">
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

// Le panneau ouvert dans le tiroir (un seul a la fois, ou aucun).
type Formulaire = 'aucun' | 'creation' | 'modification' | 'masse' | 'ajout'

// Une coordonnee n'est affichee que si elle est renseignee.
function nonVide(valeur: string | null): valeur is string {
  return valeur !== null && valeur.trim() !== ''
}

// Numero de la prochaine table : un de plus que le plus grand numero des tables existantes
// ("Table 12" donne 12). Le mot "Table" est le meme que le prefixe de creation-masse.tsx.
function prochainNumeroTable(points: PointContact[] | null): number {
  let dernier = 0
  for (const point of points ?? []) {
    const numero = /^table\s*(\d+)$/i.exec(point.nom.trim())?.[1]
    if (numero !== undefined) {
      dernier = Math.max(dernier, Number(numero))
    }
  }
  return dernier + 1
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
  const [recherche, setRecherche] = useState('')
  // Le message sur l'activation du site ne s'affiche qu'apres un clic sur ce bouton-la.
  const [statutTente, setStatutTente] = useState(false)

  // L'administrateur DTS n'a pas d'organisation : rien a gerer ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  function fermerFormulaire(): void {
    setFormulaire('aucun')
  }

  // Un clic sur le bouton d'un panneau ouvert le ferme ; sinon il remplace le panneau ouvert.
  function basculer(cible: Formulaire): void {
    setStatutTente(false)
    setFormulaire(formulaire === cible ? 'aucun' : cible)
  }

  // Nom du tiroir ouvert, lu par les lecteurs d'ecran.
  function libelleTiroir(): string {
    switch (formulaire) {
      case 'creation':
        return t('sites.nouveauSite')
      case 'modification':
        return t('sites.gererSite')
      case 'masse':
        return t('sites.creerEnMasse')
      default:
        return t('sites.ajouterTable')
    }
  }

  // Message d'echec de l'activation ou de la desactivation du site.
  let messageStatut: string | null = null
  if (statutTente && actionsSites.erreur !== null) {
    if (actionsSites.erreur.statut === 0) {
      messageStatut = t('commun.erreurReseau')
    } else if (actionsSites.erreur.statut === 403) {
      messageStatut = t('sites.erreurDroits')
    } else {
      messageStatut = t('sites.erreurStatut')
    }
  }

  const aucunSite = sites !== null && sites.length === 0
  const site = sites !== null && sites.length > 0 ? siteChoisi : null

  // Coordonnees du site : adresse et ville ensemble, puis le telephone.
  const adresseVille = site !== null ? [site.adresse, site.ville].filter(nonVide).join(', ') : ''
  const telephone = site !== null && nonVide(site.telephone) ? site.telephone : ''

  return (
    <div className="sites-ecran">
      {/* Haut de page : choix du site et ses boutons */}
      {site !== null && sites !== null && (
        <div className="sites-haut">
          <div className="sites-choix">
            <label htmlFor={idChoixSite} className="sr-only">
              {t('sites.choisirSite')}
            </label>
            <select
              id={idChoixSite}
              value={site.id}
              onChange={(evenement) => {
                setFormulaire('aucun')
                setStatutTente(false)
                setRecherche('')
                choisirSite(evenement.target.value)
              }}
            >
              {sites.map((element) => (
                <option key={element.id} value={element.id}>
                  {element.actif ? element.nom : `${element.nom} (${t('sites.statutInactif')})`}
                </option>
              ))}
            </select>
          </div>

          {peutModifier && (
            <div className="sites-groupe">
              <button
                type="button"
                aria-expanded={formulaire === 'modification'}
                onClick={() => basculer('modification')}
                className="sites-bouton"
              >
                {t('sites.gererSite')}
              </button>
              <button
                type="button"
                aria-expanded={formulaire === 'creation'}
                onClick={() => basculer('creation')}
                className="sites-bouton sites-bouton--plein"
              >
                {t('sites.nouveauSite')}
              </button>
            </div>
          )}
        </div>
      )}

      <h1 className="sites-titre" style={site === null ? { marginTop: 0 } : undefined}>
        {t('sites.titre')}
      </h1>
      <p className="sites-sous">
        {peutModifier ? t('sites.sousTitre') : t('sites.sousTitreGestionnaire')}
      </p>

      {site !== null && (
        <div className="sites-infos">
          <span>
            <span className="sr-only">{t('sites.adresse')} : </span>
            {adresseVille !== '' ? adresseVille : t('sites.nonRenseigne')}
          </span>
          {telephone !== '' && (
            <span>
              <span className="sr-only">{t('sites.telephone')} : </span>
              {telephone}
            </span>
          )}
          <span className={`sites-statut ${site.actif ? 'sites-statut--actif' : ''}`}>
            {site.actif ? t('sites.statutActif') : t('sites.statutInactif')}
          </span>
        </div>
      )}

      {chargementSites && (
        <p role="status" className="sites-vide" style={{ marginTop: 32 }}>
          {t('sites.chargement')}
        </p>
      )}
      {erreurSites !== null && sites === null && (
        <div style={{ marginTop: 32 }}>
          <BlocEchec erreur={erreurSites} cleGenerale="sites.erreur" surReessayer={recharger} />
        </div>
      )}

      {/* Aucun site : le Responsable cree le premier, le Gestionnaire attend qu'on lui en donne un */}
      {aucunSite && !peutModifier && (
        <p className="sites-vide" style={{ marginTop: 32 }}>
          {t('sites.aucunSite')}
        </p>
      )}
      {aucunSite && peutModifier && (
        <>
          <p className="sites-vide" style={{ margin: '32px 0 24px' }}>
            {t('sites.aucunSiteResponsable')}
          </p>
          <div className="sites-panneau">
            <FormulaireSite site={null} actions={actionsSites} surFermer={fermerFormulaire} />
          </div>
        </>
      )}

      {site !== null && (
        <>
          {/* Barre d'actions : recherche d'un point, creation de tables */}
          <div className="sites-barre">
            <div className="sites-recherche">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={recherche}
                placeholder={t('sites.rechercher')}
                aria-label={t('sites.rechercher')}
                onChange={(evenement) => setRecherche(evenement.target.value)}
              />
            </div>

            {peutModifier && (
              <div className="sites-groupe">
                <button
                  type="button"
                  aria-expanded={formulaire === 'masse'}
                  onClick={() => basculer('masse')}
                  className="sites-bouton"
                >
                  {t('sites.creerEnMasse')}
                </button>
                <button
                  type="button"
                  aria-expanded={formulaire === 'ajout'}
                  onClick={() => basculer('ajout')}
                  className="sites-bouton sites-bouton--plein"
                >
                  {t('sites.ajouterTable')}
                </button>
              </div>
            )}
          </div>

          {/* Tiroir ouvert : Responsable seulement, on repart de zero a chaque site */}
          {peutModifier && formulaire !== 'aucun' && (
            <CalqueSites forme="tiroir" libelle={libelleTiroir()} surFermer={fermerFormulaire}>
              {formulaire === 'creation' && (
                <FormulaireSite
                  key="nouveau"
                  site={null}
                  actions={actionsSites}
                  surFermer={fermerFormulaire}
                />
              )}

              {formulaire === 'modification' && (
                <>
                  <FormulaireSite
                    key={site.id}
                    site={site}
                    actions={actionsSites}
                    surFermer={fermerFormulaire}
                  />
                  <div className="sites-panneau-pied">
                    <button
                      type="button"
                      disabled={actionsSites.enCours}
                      aria-busy={actionsSites.enCours}
                      onClick={() => {
                        setStatutTente(true)
                        void actionsSites.changerStatut(site.id, !site.actif)
                      }}
                      className="sites-bouton"
                    >
                      {site.actif ? t('sites.desactiver') : t('sites.activer')}
                    </button>
                    <p role="status" className="sites-message sites-message--succes">
                      {statutTente && actionsSites.succes ? t('sites.statutEnregistre') : ''}
                    </p>
                    {messageStatut !== null && (
                      <p role="alert" className="sites-message sites-message--erreur">
                        {messageStatut}
                      </p>
                    )}
                  </div>
                </>
              )}

              {formulaire === 'masse' && (
                <CreationMasse
                  key={`${site.id}-masse`}
                  siteId={site.id}
                  questionnaires={questionnaires}
                  masse={masse}
                  surFermer={fermerFormulaire}
                />
              )}

              {formulaire === 'ajout' && (
                <CreationMasse
                  key={`${site.id}-ajout`}
                  siteId={site.id}
                  questionnaires={questionnaires}
                  masse={masse}
                  surFermer={fermerFormulaire}
                  numeroInitial={prochainNumeroTable(points)}
                />
              )}
            </CalqueSites>
          )}

          {/* Points de contact du site choisi */}
          {chargementPoints && (
            <p role="status" className="sites-vide">
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
              recherche={recherche}
            />
          )}
        </>
      )}
    </div>
  )
}