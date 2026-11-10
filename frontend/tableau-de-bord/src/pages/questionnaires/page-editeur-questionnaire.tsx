import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { IconeChevronGauche, IconeEnregistrer } from '../../composants-avis/icones-avis'
import { ApercuTelephone } from '../../composants-questionnaires/apercu-telephone'
import { CarrouselEditeur } from '../../composants-questionnaires/carrousel-editeur'
import type { Diapositive } from '../../composants-questionnaires/carrousel-editeur'
import { CarteQuestion } from '../../composants-questionnaires/carte-question'
import { ChampBilingue } from '../../composants-questionnaires/champ-bilingue'
import { HistoriqueVersions } from '../../composants-questionnaires/historique-versions'
import { IconeSupprimer } from '../../composants-questionnaires/icones-questionnaires'
import { PanneauPublication } from '../../composants-questionnaires/panneau-publication'
import type { ActionSuppression } from '../../hooks/utiliser-gestion-questionnaire'
import { utiliserGestionQuestionnaire } from '../../hooks/utiliser-gestion-questionnaire'
import {
  NOMBRE_MAX_QUESTIONS,
  utiliserEditeurQuestionnaire,
} from '../../hooks/utiliser-editeur-questionnaire'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserParametres } from '../../hooks/utiliser-parametres'
import { utiliserUtilisateur } from '../../hooks/utiliser-utilisateur'
import { utiliserVersionsQuestionnaire } from '../../hooks/utiliser-versions-questionnaire'
import type { ValeurContexteLangue } from '../../traductions/contexte-langue'
import { versApercuPublic } from '../../utilitaires/vers-apercu-public'
import '../../styles/editeur-questionnaire.css'
import '../../styles/publication-questionnaire.css'
import '../../styles/carrousel-editeur.css'

// Ecran E10 : editeur d'un questionnaire (jour 19, complete au jour 20).
// - /questionnaires/nouveau : questionnaire vide (une seule question d'etoiles au depart).
// - /questionnaires/<id> : modification d'un questionnaire de l'organisation.
// Seul le Responsable arrive ici ; les autres sont renvoyes a la liste.
// La page n'appelle pas l'API : tout vient des hooks (brouillon, themes et enregistrement avec
// utiliserEditeurQuestionnaire ; publication, dates, points de contact et suppression avec
// utiliserGestionQuestionnaire ; historique avec utiliserVersionsQuestionnaire). Elle assemble le
// formulaire general, les cartes de question, les messages, et garde ce qui est propre a l'ecran :
// le retour avec confirmation et l'avertissement a la fermeture de l'onglet quand des modifications
// ne sont pas enregistrees.
// Jour 20, a droite (sous le formulaire sur petit ecran) : l'apercu telephone, alimente par le
// brouillon a chaque frappe, avec le nom, le logo et la couleur de l'organisation.
// Sous le formulaire, une fois le questionnaire cree (jamais en mode creation) : le panneau de
// publication (publier ou activer, dates, points de contact) puis l'historique des versions.
// Apres chaque enregistrement du contenu, la fiche est relue : une nouvelle version a pu etre creee,
// et l'historique se relit tout seul quand la derniere version ou la date de modification change.
// Bouton Supprimer (questionnaire sans aucun avis seulement, suppression douce) : une confirmation
// du navigateur indique combien de points de contact lui seront retires ; si le serveur refuse
// parce que des avis existent, un message propose de le desactiver. Apres une suppression, la page
// revient a la liste avec { questionnaireSupprime: true } dans l'etat de navigation.
// Apres la CREATION, la page passe sur /questionnaires/<id> (sinon un deuxieme enregistrement
// creerait un autre questionnaire) et le message "Questionnaire cree." suit dans l'etat de navigation.
// Les hooks ne relisent rien si l'id change : l'ecran est recree avec key a chaque nouvel id.
// Jour 20, design : le formulaire n'est plus une longue page verticale. Un carrousel (composant
// CarrouselEditeur) montre une seule slide a la fois : General, une par question, puis Publication
// et Versions (questionnaire deja cree), avec des points numerotes et un bouton + pour ajouter une
// question. Sur grand ecran la page a la hauteur de la zone principale et ne defile plus
// (styles/carrousel-editeur.css) ; sur petit ecran elle defile comme avant. Rien d'autre ne change :
// memes hooks, memes messages, memes boutons.

const S = 'questionnaires.editeur.suppression.'

type Traduire = ValeurContexteLangue['t']

// Point de contact montre dans l'apercu : "Table 12", comme sur le chevalet d'un vrai client
const POINT_CONTACT_APERCU = { nom: '12', type: 'table' }

type PropsEcranEditeur = {
  // null = nouveau questionnaire
  id: string | null
  // Vrai si l'on arrive juste apres la creation de ce questionnaire
  creeAvant: boolean
}

// Texte du message quand la suppression echoue ; null s'il n'y a pas d'erreur
function texteErreurSuppression(t: Traduire, suppression: ActionSuppression): string | null {
  const { erreur, nombreAvis } = suppression
  if (erreur === null) {
    return null
  }
  if (nombreAvis !== null) {
    return t(`${S}erreurAvis`, { nombre: nombreAvis })
  }
  if (erreur.statut === 0) {
    return t('commun.erreurReseau')
  }
  if (erreur.statut === 403) {
    return t(`${S}erreurInterdit`)
  }
  if (erreur.statut === 404) {
    return t(`${S}erreurIntrouvable`)
  }
  return t(`${S}erreurGenerique`)
}

function EcranEditeur({ id, creeAvant }: PropsEcranEditeur) {
  const { t } = utiliserLangue()
  const navigate = useNavigate()
  const { utilisateur } = utiliserUtilisateur()
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

  // Publication, dates, points de contact et suppression (aucun appel tant que id vaut null)
  const gestion = utiliserGestionQuestionnaire(id)
  const ficheGestion = gestion.fiche

  // L'historique des versions se relit quand la derniere version ou la date de modification change
  const jeton =
    ficheGestion !== null && ficheGestion.version !== null
      ? `${ficheGestion.version.numero}|${ficheGestion.version.publie_le ?? ''}|${ficheGestion.modifie_le}`
      : ''
  const versions = utiliserVersionsQuestionnaire(id, jeton)

  // Nom, logo et couleur de l'organisation pour l'apercu (les parametres sont lus pour le Responsable)
  const { parametres } = utiliserParametres()
  const organisationUtilisateur = utilisateur !== null ? utilisateur.organisation : null
  const nomOrganisation =
    parametres !== null
      ? parametres.nom
      : organisationUtilisateur !== null
        ? organisationUtilisateur.nom
        : ''
  const logoOrganisation =
    parametres !== null
      ? parametres.logo_url
      : organisationUtilisateur !== null
        ? organisationUtilisateur.logo_url
        : null
  const couleurOrganisation = parametres !== null ? parametres.couleur_principale : null

  // Le questionnaire de l'apercu : le brouillon de l'editeur, tel que le verrait le client
  const donneesApercu =
    brouillon === null
      ? null
      : versApercuPublic(brouillon, {
          organisationNom: nomOrganisation,
          logoUrl: logoOrganisation,
          couleurPrincipale: couleurOrganisation,
          pointContactNom: POINT_CONTACT_APERCU.nom,
          pointContactType: POINT_CONTACT_APERCU.type,
        })

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
    if (questionnaireId === null) {
      return
    }
    if (id === null) {
      void navigate(`/questionnaires/${questionnaireId}`, {
        replace: true,
        state: { questionnaireCree: true },
      })
      return
    }
    // Une nouvelle version a pu etre creee : on relit la fiche (et, avec elle, l'historique)
    gestion.recharger()
  }

  async function gererSuppression(): Promise<void> {
    if (ficheGestion === null) {
      return
    }
    const nombrePoints = ficheGestion.points_contact.length
    let question = t(`${S}confirmer`)
    if (nombrePoints === 1) {
      question = t(`${S}confirmerPointUn`)
    } else if (nombrePoints > 1) {
      question = t(`${S}confirmerPointsMultiple`, { nombre: nombrePoints })
    }
    if (!window.confirm(question)) {
      return
    }
    const supprime = await gestion.suppression.supprimer()
    if (supprime) {
      void navigate('/questionnaires', { replace: true, state: { questionnaireSupprime: true } })
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

  if (erreurChargement !== null || brouillon === null || donneesApercu === null) {
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
  const erreurSuppression = texteErreurSuppression(t, gestion.suppression)

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

  // Slide General : le formulaire general du questionnaire (titre, messages, langue par defaut)
  const contenuGeneral = (
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
  )

  // Les slides, dans l'ordre : General, une par question, puis Publication et Versions
  // (seulement quand le questionnaire existe deja)
  const diapositives: Diapositive[] = [
    {
      cle: 'general',
      etiquette: t('questionnaires.editeur.carrousel.general'),
      libelle: t('questionnaires.editeur.general.titre'),
      genre: 'general',
      contenu: contenuGeneral,
    },
    ...brouillon.questions.map(
      (question, indice): Diapositive => ({
        cle: question.cle,
        etiquette: String(indice + 1),
        libelle: t('questionnaires.editeur.questions.numero', { numero: indice + 1 }),
        genre: 'question',
        contenu: (
          <CarteQuestion
            question={question}
            indice={indice}
            total={nombreQuestions}
            limiteAtteinte={limiteAtteinte}
            themes={themes}
            erreurThemes={erreurThemes}
            actions={actions}
          />
        ),
      }),
    ),
  ]
  if (id !== null) {
    const libellePublication = t('questionnaires.publication.titre')
    const libelleVersions = t('questionnaires.versions.titre')
    diapositives.push(
      {
        cle: 'publication',
        etiquette: libellePublication,
        libelle: libellePublication,
        genre: 'autre',
        contenu: <PanneauPublication gestion={gestion} nonEnregistre={nonEnregistre} />,
      },
      {
        cle: 'versions',
        etiquette: libelleVersions,
        libelle: libelleVersions,
        genre: 'autre',
        contenu: <HistoriqueVersions resultat={versions} />,
      },
    )
  }

  // Petit texte sous les points : la limite atteinte, ou l'absence de question
  const indicationQuestions = limiteAtteinte
    ? t('questionnaires.editeur.questions.limite')
    : nombreQuestions === 0
      ? t('questionnaires.editeur.questions.aucune')
      : null

  return (
    <div className="editeur-questionnaire editeur-questionnaire--avec-apercu editeur-questionnaire--carrousel">
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
        {id !== null && (
          <button
            type="button"
            className="editeur-questionnaire-supprimer"
            disabled={ficheGestion === null || gestion.suppression.enCours || enregistrement.enCours}
            onClick={() => void gererSuppression()}
          >
            <IconeSupprimer />
            <span>{gestion.suppression.enCours ? t(`${S}enCours`) : t(`${S}supprimer`)}</span>
          </button>
        )}
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
      {erreurSuppression !== null && (
        <p className="editeur-questionnaire-message editeur-questionnaire-message--erreur" role="alert">
          {erreurSuppression}
        </p>
      )}
      {messageReussite !== null && (
        <p className="editeur-questionnaire-message editeur-questionnaire-message--succes" role="status">
          {messageReussite}
        </p>
      )}

      <div className="editeur-questionnaire-disposition">
        <div className="editeur-questionnaire-colonne">
          <CarrouselEditeur
            diapositives={diapositives}
            libelleNavigation={t('questionnaires.editeur.carrousel.navigation')}
            libelleAjouter={t('questionnaires.editeur.questions.ajouter')}
            onAjouter={actions.ajouterQuestion}
            ajoutDesactive={limiteAtteinte}
            indication={indicationQuestions}
          />
        </div>

        <div className="editeur-questionnaire-colonne editeur-questionnaire-colonne-apercu">
          <ApercuTelephone donnees={donneesApercu} langue={brouillon.langueDefaut} />
        </div>
      </div>
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