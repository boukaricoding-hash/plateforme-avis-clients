import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ResultatVersionsQuestionnaire } from '../hooks/utiliser-versions-questionnaire'
import type { ErreurService } from '../services/api'
import type { ValeurContexteLangue } from '../traductions/contexte-langue'
import type { VersionHistorique } from '../types/questionnaires'

// Section "Versions" d'un questionnaire deja enregistre (editeur E10, jour 20), sous le panneau de
// publication : une ligne par version, de la plus recente a la plus ancienne, avec son numero, son
// etat (publiee ou non), sa date, son nombre de questions et le nombre d'avis recus avec elle.
// Ce composant n'appelle pas l'API : la page lui donne le resultat du hook
// utiliserVersionsQuestionnaire. Reserve au Responsable : pour les autres (ou tant que le
// questionnaire n'est pas cree), le hook ne charge rien et la section n'apparait pas.
// Il reprend le cadre du panneau de publication (classes publication-*) ; seules les lignes de
// la liste ont leurs propres classes (versions-*), dans styles/publication-questionnaire.css.
// Les dates sont affichees a l'heure de Lome (UTC+0, comme le reste du projet).

const V = 'questionnaires.versions.'

type Traduire = ValeurContexteLangue['t']

type PropsHistoriqueVersions = {
  resultat: ResultatVersionsQuestionnaire
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

// Cle du texte a afficher pour une erreur du serveur
function cleErreur(erreur: ErreurService): string {
  if (erreur.statut === 0) {
    return 'commun.erreurReseau'
  }
  if (erreur.statut === 404) {
    return `${V}erreurIntrouvable`
  }
  return `${V}erreur`
}

// "1 question" / "12 questions" (zero s'ecrit comme un : "0 question")
function texteQuestions(t: Traduire, nombre: number): string {
  return t(nombre <= 1 ? `${V}questionsUn` : `${V}questionsMultiple`, { nombre })
}

// "Aucun avis" / "1 avis" / "12 avis"
function texteAvis(t: Traduire, nombre: number): string {
  if (nombre === 0) {
    return t(`${V}avisZero`)
  }
  return t(nombre === 1 ? `${V}avisUn` : `${V}avisMultiple`, { nombre })
}

type PropsLigneVersion = {
  version: VersionHistorique
  // Vrai pour la version la plus recente
  actuelle: boolean
}

function LigneVersion({ version, actuelle }: PropsLigneVersion) {
  const { t, langue } = utiliserLangue()
  const publiee = version.publie_le !== null

  const texteDate =
    version.publie_le !== null
      ? t(`${V}publieeLe`, { date: formaterDate(version.publie_le, langue) })
      : t(`${V}creeeLe`, { date: formaterDate(version.cree_le, langue) })

  return (
    <li className={`versions-ligne${actuelle ? ' versions-ligne--actuelle' : ''}`}>
      <div className="versions-ligne-entete">
        <span className="versions-numero">{t(`${V}version`, { numero: version.numero })}</span>
        {actuelle && (
          <span className="versions-etiquette versions-etiquette--actuelle">{t(`${V}actuelle`)}</span>
        )}
        <span
          className={`versions-etiquette ${publiee ? 'versions-etiquette--publiee' : 'versions-etiquette--non-publiee'}`}
        >
          {publiee ? t(`${V}publiee`) : t(`${V}nonPubliee`)}
        </span>
      </div>
      <div className="versions-ligne-details">
        <span className="versions-detail">{texteDate}</span>
        <span className="versions-detail">{texteQuestions(t, version.nombre_questions)}</span>
        <span className="versions-detail">{texteAvis(t, version.nombre_avis)}</span>
      </div>
    </li>
  )
}

export function HistoriqueVersions({ resultat }: PropsHistoriqueVersions) {
  const { t } = utiliserLangue()
  const { versions, chargement, erreur, recharger } = resultat

  // Rien a montrer : questionnaire pas encore cree, ou utilisateur qui n'est pas Responsable
  if (versions === null && !chargement && erreur === null) {
    return null
  }

  // Le serveur les renvoie deja de la plus recente a la plus ancienne ; on garde cet ordre par securite
  const liste = versions !== null ? [...versions].sort((a, b) => b.numero - a.numero) : []

  return (
    <section className="publication-panneau" aria-label={t(`${V}titre`)}>
      <div className="publication-section">
        <h3 className="publication-section-titre">{t(`${V}titre`)}</h3>
        <p className="publication-aide">{t(`${V}aide`)}</p>

        {chargement && (
          <p className="publication-aide" role="status">
            {t(`${V}chargement`)}
          </p>
        )}

        {versions !== null && liste.length === 0 && <p className="publication-aide">{t(`${V}aucune`)}</p>}

        {liste.length > 0 && (
          <ul className="versions-liste">
            {liste.map((version, i) => (
              <LigneVersion key={version.id} version={version} actuelle={i === 0} />
            ))}
          </ul>
        )}

        {erreur !== null && (
          <>
            <p className="publication-message publication-message--erreur" role="alert">
              {t(cleErreur(erreur))}
            </p>
            {erreur.statut !== 404 && (
              <div className="publication-actions">
                <button type="button" className="publication-bouton" onClick={recharger}>
                  {t('commun.reessayer')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}