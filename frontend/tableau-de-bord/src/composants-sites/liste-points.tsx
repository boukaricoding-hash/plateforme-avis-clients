import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionsPoints } from '../hooks/utiliser-sites-points'
import type { ErreurService } from '../services/api'
import '../styles/sites.css'
import type { TexteMultilingue } from '../types/avis'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import type { PointContact } from '../types/sites-points'

// Liste des points de contact du site choisi (ecran E12, design Premium).
// Une rangee de grandes cartes que l'on fait glisser de gauche a droite (styles/sites.css),
// avec des points de pagination qui suivent le defilement.
// Chaque carte montre : le statut, un grand numero, le nom, le questionnaire associe.
// Le Responsable a un rond avec un crayon : la carte passe en edition sur place (nom,
// questionnaire, activer ou desactiver). Le Gestionnaire lit seulement (aucun bouton,
// le serveur refuse ses ecritures de toute facon).
// Ce composant n'appelle pas l'API : les actions viennent de utiliserSitesPoints.
// Le code public d'un point n'est jamais affiche ici : seul le QR (ecran E11) le contient.
// La recherche (champ de la page) filtre les cartes par nom ou par zone, sans appel API.

type Proprietes = {
  points: PointContact[]
  // null tant que les questionnaires ne sont pas charges.
  questionnaires: ResumeQuestionnaire[] | null
  erreurQuestionnaires: ErreurService | null
  peutModifier: boolean
  actions: ActionsPoints
  // Texte du champ de recherche de la page (vide = tous les points).
  recherche?: string
}

// Longueur maximale du nom reprise du backend ; le serveur refait toujours la verification.
const LONGUEUR_NOM = 120

// Titre dans la langue choisie, sinon en francais (l'anglais est facultatif).
function titreDans(titre: TexteMultilingue, langue: string): string {
  return (langue === 'en' ? titre.en : null) ?? titre.fr
}

// Texte sans accent ni majuscule, pour que "Terrasse" se trouve en tapant "terr".
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Grand chiffre de la carte : le numero a la fin du nom ("Table 12" donne 12).
// Sans numero, la premiere lettre du nom.
function grosChiffre(nom: string): string {
  const propre = nom.trim()
  const numero = /(\d+)$/.exec(propre)?.[1]
  if (numero !== undefined) {
    return numero
  }
  return Array.from(propre)[0]?.toUpperCase() ?? '•'
}

// Largeur d'une "page" de la rangee (ce qu'on voit sans les marges) et defilement maximal.
function mesuresPiste(piste: HTMLElement): { largeur: number; max: number } {
  const marge = parseFloat(getComputedStyle(piste).paddingLeft) || 0
  return {
    largeur: Math.max(1, piste.clientWidth - 2 * marge),
    max: piste.scrollWidth - piste.clientWidth,
  }
}

type ProprietesEtat = {
  point: PointContact
}

// Statut du point (texte et point colore) et, si besoin, "QR code revoque".
function EtatPoint({ point }: ProprietesEtat) {
  const { t } = utiliserLangue()

  return (
    <>
      <span className={`sites-statut ${point.actif ? 'sites-statut--actif' : ''}`}>
        {point.actif ? t('sites.liste.actif') : t('sites.liste.desactive')}
      </span>
      {point.revoque_le !== null && (
        <span className="sites-statut sites-statut--revoque">{t('sites.liste.qrRevoque')}</span>
      )}
    </>
  )
}

type ProprietesCarte = {
  point: PointContact
  questionnaires: ResumeQuestionnaire[] | null
  peutModifier: boolean
  actions: ActionsPoints
}

// Un point de contact, avec son propre etat de modification.
function CartePoint({ point, questionnaires, peutModifier, actions }: ProprietesCarte) {
  const { t, langue } = utiliserLangue()
  const idNom = useId()
  const idQuestionnaire = useId()

  const [enEdition, setEnEdition] = useState(false)
  const [nom, setNom] = useState(point.nom)
  const [tentative, setTentative] = useState(false)

  const nomPropre = nom.trim()
  const erreurNom = tentative && nomPropre === '' ? t('sites.liste.nomObligatoire') : null

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

  if (enEdition) {
    // Le questionnaire associe est propose meme s'il n'est pas dans la liste chargee.
    const liste = questionnaires ?? []
    const associeAbsent =
      point.questionnaire_id !== null && !liste.some((q) => q.id === point.questionnaire_id)

    return (
      <li className="sites-carte sites-carte--edition">
        <div className="sites-carte-haut">
          <EtatPoint point={point} />
        </div>

        <form
          onSubmit={(evenement) => void enregistrerNom(evenement)}
          noValidate
          className="sites-carte-form"
        >
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

          <div className="sites-carte-form-boutons">
            <button
              type="submit"
              disabled={actions.enCours}
              aria-busy={actions.enCours}
              className="sites-bouton sites-bouton--plein sites-bouton--petit"
            >
              {t('sites.liste.enregistrer')}
            </button>
            <button
              type="button"
              disabled={actions.enCours}
              onClick={() => setEnEdition(false)}
              className="sites-bouton sites-bouton--petit"
            >
              {t('sites.liste.annuler')}
            </button>
          </div>
        </form>

        <button
          type="button"
          disabled={actions.enCours}
          onClick={() => void actions.changerStatut(point.id, !point.actif)}
          className="sites-bouton sites-bouton--petit"
        >
          {point.actif ? t('sites.liste.desactiver') : t('sites.liste.activer')}
        </button>
      </li>
    )
  }

  const chiffre = grosChiffre(point.nom)

  return (
    <li className={`sites-carte ${point.actif ? '' : 'sites-carte--off'}`}>
      <div className="sites-carte-haut">
        <EtatPoint point={point} />
      </div>

      <div>
        {/* Le nom ecrit en toutes lettres suffit aux lecteurs d'ecran : le grand chiffre est decoratif */}
        <div
          className={`sites-carte-num ${chiffre.length >= 4 ? 'sites-carte-num--long' : ''}`}
          aria-hidden="true"
        >
          {chiffre}
        </div>
        <h3 className="sites-carte-nom">
          {point.zone !== null ? `${point.nom} · ${point.zone}` : point.nom}
        </h3>
      </div>

      <div className="sites-carte-bas">
        <span className="sites-carte-q">{titreAssocie ?? t('sites.liste.aucunQuestionnaire')}</span>
        {peutModifier && (
          <button
            type="button"
            disabled={actions.enCours}
            onClick={commencerEdition}
            className="sites-rond"
            aria-label={t('sites.liste.modifierPoint', { nom: point.nom })}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        )}
      </div>
    </li>
  )
}

export function ListePoints({
  points,
  questionnaires,
  erreurQuestionnaires,
  peutModifier,
  actions,
  recherche = '',
}: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const refPiste = useRef<HTMLUListElement | null>(null)
  // Pages de la rangee : une page = ce qu'on voit d'un coup, sans defiler.
  const [nbPages, setNbPages] = useState(1)
  const [pageCourante, setPageCourante] = useState(0)

  const terme = normaliser(recherche)
  const visibles =
    terme === ''
      ? points
      : points.filter(
          (point) =>
            normaliser(point.nom).includes(terme) ||
            (point.zone !== null && normaliser(point.zone).includes(terme)),
        )
  const nombre = visibles.length

  // Mesure la rangee : au debut, quand sa taille change, et a chaque defilement.
  // On repart de zero quand le nombre de cartes change (la rangee apparait ou se raccourcit).
  useEffect(() => {
    const piste = refPiste.current
    if (piste === null) {
      return
    }
    const mesurer = (): void => {
      const { largeur, max } = mesuresPiste(piste)
      const total = max > 1 ? Math.ceil(max / largeur) + 1 : 1
      const courante = piste.scrollLeft >= max - 1 ? total - 1 : Math.round(piste.scrollLeft / largeur)
      setNbPages(total)
      setPageCourante(Math.min(Math.max(courante, 0), total - 1))
    }
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(piste)
    piste.addEventListener('scroll', mesurer, { passive: true })
    return () => {
      observateur.disconnect()
      piste.removeEventListener('scroll', mesurer)
    }
  }, [nombre])

  // Une nouvelle recherche : on revient a la premiere carte, sans glissement.
  useEffect(() => {
    refPiste.current?.scrollTo({ left: 0, behavior: 'instant' })
  }, [recherche])

  function allerA(page: number): void {
    const piste = refPiste.current
    if (piste === null) {
      return
    }
    const { largeur } = mesuresPiste(piste)
    piste.scrollTo({ left: page * largeur, behavior: 'smooth' })
  }

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
    <section aria-labelledby={idTitre} className="sites-points">
      <h2 id={idTitre} className="sr-only">
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
        <p className="sites-vide">
          {peutModifier ? t('sites.liste.videResponsable') : t('sites.liste.vide')}
        </p>
      ) : nombre === 0 ? (
        <p role="status" className="sites-vide">
          {t('sites.liste.aucunResultat')}
        </p>
      ) : (
        <>
          <ul ref={refPiste} className="sites-piste" aria-label={t('sites.liste.legende')}>
            {visibles.map((point) => (
              <CartePoint
                key={point.id}
                point={point}
                questionnaires={questionnaires}
                peutModifier={peutModifier}
                actions={actions}
              />
            ))}
          </ul>

          <div className="sites-pied">
            <div className="sites-dots">
              {nbPages > 1 &&
                Array.from({ length: nbPages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`sites-dot ${index === pageCourante ? 'sites-dot--actif' : ''}`}
                    aria-label={t('sites.liste.pageNumero', { numero: index + 1, total: nbPages })}
                    aria-current={index === pageCourante ? 'true' : undefined}
                    onClick={() => allerA(index)}
                  />
                ))}
            </div>
            <span className="sites-indication">
              {nbPages > 1
                ? t('sites.liste.indicationGlisser', { nombre })
                : t('sites.liste.compteur', { nombre })}
            </span>
          </div>
        </>
      )}
    </section>
  )
}