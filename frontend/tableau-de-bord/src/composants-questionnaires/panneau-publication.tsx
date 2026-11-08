import { useId, useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type {
  ActionDates,
  ActionPointsContact,
  ResultatGestionQuestionnaire,
} from '../hooks/utiliser-gestion-questionnaire'
import type { ErreurService } from '../services/api'
import type { TexteMultilingue } from '../types/avis'
import type { FicheQuestionnaire } from '../types/questionnaires'
import type { PointContact } from '../types/sites-points'

// Panneau de publication d'un questionnaire deja enregistre (editeur E10, jour 20), sous le formulaire :
// - Publication : statut, version, et le bouton qui convient (publier, activer ou desactiver) ;
// - Dates de debut et de fin (pour les evenements) ;
// - Points de contact : ceux qui utilisent ce questionnaire (la liste complete est enregistree d'un coup).
// Ce composant n'appelle pas l'API et ne garde que des saisies en cours : la page lui donne le resultat
// du hook utiliserGestionQuestionnaire (fiche a jour et actions). Reserve au Responsable.
// - nonEnregistre : le brouillon de l'editeur n'est pas enregistre. La publication utilise la derniere
//   version ENREGISTREE : le bouton Publier est alors bloque (il faut enregistrer d'abord).
// Les dates sont saisies et affichees a l'heure de Lome (UTC+0, comme le reste du projet) : aucune
// conversion de fuseau. Les styles sont dans styles/publication-questionnaire.css.

const P = 'questionnaires.publication.'

type PropsPanneauPublication = {
  gestion: ResultatGestionQuestionnaire
  nonEnregistre: boolean
}

// ------------------------------------------------------------
// Petits outils
// ------------------------------------------------------------

// Texte d'un libelle selon la langue : anglais si demande et rempli, sinon francais
function texteLangue(texte: TexteMultilingue, langue: string): string {
  if (langue === 'en' && texte.en !== undefined && texte.en !== null && texte.en.trim() !== '') {
    return texte.en
  }
  return texte.fr
}

// Date lisible dans la langue choisie ; un tiret si la date n'est pas valide
function formaterDate(valeur: string, langue: string): string {
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

// Date du serveur (ISO) vers la valeur d'un champ datetime-local, a l'heure de Lome (UTC+0)
function isoVersChamp(iso: string | null): string {
  if (iso === null) {
    return ''
  }
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16)
}

// Valeur d'un champ datetime-local vers la date envoyee au serveur (2026-12-01T08:00:00Z)
function champVersIso(valeur: string): string | null {
  if (valeur === '') {
    return null
  }
  const iso = `${valeur}:00Z`
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

// Cle du texte a afficher pour une erreur du serveur
function cleErreur(erreur: ErreurService): string {
  if (erreur.statut === 0) {
    return 'commun.erreurReseau'
  }
  if (erreur.statut === 403) {
    return `${P}erreurs.interdit`
  }
  if (erreur.statut === 404) {
    return `${P}erreurs.introuvable`
  }
  if (erreur.code === 'NON_PUBLIE') {
    return `${P}erreurs.nonPublie`
  }
  if (erreur.statut === 400) {
    return `${P}erreurs.donneesInvalides`
  }
  return `${P}erreurs.generique`
}

// Ordre naturel : "Table 2" avant "Table 10"
function comparerNoms(a: PointContact, b: PointContact): number {
  return a.nom.localeCompare(b.nom, undefined, { numeric: true, sensitivity: 'base' })
}

function memeSelection(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const valeur of a) {
    if (!b.has(valeur)) {
      return false
    }
  }
  return true
}

// ------------------------------------------------------------
// Section Publication
// ------------------------------------------------------------

type PropsSectionPublication = {
  fiche: FicheQuestionnaire
  gestion: ResultatGestionQuestionnaire
  nonEnregistre: boolean
  occupe: boolean
}

function SectionPublication({ fiche, gestion, nonEnregistre, occupe }: PropsSectionPublication) {
  const { t, langue } = utiliserLangue()
  // Derniere action lancee ici : c'est son resultat (succes ou erreur) qui s'affiche.
  const [derniere, setDerniere] = useState<'publication' | 'statut' | null>(null)
  const { publication, statut } = gestion

  const version = fiche.version
  const publiee = version !== null && version.publie_le !== null
  const alerteSansPoint = fiche.statut === 'ACTIF' && fiche.points_contact.length === 0

  const action = derniere === 'publication' ? publication : derniere === 'statut' ? statut : null
  const erreur = action !== null ? action.erreur : null
  const succes = action !== null && action.succes && !action.enCours
  const texteSucces = derniere === 'publication' ? `${P}succes.publie` : `${P}succes.statut`

  let texteVersion = t(`${P}aucuneVersion`)
  if (version !== null) {
    texteVersion =
      version.publie_le !== null
        ? t(`${P}versionPubliee`, {
            numero: version.numero,
            date: formaterDate(version.publie_le, langue),
          })
        : t(`${P}versionNonPubliee`, { numero: version.numero })
  }

  return (
    <div className="publication-section">
      <h3 className="publication-section-titre">{t(`${P}titre`)}</h3>

      <div className="publication-ligne">
        <span className={`publication-statut publication-statut--${fiche.statut.toLowerCase()}`}>
          {t(`${P}statuts.${fiche.statut}`)}
        </span>
        <span className="publication-version">{texteVersion}</span>
      </div>

      {alerteSansPoint && <p className="publication-message publication-message--alerte">{t(`${P}sansPoint`)}</p>}

      {nonEnregistre && !publiee && version !== null && (
        <p className="publication-message publication-message--alerte">{t(`${P}nonEnregistre`)}</p>
      )}

      <div className="publication-actions">
        {version !== null && !publiee && (
          <button
            type="button"
            className="publication-bouton publication-bouton--principal"
            disabled={occupe || nonEnregistre}
            onClick={() => {
              setDerniere('publication')
              void publication.publier()
            }}
          >
            {publication.enCours ? t(`${P}publicationEnCours`) : t(`${P}publier`)}
          </button>
        )}
        {publiee && fiche.statut === 'ACTIF' && (
          <button
            type="button"
            className="publication-bouton"
            disabled={occupe}
            onClick={() => {
              setDerniere('statut')
              void statut.desactiver()
            }}
          >
            {t(`${P}desactiver`)}
          </button>
        )}
        {publiee && fiche.statut !== 'ACTIF' && (
          <button
            type="button"
            className="publication-bouton publication-bouton--principal"
            disabled={occupe}
            onClick={() => {
              setDerniere('statut')
              void statut.activer()
            }}
          >
            {t(`${P}activer`)}
          </button>
        )}
      </div>

      {nonEnregistre && !publiee && version !== null && (
        <p className="publication-aide">{t(`${P}publierAide`)}</p>
      )}

      {erreur !== null && (
        <p className="publication-message publication-message--erreur" role="alert">
          {t(cleErreur(erreur))}
        </p>
      )}
      {succes && (
        <p className="publication-message publication-message--succes" role="status">
          {t(texteSucces)}
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Section Dates
// ------------------------------------------------------------

type PropsSectionDates = {
  fiche: FicheQuestionnaire
  action: ActionDates
  occupe: boolean
}

// La page la recree (key) quand les dates enregistrees changent : les champs repartent des dates du serveur.
function SectionDates({ fiche, action, occupe }: PropsSectionDates) {
  const { t } = utiliserLangue()
  const idDebut = useId()
  const idFin = useId()

  const debutInitial = isoVersChamp(fiche.date_debut)
  const finInitiale = isoVersChamp(fiche.date_fin)
  const [debut, setDebut] = useState(debutInitial)
  const [fin, setFin] = useState(finInitiale)

  // Les deux valeurs ont le meme format (AAAA-MM-JJThh:mm) : la comparaison de textes suffit.
  const inversees = debut !== '' && fin !== '' && fin <= debut
  const modifie = debut !== debutInitial || fin !== finInitiale

  return (
    <div className="publication-section">
      <h3 className="publication-section-titre">{t(`${P}dates.titre`)}</h3>
      <p className="publication-aide">{t(`${P}dates.aide`)}</p>

      <div className="publication-champs">
        <div className="publication-champ">
          <label className="publication-etiquette" htmlFor={idDebut}>
            {t(`${P}dates.debut`)}
          </label>
          <input
            id={idDebut}
            type="datetime-local"
            className="publication-saisie"
            value={debut}
            disabled={occupe}
            onChange={(e) => setDebut(e.target.value)}
          />
        </div>
        <div className="publication-champ">
          <label className="publication-etiquette" htmlFor={idFin}>
            {t(`${P}dates.fin`)}
          </label>
          <input
            id={idFin}
            type="datetime-local"
            className="publication-saisie"
            value={fin}
            min={debut !== '' ? debut : undefined}
            disabled={occupe}
            aria-invalid={inversees}
            onChange={(e) => setFin(e.target.value)}
          />
        </div>
      </div>

      <p className="publication-aide">{t(`${P}dates.fuseau`)}</p>

      {inversees && (
        <p className="publication-message publication-message--erreur" role="alert">
          {t(`${P}erreurs.datesInversees`)}
        </p>
      )}

      <div className="publication-actions">
        <button
          type="button"
          className="publication-bouton publication-bouton--principal"
          disabled={occupe || !modifie || inversees}
          onClick={() => {
            void action.enregistrer(champVersIso(debut), champVersIso(fin))
          }}
        >
          {action.enCours ? t(`${P}enregistrement`) : t(`${P}dates.enregistrer`)}
        </button>
        <button
          type="button"
          className="publication-bouton"
          disabled={occupe || (debut === '' && fin === '')}
          onClick={() => {
            setDebut('')
            setFin('')
          }}
        >
          {t(`${P}dates.effacer`)}
        </button>
      </div>

      {action.erreur !== null && (
        <p className="publication-message publication-message--erreur" role="alert">
          {t(cleErreur(action.erreur))}
        </p>
      )}
      {action.succes && !action.enCours && (
        <p className="publication-message publication-message--succes" role="status">
          {t(`${P}succes.dates`)}
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Section Points de contact
// ------------------------------------------------------------

type PropsSectionPoints = {
  fiche: FicheQuestionnaire
  points: PointContact[] | null
  erreurPoints: boolean
  action: ActionPointsContact
  occupe: boolean
}

// La page la recree (key) quand les points associes changent : la selection repart de ceux du serveur.
function SectionPoints({ fiche, points, erreurPoints, action, occupe }: PropsSectionPoints) {
  const { t, langue } = utiliserLangue()

  const initiale = new Set(fiche.points_contact.map((point) => point.id))
  const [selection, setSelection] = useState<Set<string>>(() => new Set(initiale))

  const liste = points !== null ? [...points].sort(comparerNoms) : []
  const modifie = !memeSelection(selection, initiale)

  function basculer(id: string): void {
    setSelection((avant) => {
      const suivante = new Set(avant)
      if (suivante.has(id)) {
        suivante.delete(id)
      } else {
        suivante.add(id)
      }
      return suivante
    })
  }

  function toutSelectionner(): void {
    setSelection((avant) => {
      const suivante = new Set(avant)
      for (const point of liste) {
        suivante.add(point.id)
      }
      return suivante
    })
  }

  function toutDeselectionner(): void {
    setSelection(new Set())
  }

  return (
    <div className="publication-section">
      <h3 className="publication-section-titre">{t(`${P}points.titre`)}</h3>
      <p className="publication-aide">{t(`${P}points.aide`)}</p>

      {erreurPoints && (
        <p className="publication-message publication-message--erreur" role="alert">
          {t(`${P}points.erreurListe`)}
        </p>
      )}
      {!erreurPoints && points === null && (
        <p className="publication-aide" role="status">
          {t(`${P}points.chargement`)}
        </p>
      )}
      {points !== null && liste.length === 0 && <p className="publication-aide">{t(`${P}points.aucun`)}</p>}

      {liste.length > 0 && (
        <>
          <div className="publication-ligne">
            <span className="publication-version">{t(`${P}points.selection`, { nombre: selection.size })}</span>
            <button type="button" className="publication-lien" disabled={occupe} onClick={toutSelectionner}>
              {t(`${P}points.toutSelectionner`)}
            </button>
            <button type="button" className="publication-lien" disabled={occupe} onClick={toutDeselectionner}>
              {t(`${P}points.toutDeselectionner`)}
            </button>
          </div>

          <fieldset className="publication-points" disabled={occupe}>
            <legend className="publication-points-legende">{t(`${P}points.titre`)}</legend>
            {liste.map((point) => {
              const autre =
                point.questionnaire !== null && point.questionnaire_id !== fiche.id
                  ? texteLangue(point.questionnaire.titre, langue)
                  : null
              return (
                <label key={point.id} className="publication-point">
                  <input
                    type="checkbox"
                    checked={selection.has(point.id)}
                    onChange={() => basculer(point.id)}
                  />
                  <span className="publication-point-nom">{point.nom}</span>
                  {!point.actif && <span className="publication-point-etiquette">{t(`${P}points.inactif`)}</span>}
                  {point.revoque_le !== null && (
                    <span className="publication-point-etiquette">{t(`${P}points.revoque`)}</span>
                  )}
                  {autre !== null && (
                    <span className="publication-point-etiquette">
                      {t(`${P}points.autreQuestionnaire`, { titre: autre })}
                    </span>
                  )}
                </label>
              )
            })}
          </fieldset>
        </>
      )}

      <div className="publication-actions">
        <button
          type="button"
          className="publication-bouton publication-bouton--principal"
          disabled={occupe || !modifie || points === null}
          onClick={() => {
            void action.enregistrer([...selection])
          }}
        >
          {action.enCours ? t(`${P}enregistrement`) : t(`${P}points.enregistrer`)}
        </button>
      </div>

      {action.erreur !== null && (
        <p className="publication-message publication-message--erreur" role="alert">
          {t(cleErreur(action.erreur))}
        </p>
      )}
      {action.succes && !action.enCours && (
        <p className="publication-message publication-message--succes" role="status">
          {t(`${P}succes.points`)}
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Le panneau
// ------------------------------------------------------------

export function PanneauPublication({ gestion, nonEnregistre }: PropsPanneauPublication) {
  const { t } = utiliserLangue()
  const { acces, fiche, chargement, erreur, recharger } = gestion

  if (acces !== 'responsable') {
    return null
  }

  if (erreur !== null) {
    return (
      <section className="publication-panneau" aria-label={t(`${P}titre`)}>
        <p className="publication-message publication-message--erreur" role="alert">
          {t(`${P}erreurChargement`)}
        </p>
        <button type="button" className="publication-bouton" onClick={recharger}>
          {t('commun.reessayer')}
        </button>
      </section>
    )
  }

  if (chargement || fiche === null) {
    return (
      <section className="publication-panneau" aria-label={t(`${P}titre`)}>
        <p className="publication-aide" role="status">
          {t(`${P}chargement`)}
        </p>
      </section>
    )
  }

  // Une seule action a la fois : les boutons se bloquent pendant qu'une action est en cours.
  const occupe =
    gestion.publication.enCours ||
    gestion.statut.enCours ||
    gestion.dates.enCours ||
    gestion.pointsContact.enCours

  const cleDates = `${fiche.date_debut ?? ''}|${fiche.date_fin ?? ''}`
  const clePoints = fiche.points_contact
    .map((point) => point.id)
    .sort()
    .join('|')

  return (
    <section className="publication-panneau" aria-label={t(`${P}titre`)}>
      <SectionPublication fiche={fiche} gestion={gestion} nonEnregistre={nonEnregistre} occupe={occupe} />
      <SectionDates key={cleDates} fiche={fiche} action={gestion.dates} occupe={occupe} />
      <SectionPoints
        key={clePoints}
        fiche={fiche}
        points={gestion.pointsDisponibles}
        erreurPoints={gestion.erreurPoints}
        action={gestion.pointsContact}
        occupe={occupe}
      />
    </section>
  )
}