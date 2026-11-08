import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { IconeChevronGauche, IconeEnregistrer } from '../../composants-avis/icones-avis'
import { CarteQuestion } from '../../composants-questionnaires/carte-question'
import { ChampBilingue } from '../../composants-questionnaires/champ-bilingue'
import { IconeAjouter } from '../../composants-questionnaires/icones-questionnaires'
import {
  NOMBRE_MAX_QUESTIONS,
  utiliserEditeurQuestionnaire,
} from '../../hooks/utiliser-editeur-questionnaire'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import '../../styles/editeur-questionnaire.css'

// Ecran E10 : editeur d'un questionnaire (jour 19).
// - /questionnaires/nouveau : questionnaire vide (une seule question d'etoiles au depart).
// - /questionnaires/<id> : modification d'un questionnaire de l'organisation.
// Seul le Responsable arrive ici ; les autres sont renvoyes a la liste.
// La page n'appelle pas l'API : tout vient du hook utiliserEditeurQuestionnaire (brouillon,
// themes, actions, enregistrement). Elle assemble le formulaire general, les cartes de question
// et les messages, et garde ce qui est propre a l'ecran : le retour avec confirmation et
// l'avertissement a la fermeture de l'onglet quand des modifications ne sont pas enregistrees.
// Apres la CREATION, la page passe sur /questionnaires/<id> (sinon un deuxieme enregistrement
// creerait un autre questionnaire) et le message "Questionnaire cree." suit dans l'etat de navigation.
// Le hook ne relit pas la fiche si l'id change : l'ecran est recree avec key a chaque nouvel id.

type PropsEcranEditeur = {
  // null = nouveau questionnaire
  id: string | null
  // Vrai si l'on arrive juste apres la creation de ce questionnaire
  creeAvant: boolean
}

function EcranEditeur({ id, creeAvant }: PropsEcranEditeur) {
  const { t } = utiliserLangue()
  const navigate = useNavigate()
  const {
    acces,
    mode,
    chargement,
    erreurChargement,
    recharger,
    brouillon,
    version,
    nonEnregistre,
    themes,
    erreurThemes,
    enregistrement,
    actions,
  } = utiliserEditeurQuestionnaire(id)

  // Avertit avant la fermeture de l'onglet quand des modifications ne sont pas enregistrees
  useEffect(() => {
    if (!nonEnregistre) {
      return
    }

    function avertir(evenement: BeforeUnloadEvent): void {
      evenement.preventDefault()
    }

    window.addEventListener('beforeunload', avertir)
    return () => window.removeEventListener('beforeunload', avertir)
  }, [nonEnregistre])

  // Seul le Responsable modifie les questionnaires : les autres retournent a la liste.
  if (acces === 'aucun') {
    return <Navigate to="/questionnaires" replace />
  }

  function retourner(): void {
    if (nonEnregistre && !window.confirm(t('questionnaires.editeur.confirmerQuitter'))) {
      return
    }
    void navigate('/questionnaires')
  }

  async function gererEnregistrement(): Promise<void> {
    const questionnaireId = await enregistrement.enregistrer()
    if (questionnaireId !== null && id === null) {
      void navigate(`/questionnaires/${questionnaireId}`, {
        replace: true,
        state: { questionnaireCree: true },
      })
    }
  }

  const boutonRetour = (
    <button type="button" className="editeur-questionnaire-retour" onClick={retourner}>
      <IconeChevronGauche />
      <span>{t('questionnaires.editeur.retour')}</span>
    </button>
  )

  if (chargement) {
    return (
      <div className="editeur-questionnaire">
        <p className="editeur-questionnaire-etat" role="status">
          {t('questionnaires.editeur.chargement')}
        </p>
      </div>
    )
  }

  if (erreurChargement !== null || brouillon === null) {
    const introuvable = erreurChargement !== null && erreurChargement.statut === 404
    const messageChargement = introuvable
      ? t('questionnaires.editeur.introuvable')
      : erreurChargement !== null && erreurChargement.statut === 0
        ? t('commun.erreurReseau')
        : t('questionnaires.editeur.erreurChargement')

    return (
      <div className="editeur-questionnaire">
        <div className="editeur-questionnaire-entete">{boutonRetour}</div>
        <p className="editeur-questionnaire-message editeur-questionnaire-message--erreur" role="alert">
          {messageChargement}
        </p>
        {!introuvable && (
          <button type="button" className="editeur-questionnaire-enregistrer" onClick={recharger}>
            {t('commun.reessayer')}
          </button>
        )}
      </div>
    )
  }

  const nombreQuestions = brouillon.questions.length
  const limiteAtteinte = nombreQuestions >= NOMBRE_MAX_QUESTIONS
  const erreur = enregistrement.erreur
  const titreInvalide = erreur !== null && erreur.cle === 'questionnaires.editeur.erreurs.titreVide'

  // Message de reussite : celui du dernier enregistrement, ou celui de la creation juste avant
  const reussite = enregistrement.reussite
  let messageReussite: string | null = null
  if (reussite !== null) {
    if (reussite.type === 'nouvelleVersion') {
      messageReussite = t('questionnaires.editeur.reussite.nouvelleVersion', {
        numero: reussite.numero !== null ? reussite.numero : '',
      })
    } else if (reussite.type === 'cree') {
      messageReussite = t('questionnaires.editeur.reussite.cree')
    } else {
      messageReussite = t('questionnaires.editeur.reussite.modifie')
    }
  } else if (creeAvant && !nonEnregistre) {
    messageReussite = t('questionnaires.editeur.reussite.cree')
  }

  return (
    <div className="editeur-questionnaire">
      <div className="editeur-questionnaire-entete">
        {boutonRetour}
        <div className="editeur-questionnaire-titres">
          <h1 className="editeur-questionnaire-titre">
            {mode === 'creation'
              ? t('questionnaires.editeur.titreCreation')
              : t('questionnaires.editeur.titreModification')}
          </h1>
          {version !== null && (
            <span className="editeur-questionnaire-badge">
              {t('questionnaires.editeur.versionActuelle', { numero: version })}
            </span>
          )}
          {nonEnregistre && (
            <span className="editeur-questionnaire-badge editeur-questionnaire-badge--alerte">
              {t('questionnaires.editeur.nonEnregistre')}
            </span>
          )}
        </div>
        <button
          type="button"
          className="editeur-questionnaire-enregistrer"
          disabled={enregistrement.enCours || !nonEnregistre}
          onClick={() => void gererEnregistrement()}
        >
          <IconeEnregistrer />
          <span>
            {enregistrement.enCours
              ? t('questionnaires.editeur.enregistrement')
              : t('questionnaires.editeur.enregistrer')}
          </span>
        </button>
      </div>

      {erreur !== null && (
        <p className="editeur-questionnaire-message editeur-questionnaire-message--erreur" role="alert">
          {t(erreur.cle, erreur.valeurs)}
        </p>
      )}
      {messageReussite !== null && (
        <p className="editeur-questionnaire-message editeur-questionnaire-message--succes" role="status">
          {messageReussite}
        </p>
      )}

      <section className="editeur-questionnaire-section">
        <h2 className="editeur-questionnaire-section-titre">
          {t('questionnaires.editeur.general.titre')}
        </h2>
        <p className="editeur-questionnaire-section-aide">
          {t('questionnaires.editeur.general.aide')}
        </p>

        <ChampBilingue
          libelle={t('questionnaires.editeur.general.titreQuestionnaire')}
          valeur={brouillon.titre}
          onChange={(langue, valeur) => actions.modifierGeneral('titre', langue, valeur)}
          invalide={titreInvalide}
        />
        <ChampBilingue
          libelle={t('questionnaires.editeur.general.messageAccueil')}
          valeur={brouillon.messageAccueil}
          onChange={(langue, valeur) => actions.modifierGeneral('messageAccueil', langue, valeur)}
          multiligne
        />
        <ChampBilingue
          libelle={t('questionnaires.editeur.general.messageRemerciement')}
          valeur={brouillon.messageRemerciement}
          onChange={(langue, valeur) =>
            actions.modifierGeneral('messageRemerciement', langue, valeur)
          }
          multiligne
        />

        <div className="editeur-questionnaire-champ">
          <label className="editeur-questionnaire-etiquette" htmlFor="editeur-langue-defaut">
            {t('questionnaires.editeur.general.langueDefaut')}
          </label>
          <select
            id="editeur-langue-defaut"
            className="editeur-questionnaire-select"
            value={brouillon.langueDefaut}
            onChange={(e) => actions.changerLangueDefaut(e.target.value === 'en' ? 'en' : 'fr')}
          >
            <option value="fr">{t('questionnaires.page.detail.langues.fr')}</option>
            <option value="en">{t('questionnaires.page.detail.langues.en')}</option>
          </select>
        </div>
      </section>

      <section className="editeur-questionnaire-section">
        <h2 className="editeur-questionnaire-section-titre">
          {t('questionnaires.editeur.questions.titre', { nombre: nombreQuestions })}
        </h2>

        {nombreQuestions === 0 ? (
          <p className="editeur-questionnaire-vide">{t('questionnaires.editeur.questions.aucune')}</p>
        ) : (
          <div className="editeur-questionnaire-questions">
            {brouillon.questions.map((question, indice) => (
              <CarteQuestion
                key={question.cle}
                question={question}
                indice={indice}
                total={nombreQuestions}
                limiteAtteinte={limiteAtteinte}
                themes={themes}
                erreurThemes={erreurThemes}
                actions={actions}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="editeur-questionnaire-ajouter"
          disabled={limiteAtteinte}
          onClick={actions.ajouterQuestion}
        >
          <IconeAjouter />
          <span>{t('questionnaires.editeur.questions.ajouter')}</span>
        </button>
        {limiteAtteinte && (
          <p className="editeur-questionnaire-limite">{t('questionnaires.editeur.questions.limite')}</p>
        )}
      </section>
    </div>
  )
}

export function PageEditeurQuestionnaire() {
  const { id } = useParams()
  const emplacement = useLocation()

  const idQuestionnaire = id === undefined || id === 'nouveau' ? null : id
  const creeAvant =
    typeof emplacement.state === 'object' &&
    emplacement.state !== null &&
    'questionnaireCree' in emplacement.state

  return (
    <EcranEditeur
      key={idQuestionnaire !== null ? idQuestionnaire : 'nouveau'}
      id={idQuestionnaire}
      creeAvant={creeAvant}
    />
  )
}