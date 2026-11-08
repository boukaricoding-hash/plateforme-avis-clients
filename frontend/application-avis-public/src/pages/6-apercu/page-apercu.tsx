import { useCallback, useEffect, useRef, useState } from 'react'
import { creerBrouillonVide } from '../../brouillon-hors-connexion/brouillon'
import type { Brouillon } from '../../brouillon-hors-connexion/brouillon'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { Langue, QuestionnairePublic, ValeurReponse } from '../../types/avis-public'
import { EcranAccueil } from '../1-accueil-questionnaire/ecran-accueil'
import { EcranQuestion } from '../2-ecran-question/ecran-question'
import { EcranCommentaire } from '../3-commentaire-coordonnees/ecran-commentaire'
import { EcranRemerciement } from '../4-remerciement/ecran-remerciement'

// Apercu du questionnaire (jour 20), a l'adresse /apercu.
// Cette page est faite pour etre affichee dans un cadre de telephone du tableau de bord (iframe).
// Elle rejoue le parcours du client avec les VRAIS ecrans de la page d'avis :
// accueil -> questions -> commentaire et coordonnees -> remerciement.
// Elle n'appelle jamais l'API : pas de scan compte, pas d'avis envoye, pas de brouillon garde
// sur le telephone. Le bouton Envoyer mene simplement au remerciement.
//
// Echanges avec la page qui contient l'iframe (le tableau de bord), par postMessage :
// - apercu -> tableau de bord : { type: 'apercu-pret' } des que la page ecoute ;
// - tableau de bord -> apercu : { type: 'apercu-donnees', donnees, langue } avec le questionnaire
//   au format de l'API publique (QuestionnairePublic), a chaque modification du brouillon ;
// - tableau de bord -> apercu : { type: 'apercu-recommencer' } pour revenir a l'accueil.
// Seuls les messages venant de la page parente sont pris en compte.

type Ecran = 'accueil' | 'questions' | 'commentaire' | 'merci'

const MESSAGE_PRET = 'apercu-pret'
const MESSAGE_DONNEES = 'apercu-donnees'
const MESSAGE_RECOMMENCER = 'apercu-recommencer'

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

function estTexte(valeur: unknown): boolean {
  return estObjet(valeur) && typeof valeur.fr === 'string'
}

// Verifie le minimum dont les ecrans ont besoin pour ne pas planter ; renvoie null si c'est incomplet.
function versDonnees(valeur: unknown): QuestionnairePublic | null {
  if (!estObjet(valeur)) {
    return null
  }
  const { point_contact, organisation, questionnaire } = valeur
  if (!estObjet(point_contact) || typeof point_contact.nom !== 'string') {
    return null
  }
  if (!estObjet(organisation) || typeof organisation.nom !== 'string') {
    return null
  }
  if (!estObjet(questionnaire)) {
    return null
  }
  const { version_id, titre, questions } = questionnaire
  if (typeof version_id !== 'string' || !estTexte(titre) || !Array.isArray(questions)) {
    return null
  }
  for (const question of questions) {
    if (
      !estObjet(question) ||
      typeof question.id !== 'string' ||
      typeof question.type !== 'string' ||
      !estTexte(question.libelle) ||
      typeof question.obligatoire !== 'boolean'
    ) {
      return null
    }
  }
  return valeur as QuestionnairePublic
}

export function PageApercu() {
  const { changerLangue } = utiliserLangue()
  const [donnees, setDonnees] = useState<QuestionnairePublic | null>(null)
  const [ecran, setEcran] = useState<Ecran>('accueil')
  const [departQuestions, setDepartQuestions] = useState(0)
  const [reponses, setReponses] = useState<Record<string, ValeurReponse>>({})
  const [brouillon, setBrouillon] = useState<Brouillon>(() => creerBrouillonVide('apercu', 'fr'))
  // Derniere langue demandee par le tableau de bord : on ne l'applique que si elle change,
  // pour ne pas effacer un choix de langue fait dans l'apercu a chaque modification du brouillon.
  const langueDemandeeRef = useRef<string | null>(null)

  const recommencer = useCallback(() => {
    setEcran('accueil')
    setDepartQuestions(0)
    setReponses({})
    setBrouillon(creerBrouillonVide('apercu', 'fr'))
  }, [])

  useEffect(() => {
    function recevoir(evenement: MessageEvent): void {
      // Seule la page qui contient l'apercu peut lui parler.
      if (evenement.source !== window.parent) {
        return
      }
      const message: unknown = evenement.data
      if (!estObjet(message)) {
        return
      }

      if (message.type === MESSAGE_RECOMMENCER) {
        recommencer()
        return
      }
      if (message.type !== MESSAGE_DONNEES) {
        return
      }

      const nouvelles = versDonnees(message.donnees)
      if (nouvelles === null) {
        return
      }
      setDonnees(nouvelles)

      const langueRecue = message.langue
      const langueDemandee: Langue | null =
        langueRecue === 'en' || langueRecue === 'fr' ? langueRecue : null
      if (langueDemandee !== null && langueDemandee !== langueDemandeeRef.current) {
        langueDemandeeRef.current = langueDemandee
        changerLangue(langueDemandee)
      }
    }

    window.addEventListener('message', recevoir)
    // Dit au tableau de bord que l'apercu est pret a recevoir le questionnaire.
    window.parent.postMessage({ type: MESSAGE_PRET }, '*')
    return () => window.removeEventListener('message', recevoir)
  }, [changerLangue, recommencer])

  // En attendant le questionnaire : une page vide, sans texte.
  if (donnees === null) {
    return <main className="min-h-svh" aria-busy="true" />
  }

  const nombreQuestions = donnees.questionnaire.questions.length

  if (ecran === 'accueil') {
    return (
      <EcranAccueil
        donnees={donnees}
        entreeActive
        commencer={() => {
          setDepartQuestions(0)
          setEcran('questions')
        }}
      />
    )
  }

  if (ecran === 'questions') {
    // La cle repart de zero si des questions sont ajoutees ou retirees (la position affichee
    // pourrait sinon sortir de la liste) ; un simple changement de texte ne remet rien a zero.
    const cleStructure = donnees.questionnaire.questions.map((question) => question.id).join('|')
    return (
      <EcranQuestion
        key={cleStructure}
        donnees={donnees}
        reponses={reponses}
        changerReponse={(questionId, valeur) =>
          setReponses((avant) => ({ ...avant, [questionId]: valeur }))
        }
        retourAccueil={() => setEcran('accueil')}
        terminer={() => setEcran('commentaire')}
        indexInitial={departQuestions}
      />
    )
  }

  if (ecran === 'commentaire') {
    return (
      <EcranCommentaire
        brouillon={brouillon}
        changer={(partiel) => setBrouillon((avant) => ({ ...avant, ...partiel }))}
        envoyer={() => setEcran('merci')}
        retour={() => {
          setDepartQuestions(Math.max(nombreQuestions - 1, 0))
          setEcran('questions')
        }}
        envoiEnCours={false}
        message={null}
      />
    )
  }

  return <EcranRemerciement donnees={donnees} />
}