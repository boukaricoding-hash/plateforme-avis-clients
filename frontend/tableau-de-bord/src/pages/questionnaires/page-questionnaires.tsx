import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { IconeRecherche } from '../../composants-avis/icones-avis'
import { ChoixModele } from '../../composants-questionnaires/choix-modele'
import { DetailQuestionnaire } from '../../composants-questionnaires/detail-questionnaire'
import { GrapheQuestionnaires } from '../../composants-questionnaires/graphe-questionnaires'
import { HistogrammeTypes } from '../../composants-questionnaires/histogramme-types'
import { PaletteRecherche } from '../../composants-questionnaires/palette-recherche'
import { PanneauStats, SqueletteStats } from '../../composants-questionnaires/panneau-stats'
import { utiliserFicheQuestionnaire } from '../../hooks/utiliser-fiche-questionnaire'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ActionSuppressionListe } from '../../hooks/utiliser-liste-questionnaires'
import { utiliserListeQuestionnaires } from '../../hooks/utiliser-liste-questionnaires'
import { utiliserUtilisateur } from '../../hooks/utiliser-utilisateur'
import type { ErreurService } from '../../services/api'
import '../../styles/questionnaires.css'
import type { ValeurContexteLangue } from '../../traductions/contexte-langue'
import type {
  QuestionQuestionnaire,
  ResumeQuestionnaire,
  StatutQuestionnaire,
} from '../../types/questionnaires'

// Ecran E10 : liste des questionnaires (jour 19, design de la page Classes).
// - Le Responsable cree un questionnaire vide, part d'un modele de son secteur, duplique ou
//   supprime un questionnaire et ouvre l'editeur pour le modifier.
// - Le Gestionnaire consulte la liste et le detail, en lecture seule (aucun bouton d'action).
// - L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// La page n'appelle pas l'API : tout vient des deux hooks (la liste, puis la fiche du questionnaire
// selectionne). Elle assemble les composants et garde ce qui est propre a l'ecran :
// le statut ouvert dans le graphe, la selection, le panneau des modeles et la palette de recherche.
// Mise en page : a gauche le graphe (ou le panneau des modeles, qui prend sa place) et les
// statistiques ; a droite le detail du questionnaire selectionne et l'histogramme de ses questions.
// Ctrl K (ou Cmd K) ou le bouton "Rechercher" ouvre la palette de recherche.
// Suppression (menu ... du detail, jour 20) : une confirmation du navigateur indique combien de
// points de contact seront retires, puis le questionnaire disparait de la liste. Le serveur la
// refuse s'il a deja des avis : un message propose alors de le desactiver. La page recoit aussi
// { questionnaireSupprime: true } quand l'editeur vient de supprimer un questionnaire.
// L'editeur est une autre page : /questionnaires/nouveau pour un questionnaire vide,
// /questionnaires/<id> pour modifier un questionnaire existant.

// Liste vide commune : evite de recreer un tableau a chaque affichage
const AUCUNE_QUESTION: QuestionQuestionnaire[] = []

// Message d'une erreur : pas de reseau (statut 0) ou texte general
function messageErreur(erreur: ErreurService, cleGenerale: string, t: (cle: string) => string): string {
  return erreur.statut === 0 ? t('commun.erreurReseau') : t(cleGenerale)
}

type Traduire = ValeurContexteLangue['t']

// Textes de la suppression : les memes que dans l'editeur
const S = 'questionnaires.editeur.suppression.'

// Texte du message quand la suppression echoue ; null s'il n'y a pas d'erreur
function texteErreurSuppression(t: Traduire, suppression: ActionSuppressionListe): string | null {
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

type ProprietesEntete = {
  // Faux tant que la liste n'est pas chargee : la recherche n'a rien a chercher.
  rechercheActive: boolean
  onRechercher: () => void
}

function Entete({ rechercheActive, onRechercher }: ProprietesEntete) {
  const { t } = utiliserLangue()

  return (
    <div className="questionnaires-entete">
      <div>
        <h1 className="questionnaires-titre">{t('questionnaires.titre')}</h1>
        <p className="questionnaires-soustitre">{t('questionnaires.sousTitre')}</p>
      </div>
      <button
        type="button"
        className="questionnaires-raccourci-palette"
        title={t('questionnaires.page.rechercherTitre')}
        disabled={!rechercheActive}
        onClick={onRechercher}
      >
        <IconeRecherche />
        <span>{t('questionnaires.page.rechercher')}</span>
        <kbd>Ctrl K</kbd>
      </button>
    </div>
  )
}

function BandeauErreur({ message, onReessayer }: { message: string; onReessayer: () => void }) {
  const { t } = utiliserLangue()

  return (
    <div className="questionnaires-erreur-globale" role="alert">
      <span>{message}</span>
      <button type="button" className="questionnaires-reessayer" onClick={onReessayer}>
        {t('questionnaires.page.reessayer')}
      </button>
    </div>
  )
}

export function PageQuestionnaires() {
  const { t } = utiliserLangue()
  const navigate = useNavigate()
  const emplacement = useLocation()
  const { utilisateur } = utiliserUtilisateur()
  const {
    acces,
    peutModifier,
    questionnaires,
    chargement,
    erreur,
    modeles,
    chargementModeles,
    erreurModeles,
    recharger,
    clonage,
    duplication,
    suppression,
  } = utiliserListeQuestionnaires()

  const [statutOuvert, setStatutOuvert] = useState<StatutQuestionnaire | null>(null)
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [choixModeleOuvert, setChoixModeleOuvert] = useState(false)
  const [paletteOuverte, setPaletteOuverte] = useState(false)
  // Vrai juste apres une duplication reussie : affiche le message de confirmation
  const [copieFaite, setCopieFaite] = useState(false)
  // Vrai juste apres une suppression reussie (ici, ou dans l'editeur) : message de confirmation
  const [suppressionFaite, setSuppressionFaite] = useState(
    () =>
      typeof emplacement.state === 'object' &&
      emplacement.state !== null &&
      'questionnaireSupprime' in emplacement.state,
  )

  const ficheSelection = utiliserFicheQuestionnaire(selectionId)

  // Raccourci Ctrl K (Cmd K sur Mac) : ouvre la palette quand la liste est chargee
  const listeChargee = questionnaires !== null
  useEffect(() => {
    if (!listeChargee) {
      return
    }

    function gererTouche(evenement: KeyboardEvent): void {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 'k') {
        evenement.preventDefault()
        setPaletteOuverte(true)
      }
    }

    document.addEventListener('keydown', gererTouche)
    return () => document.removeEventListener('keydown', gererTouche)
  }, [listeChargee])

  // L'administrateur DTS n'a pas d'organisation : rien a gerer ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  function choisirQuestionnaire(id: string | null): void {
    setCopieFaite(false)
    setSuppressionFaite(false)
    setSelectionId(id)
  }

  // Un clic sur un statut ouvre ses questionnaires ; un second clic les referme.
  function basculerStatut(statut: StatutQuestionnaire): void {
    setStatutOuvert((actuel) => (actuel === statut ? null : statut))
  }

  // Choix dans la palette : on ouvre le statut du questionnaire et on le selectionne.
  function choisirDepuisPalette(questionnaire: ResumeQuestionnaire): void {
    setPaletteOuverte(false)
    setChoixModeleOuvert(false)
    setStatutOuvert(questionnaire.statut)
    choisirQuestionnaire(questionnaire.id)
  }

  // La copie est un nouveau brouillon : on l'ouvre dans le graphe et on la selectionne.
  async function dupliquer(id: string): Promise<void> {
    setCopieFaite(false)
    setSuppressionFaite(false)
    const copieId = await duplication.dupliquer(id)
    if (copieId === null) {
      return
    }
    setChoixModeleOuvert(false)
    setStatutOuvert('BROUILLON')
    setSelectionId(copieId)
    setCopieFaite(true)
  }

  // Suppression douce, sans avis seulement : confirmation, puis le questionnaire quitte la liste.
  // Si le serveur refuse (des avis existent), le message d'erreur propose de le desactiver.
  async function supprimer(id: string): Promise<void> {
    setCopieFaite(false)
    setSuppressionFaite(false)
    const nombrePoints = questionnaires?.find((q) => q.id === id)?.nombre_points_contact ?? 0
    let question = t(`${S}confirmer`)
    if (nombrePoints === 1) {
      question = t(`${S}confirmerPointUn`)
    } else if (nombrePoints > 1) {
      question = t(`${S}confirmerPointsMultiple`, { nombre: nombrePoints })
    }
    if (!window.confirm(question)) {
      return
    }
    const supprime = await suppression.supprimer(id)
    if (!supprime) {
      return
    }
    setSelectionId(null)
    setSuppressionFaite(true)
  }

  // Apres un clonage reussi, on ouvre l'editeur sur la copie.
  async function choisirModele(modeleId: string): Promise<void> {
    const copieId = await clonage.cloner(modeleId)
    if (copieId !== null) {
      void navigate(`/questionnaires/${copieId}`)
    }
  }

  function ouvrirEditeur(id: string): void {
    void navigate(`/questionnaires/${id}`)
  }

  // Chargement de la liste : meme mise en page, avec des squelettes
  if (chargement) {
    return (
      <div className="questionnaires">
        <Entete rechercheActive={false} onRechercher={() => undefined} />
        <div className="questionnaires-corps" aria-busy="true">
          <div className="questionnaires-gauche">
            <div
              className="questionnaires-graphe questionnaires-squelette-graphe-principal"
              role="status"
              aria-label={t('questionnaires.chargement')}
            >
              <div aria-hidden="true" className="questionnaires-squelette-graphe-contenu">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="questionnaires-squelette-ligne"
                    style={{ height: 20, width: `${88 - i * 12}%`, animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
            </div>
            <SqueletteStats />
          </div>
          <div className="questionnaires-droite">
            <DetailQuestionnaire
              selectionId={null}
              fiche={null}
              chargement={false}
              erreur={false}
              peutModifier={false}
              duplicationEnCours={false}
              suppressionEnCours={false}
              onReessayer={() => undefined}
              onModifier={() => undefined}
              onDupliquer={() => undefined}
              onSupprimer={() => undefined}
            />
          </div>
        </div>
      </div>
    )
  }

  // La liste n'a pas pu etre chargee et rien n'est a afficher : message et bouton "Reessayer"
  if (questionnaires === null) {
    return (
      <div className="questionnaires">
        <Entete rechercheActive={false} onRechercher={() => undefined} />
        <BandeauErreur
          message={erreur !== null ? messageErreur(erreur, 'questionnaires.erreur', t) : t('questionnaires.erreur')}
          onReessayer={recharger}
        />
      </div>
    )
  }

  const questionsSelection = ficheSelection.fiche?.version?.questions ?? AUCUNE_QUESTION

  return (
    <div className="questionnaires">
      <Entete rechercheActive={true} onRechercher={() => setPaletteOuverte(true)} />

      {!peutModifier && <div className="questionnaires-lecture-seule">{t('questionnaires.lectureSeule')}</div>}

      {erreur !== null && (
        <BandeauErreur message={messageErreur(erreur, 'questionnaires.erreur', t)} onReessayer={recharger} />
      )}

      {duplication.erreur !== null && (
        <div className="questionnaires-erreur-globale" role="alert">
          {messageErreur(duplication.erreur, 'questionnaires.duplication.erreur', t)}
        </div>
      )}

      {copieFaite && (
        <div className="questionnaires-message-succes" role="status">
          {t('questionnaires.duplication.reussie')}
        </div>
      )}

      {suppression.erreur !== null && (
        <div className="questionnaires-erreur-globale" role="alert">
          {texteErreurSuppression(t, suppression)}
        </div>
      )}

      {suppressionFaite && (
        <div className="questionnaires-message-succes" role="status">
          {t(`${S}reussie`)}
        </div>
      )}

      {questionnaires.length === 0 && (
        <div className="questionnaires-liste-vide">
          <span>{t('questionnaires.liste.vide')}</span>
          {peutModifier && <span className="questionnaires-liste-vide-aide">{t('questionnaires.liste.videAide')}</span>}
        </div>
      )}

      <div className="questionnaires-corps">
        <div className="questionnaires-gauche">
          <div className="questionnaires-graphe">
            {choixModeleOuvert && peutModifier ? (
              <ChoixModele
                modeles={modeles}
                chargement={chargementModeles}
                erreur={erreurModeles}
                clonageEnCours={clonage.enCours}
                erreurClonage={clonage.erreur}
                onChoisir={(modeleId) => {
                  void choisirModele(modeleId)
                }}
                onReessayer={recharger}
                onFermer={() => setChoixModeleOuvert(false)}
              />
            ) : (
              <GrapheQuestionnaires
                questionnaires={questionnaires}
                nomOrganisation={utilisateur?.organisation?.nom ?? null}
                statutOuvert={statutOuvert}
                selectionId={selectionId}
                peutModifier={peutModifier}
                duplicationEnCours={duplication.enCours}
                onBasculerStatut={basculerStatut}
                onSelectionner={choisirQuestionnaire}
                onNouveauVide={() => ouvrirEditeur('nouveau')}
                onChoisirModele={() => setChoixModeleOuvert(true)}
                onDupliquer={() => {
                  if (selectionId !== null) {
                    void dupliquer(selectionId)
                  }
                }}
              />
            )}
          </div>

          <PanneauStats questionnaires={questionnaires} />
        </div>

        <div className="questionnaires-droite">
          <DetailQuestionnaire
            selectionId={selectionId}
            fiche={ficheSelection.fiche}
            chargement={ficheSelection.chargement}
            erreur={ficheSelection.erreur !== null}
            peutModifier={peutModifier}
            duplicationEnCours={duplication.enCours}
            suppressionEnCours={suppression.enCours}
            onReessayer={ficheSelection.recharger}
            onModifier={ouvrirEditeur}
            onDupliquer={(id) => {
              void dupliquer(id)
            }}
            onSupprimer={(id) => {
              void supprimer(id)
            }}
          />

          {selectionId !== null && ficheSelection.erreur === null && (
            <HistogrammeTypes questions={questionsSelection} chargement={ficheSelection.chargement} />
          )}
        </div>
      </div>

      {paletteOuverte && (
        <PaletteRecherche
          questionnaires={questionnaires}
          onFermer={() => setPaletteOuverte(false)}
          onSelection={choisirDepuisPalette}
        />
      )}
    </div>
  )
}