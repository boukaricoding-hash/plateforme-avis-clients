import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserPages } from '../hooks/utiliser-pages'
import type { ActionsPoints } from '../hooks/utiliser-sites-points'
import type { ErreurService } from '../services/api'
import '../styles/sites.css'
import type { TexteMultilingue } from '../types/avis'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import { TYPES_POINT_CONTACT, type PointContact } from '../types/sites-points'

// Liste des points de contact du site choisi (ecran E12, design).
// Plus de tableau : sur ordinateur, des lignes separees par un trait fin ; sur telephone, une
// grande carte par point qu'on fait glisser de gauche a droite (styles/sites.css).
// Pour chaque point : nom, type, zone, questionnaire associe, statut.
// Le Responsable peut changer le nom, le questionnaire et activer ou desactiver le point ;
// le Gestionnaire lit seulement (aucun bouton, le serveur refuse ses ecritures de toute facon).
// Ce composant n'appelle pas l'API : les actions viennent de utiliserSitesPoints.
// Le code public d'un point n'est jamais affiche ici : seul le QR (ecran E11) le contient.
// Ecran fixe : la page ne defile pas, les points sont donc coupes en pages (utiliserPages).
// Telephone : tous les points sont dans la meme rangee de cartes.

type Proprietes = {
  points: PointContact[]
  // null tant que les questionnaires ne sont pas charges.
  questionnaires: ResumeQuestionnaire[] | null
  erreurQuestionnaires: ErreurService | null
  peutModifier: boolean
  actions: ActionsPoints
}

// Longueur maximale du nom reprise du backend ; le serveur refait toujours la verification.
const LONGUEUR_NOM = 120

// Hauteur d'une ligne en ecran fixe : 44 px de controle + 2 x 6 px de marge + 1 px de trait.
// A garder egale a styles/sites.css (.sites-point).
const HAUTEUR_LIGNE = 57
// Hauteur de la ligne de libelles : 18 px de texte + 6 px de marge + 1 px de trait.
const HAUTEUR_ENTETE = 25
// Doit rester egale a la requete de l'ecran fixe dans styles/sites.css
const REQUETE_ECRAN_FIXE = '(min-width: 900px) and (min-height: 480px)'

// Titre dans la langue choisie, sinon en francais (l'anglais est facultatif).
function titreDans(titre: TexteMultilingue, langue: string): string {
  return (langue === 'en' ? titre.en : null) ?? titre.fr
}

type ProprietesLigne = {
  point: PointContact
  questionnaires: ResumeQuestionnaire[] | null
  peutModifier: boolean
  actions: ActionsPoints
}

// Un point de contact, avec son propre etat de modification du nom.
function LignePoint({ point, questionnaires, peutModifier, actions }: ProprietesLigne) {
  const { t, langue } = utiliserLangue()
  const idNom = useId()
  const idQuestionnaire = useId()

  const [enEdition, setEnEdition] = useState(false)
  const [nom, setNom] = useState(point.nom)
  const [tentative, setTentative] = useState(false)

  const nomPropre = nom.trim()
  const erreurNom = tentative && nomPropre === '' ? t('sites.liste.nomObligatoire') : null

  const libelleType = (TYPES_POINT_CONTACT as readonly string[]).includes(point.type)
    ? t(`sites.types.${point.type}`)
    : point.type

  const titreAssocie =
    point.questionnaire !== null ? titreDans(point.questionnaire.titre, langue) : null

  function commencerEdition(): void {
    setNom(point.nom)
    setTentative(false)
    setEnEdition(true)
  }

  async function enregistrerNom(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (nomPropre === '') {
      return
    }
    if (nomPropre === point.nom) {
      setEnEdition(false)
      return
    }
    if (await actions.modifier(point.id, { nom: nomPropre })) {
      setEnEdition(false)
    }
  }

  async function changerQuestionnaire(valeur: string): Promise<void> {
    await actions.modifier(point.id, { questionnaire_id: valeur === '' ? null : valeur })
  }

  // Le questionnaire associe est propose meme s'il n'est pas dans la liste chargee.
  const liste = questionnaires ?? []
  const associeAbsent =
    point.questionnaire_id !== null && !liste.some((q) => q.id === point.questionnaire_id)

  return (
    <li className="sites-point">
      <div>
        {enEdition ? (
          <form
            onSubmit={(evenement) => void enregistrerNom(evenement)}
            noValidate
            className="sites-renommer"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={idNom} className="sr-only">
                {t('sites.liste.nomDuPoint')}
              </label>
              <input
                id={idNom}
                type="text"
                autoComplete="off"
                maxLength={LONGUEUR_NOM}
                value={nom}
                aria-invalid={erreurNom !== null}
                onChange={(evenement) => setNom(evenement.target.value)}
              />
              {erreurNom !== null && (
                <p role="alert" className="m-0 text-xs text-erreur">
                  {erreurNom}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={actions.enCours}
              aria-busy={actions.enCours}
              className="sites-bouton sites-bouton--plein"
            >
              {t('sites.liste.enregistrer')}
            </button>
            <button
              type="button"
              disabled={actions.enCours}
              onClick={() => setEnEdition(false)}
              className="sites-bouton"
            >
              {t('sites.liste.annuler')}
            </button>
          </form>
        ) : (
          <>
            <h3 className="sites-point-nom">{point.nom}</h3>
            {/* Ordinateur : le type et la zone passent sous le nom, sur une seule ligne */}
            <p className="sites-point-sous">
              {point.zone !== null ? `${libelleType} · ${point.zone}` : libelleType}
            </p>
          </>
        )}
      </div>

      <dl className="sites-point-infos">
        <div className="sites-point-info sites-point-info--detail">
          <dt>{t('sites.liste.colonneType')}</dt>
          <dd>{libelleType}</dd>
        </div>

        <div className="sites-point-info sites-point-info--detail">
          <dt>{t('sites.liste.colonneZone')}</dt>
          <dd>{point.zone ?? '—'}</dd>
        </div>

        <div className="sites-point-info">
          <dt>{t('sites.liste.colonneQuestionnaire')}</dt>
          <dd>
            {peutModifier ? (
              <>
                <label htmlFor={idQuestionnaire} className="sr-only">
                  {t('sites.liste.questionnaireDe', { nom: point.nom })}
                </label>
                <select
                  id={idQuestionnaire}
                  value={point.questionnaire_id ?? ''}
                  disabled={questionnaires === null || actions.enCours}
                  onChange={(evenement) => void changerQuestionnaire(evenement.target.value)}
                >
                  <option value="">{t('sites.liste.aucunQuestionnaire')}</option>
                  {associeAbsent && point.questionnaire_id !== null && titreAssocie !== null && (
                    <option value={point.questionnaire_id}>{titreAssocie}</option>
                  )}
                  {liste.map((questionnaire) => (
                    <option key={questionnaire.id} value={questionnaire.id}>
                      {titreDans(questionnaire.titre, langue)}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              (titreAssocie ?? t('sites.liste.aucunQuestionnaire'))
            )}
          </dd>
        </div>

        <div className="sites-point-info">
          <dt>{t('sites.liste.colonneStatut')}</dt>
          <dd className="flex flex-wrap items-center gap-x-3">
            <span className={`sites-statut ${point.actif ? 'sites-statut--actif' : ''}`}>
              {point.actif ? t('sites.liste.actif') : t('sites.liste.desactive')}
            </span>
            {point.revoque_le !== null && (
              <span className="sites-statut sites-statut--revoque">
                {t('sites.liste.qrRevoque')}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {peutModifier && (
        <div className="sites-point-actions">
          {!enEdition && (
            <button
              type="button"
              disabled={actions.enCours}
              onClick={commencerEdition}
              className="sites-bouton"
            >
              {t('sites.liste.renommer')}
            </button>
          )}
          <button
            type="button"
            disabled={actions.enCours}
            onClick={() => void actions.changerStatut(point.id, !point.actif)}
            className="sites-bouton"
          >
            {point.actif ? t('sites.liste.desactiver') : t('sites.liste.activer')}
          </button>
        </div>
      )}
    </li>
  )
}

export function ListePoints({
  points,
  questionnaires,
  erreurQuestionnaires,
  peutModifier,
  actions,
}: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()

  // Ecran fixe : le nombre de points par page suit la hauteur de la zone.
  // Telephone : une seule page, tous les points sont dans la rangee de cartes.
  const { refZone, elementsPage, pageCourante, nbPages, allerA } = utiliserPages(points, {
    hauteurLigne: HAUTEUR_LIGNE,
    hauteurEnTete: HAUTEUR_ENTETE,
    lignesParDefaut: Math.max(points.length, 1),
    requeteEcranFixe: REQUETE_ECRAN_FIXE,
  })

  // Message d'echec d'une action (changer le nom, le questionnaire ou le statut).
  let messageErreur: string | null = null
  if (actions.erreur !== null) {
    if (actions.erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (actions.erreur.statut === 403) {
      messageErreur = t('sites.liste.erreurDroits')
    } else {
      messageErreur = t('sites.liste.erreur')
    }
  }

  const textePage = t('tableau.accueil.pageSur', { numero: pageCourante + 1, total: nbPages })

  return (
    <section aria-labelledby={idTitre} className="sites-points">
      <h2 id={idTitre} className="sites-points-titre">
        {t('sites.liste.titre', { nombre: points.length })}
      </h2>

      {peutModifier && erreurQuestionnaires !== null && (
        <p role="alert" className="sites-message sites-message--erreur">
          {t('sites.liste.erreurQuestionnaires')}
        </p>
      )}

      {messageErreur !== null && (
        <p role="alert" className="sites-message sites-message--erreur">
          {messageErreur}
        </p>
      )}

      {points.length === 0 ? (
        <p className="m-0 text-sm text-texte-secondaire">
          {peutModifier ? t('sites.liste.videResponsable') : t('sites.liste.vide')}
        </p>
      ) : (
        <>
          <div ref={refZone} className="sites-points-zone">
            {/* Libelles des colonnes : seulement sur ordinateur, les lecteurs d'ecran lisent les dt */}
            <div className="sites-points-entete" aria-hidden="true">
              <span>{t('sites.liste.colonneNom')}</span>
              <span>{t('sites.liste.colonneQuestionnaire')}</span>
              <span>{t('sites.liste.colonneStatut')}</span>
              <span>{peutModifier ? t('sites.liste.colonneActions') : ''}</span>
            </div>

            <ul className="sites-points-liste" aria-label={t('sites.liste.legende')}>
              {elementsPage.map((point) => (
                <LignePoint
                  key={point.id}
                  point={point}
                  questionnaires={questionnaires}
                  peutModifier={peutModifier}
                  actions={actions}
                />
              ))}
            </ul>
          </div>

          {nbPages > 1 && (
            <nav className="mt-2 flex items-center justify-center gap-2" aria-label={textePage}>
              <button
                type="button"
                className="sites-bouton"
                disabled={pageCourante === 0}
                onClick={() => allerA(pageCourante - 1)}
                aria-label={t('tableau.accueil.pagePrecedente')}
              >
                ←
              </button>
              <span aria-live="polite" className="text-xs text-texte-secondaire">
                {textePage}
              </span>
              <button
                type="button"
                className="sites-bouton"
                disabled={pageCourante === nbPages - 1}
                onClick={() => allerA(pageCourante + 1)}
                aria-label={t('tableau.accueil.pageSuivante')}
              >
                →
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
