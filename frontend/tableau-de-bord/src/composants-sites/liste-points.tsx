import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionsPoints } from '../hooks/utiliser-sites-points'
import type { ErreurService } from '../services/api'
import type { TexteMultilingue } from '../types/avis'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import { TYPES_POINT_CONTACT, type PointContact } from '../types/sites-points'

// Liste des points de contact du site choisi (ecran E12, jour 17).
// Pour chaque point : nom, type, zone, questionnaire associe, statut.
// Le Responsable peut changer le nom, le questionnaire et activer ou desactiver le point ;
// le Gestionnaire lit seulement (aucun bouton, le serveur refuse ses ecritures de toute facon).
// Ce composant n'appelle pas l'API : les actions viennent de utiliserSitesPoints.
// Le code public d'un point n'est jamais affiche ici : seul le QR (ecran E11) le contient.

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

// Une ligne du tableau, avec son propre etat de modification du nom.
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
    <tr className="border-t border-bordure align-middle">
      <td className="px-3 py-2 text-sm font-semibold text-texte">
        {enEdition ? (
          <form
            onSubmit={(evenement) => void enregistrerNom(evenement)}
            noValidate
            className="flex flex-wrap items-start gap-2"
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
                className="min-h-11 w-44 rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte"
              />
              {erreurNom !== null && (
                <p role="alert" className="m-0 text-xs font-normal text-erreur">
                  {erreurNom}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={actions.enCours}
              aria-busy={actions.enCours}
              className="min-h-11 rounded-md bg-principale px-3 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('sites.liste.enregistrer')}
            </button>
            <button
              type="button"
              disabled={actions.enCours}
              onClick={() => setEnEdition(false)}
              className="min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('sites.liste.annuler')}
            </button>
          </form>
        ) : (
          point.nom
        )}
      </td>

      <td className="px-3 py-2 text-sm text-texte-secondaire">{libelleType}</td>

      <td className="px-3 py-2 text-sm text-texte-secondaire">{point.zone ?? '—'}</td>

      <td className="px-3 py-2 text-sm text-texte-secondaire">
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
              className="min-h-11 w-full min-w-44 rounded-md border border-bordure-champ bg-fond px-2 text-sm text-texte disabled:cursor-not-allowed disabled:opacity-60"
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
      </td>

      <td className="px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`rounded-full border border-bordure px-2 py-0.5 text-xs font-semibold ${
              point.actif ? 'text-succes' : 'text-texte-secondaire'
            }`}
          >
            {point.actif ? t('sites.liste.actif') : t('sites.liste.desactive')}
          </span>
          {point.revoque_le !== null && (
            <span className="rounded-full border border-bordure px-2 py-0.5 text-xs font-semibold text-erreur">
              {t('sites.liste.qrRevoque')}
            </span>
          )}
        </div>
      </td>

      {peutModifier && (
        <td className="px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {!enEdition && (
              <button
                type="button"
                disabled={actions.enCours}
                onClick={commencerEdition}
                className="min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('sites.liste.renommer')}
              </button>
            )}
            <button
              type="button"
              disabled={actions.enCours}
              onClick={() => void actions.changerStatut(point.id, !point.actif)}
              className="min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
            >
              {point.actif ? t('sites.liste.desactiver') : t('sites.liste.activer')}
            </button>
          </div>
        </td>
      )}
    </tr>
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

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('sites.liste.titre', { nombre: points.length })}
      </h2>

      {peutModifier && erreurQuestionnaires !== null && (
        <p role="alert" className="mt-2 text-sm text-erreur">
          {t('sites.liste.erreurQuestionnaires')}
        </p>
      )}

      {messageErreur !== null && (
        <p role="alert" className="mt-2 text-sm text-erreur">
          {messageErreur}
        </p>
      )}

      {points.length === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">
          {peutModifier ? t('sites.liste.videResponsable') : t('sites.liste.vide')}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-176 border-collapse text-left">
            <caption className="sr-only">{t('sites.liste.legende')}</caption>
            <thead>
              <tr className="bg-fond-alt">
                <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                  {t('sites.liste.colonneNom')}
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                  {t('sites.liste.colonneType')}
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                  {t('sites.liste.colonneZone')}
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                  {t('sites.liste.colonneQuestionnaire')}
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                  {t('sites.liste.colonneStatut')}
                </th>
                {peutModifier && (
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                    {t('sites.liste.colonneActions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <LignePoint
                  key={point.id}
                  point={point}
                  questionnaires={questionnaires}
                  peutModifier={peutModifier}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}