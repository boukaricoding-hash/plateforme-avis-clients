import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Route, Routes, useParams } from 'react-router'
import {
  creerBrouillonVide,
  effacerBrouillon,
  lireBrouillon,
  sauverBrouillon,
} from './brouillon-hors-connexion/brouillon'
import type { Brouillon } from './brouillon-hors-connexion/brouillon'
import { utiliserLangue } from './hooks/utiliser-langue'
import { utiliserQuestionnaire } from './hooks/utiliser-questionnaire'
import { EcranLancement } from './pages/0-lancement/ecran-lancement'
import { EcranAccueil } from './pages/1-accueil-questionnaire/ecran-accueil'
import { EcranQuestion } from './pages/2-ecran-question/ecran-question'
import { EcranCommentaire } from './pages/3-commentaire-coordonnees/ecran-commentaire'
import { EcranRemerciement } from './pages/4-remerciement/ecran-remerciement'
import { EcranErreur } from './pages/5-pages-erreur/ecran-erreur'
import { ErreurService, envoyerAvis } from './services/api-public'
import type {
  CorpsAvis,
  QuestionnairePublic,
  ReponseEnvoyee,
  ValeurReponse,
} from './types/avis-public'
import { aUneReponse } from './utilitaires/reponse-donnee'

type Ecran = 'accueil' | 'questions' | 'commentaire' | 'merci'

// Delai entre deux essais d'envoi automatiques quand le reseau est coupe.
const DELAI_RENVOI_MS = 10000

// Corps envoye au backend, construit a partir du brouillon.
// Les coordonnees ne partent que si la case de consentement est cochee.
function construireCorps(brouillon: Brouillon): CorpsAvis {
  const reponses: ReponseEnvoyee[] = []
  for (const [questionId, valeur] of Object.entries(brouillon.reponses)) {
    if (aUneReponse(valeur)) {
      reponses.push({ question_id: questionId, valeur })
    }
  }

  const corps: CorpsAvis = {
    version_id: brouillon.version_id,
    langue: brouillon.langue,
    reponses,
    cle_unique: brouillon.cle_unique,
  }

  const commentaire = brouillon.commentaire.trim()
  if (commentaire !== '') {
    corps.commentaire = commentaire
  }

  const nom = brouillon.contact_nom.trim()
  const telephone = brouillon.contact_tel.trim()
  const email = brouillon.contact_email.trim()
  if (brouillon.consentement && (nom !== '' || telephone !== '' || email !== '')) {
    corps.consentement = true
    if (nom !== '') {
      corps.contact_nom = nom
    }
    if (telephone !== '') {
      corps.contact_tel = telephone
    }
    if (email !== '') {
      corps.contact_email = email
    }
  }

  return corps
}

type ProprietesParcours = {
  code: string
  donnees: QuestionnairePublic
  // Vrai quand l'ecran d'ouverture est fini : l'accueil peut alors faire son entree.
  lancementFini: boolean
}

// Parcours du client une fois le questionnaire charge :
// accueil -> questions -> commentaire et coordonnees -> remerciement.
// Tout est garde dans un brouillon sur le telephone, avec la cle unique de l'envoi.
function ParcoursAvis({ code, donnees, lancementFini }: ProprietesParcours) {
  const { langue } = utiliserLangue()
  const versionId = donnees.questionnaire.version_id
  const nombreQuestions = donnees.questionnaire.questions.length

  const [brouillon, setBrouillon] = useState<Brouillon>(
    () => lireBrouillon(code, versionId) ?? creerBrouillonVide(versionId, langue),
  )
  // Un envoi interrompu (page rechargee, reseau coupe) reprend directement sur E3.
  const [ecran, setEcran] = useState<Ecran>(() =>
    brouillon.envoi_en_attente ? 'commentaire' : 'accueil',
  )
  const [departQuestions, setDepartQuestions] = useState(0)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [message, setMessage] = useState<'hors_connexion' | 'echec' | null>(null)
  const [erreurEnvoi, setErreurEnvoi] = useState<ErreurService | null>(null)

  // Empeche deux envois en meme temps (double clic, renvoi automatique).
  const envoiRef = useRef(false)
  const brouillonRef = useRef(brouillon)
  useEffect(() => {
    brouillonRef.current = brouillon
  }, [brouillon])

  // Le brouillon est garde a chaque changement, sauf une fois l'avis envoye ou refuse.
  useEffect(() => {
    if (ecran !== 'merci' && erreurEnvoi === null) {
      sauverBrouillon(code, brouillon)
    }
  }, [code, brouillon, ecran, erreurEnvoi])

  const lancerEnvoi = useCallback(
    async (aEnvoyer: Brouillon) => {
      if (envoiRef.current) {
        return
      }
      envoiRef.current = true
      setEnvoiEnCours(true)
      try {
        await envoyerAvis(code, construireCorps(aEnvoyer))
        effacerBrouillon(code)
        setMessage(null)
        setEcran('merci')
      } catch (erreurBrute) {
        const erreur =
          erreurBrute instanceof ErreurService
            ? erreurBrute
            : new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)

        if (erreur.code === 'HORS_CONNEXION') {
          // Le brouillon reste en attente : renvoi automatique avec la meme cle.
          setMessage('hors_connexion')
        } else if (erreur.code === 'AVIS_INVALIDE' || erreur.code === 'VERSION_INVALIDE') {
          // Le client peut corriger : on arrete le renvoi automatique.
          setMessage('echec')
          setBrouillon((avant) => ({ ...avant, envoi_en_attente: false }))
        } else if (
          erreur.code === 'TROP_DE_REQUETES' ||
          erreur.code === 'ERREUR_INCONNUE' ||
          erreur.statut >= 500
        ) {
          // Panne passagere : page d'erreur avec Reessayer, brouillon garde.
          setErreurEnvoi(erreur)
        } else {
          // QR desactive, avis deja donne, evenement termine... : rien a renvoyer.
          effacerBrouillon(code)
          setErreurEnvoi(erreur)
        }
      } finally {
        envoiRef.current = false
        setEnvoiEnCours(false)
      }
    },
    [code],
  )

  // A l'ouverture : un envoi qui etait en attente repart tout de suite.
  useEffect(() => {
    if (brouillonRef.current.envoi_en_attente) {
      void lancerEnvoi(brouillonRef.current)
    }
  }, [lancerEnvoi])

  // Envoi en attente : renvoi des que le reseau revient, puis toutes les 10 secondes.
  const enAttente = brouillon.envoi_en_attente
  useEffect(() => {
    if (!enAttente || ecran !== 'commentaire' || erreurEnvoi !== null) {
      return undefined
    }
    const essayer = () => {
      void lancerEnvoi(brouillonRef.current)
    }
    window.addEventListener('online', essayer)
    const minuteur =
      message === 'hors_connexion' ? window.setInterval(essayer, DELAI_RENVOI_MS) : undefined
    return () => {
      window.removeEventListener('online', essayer)
      if (minuteur !== undefined) {
        window.clearInterval(minuteur)
      }
    }
  }, [enAttente, ecran, erreurEnvoi, message, lancerEnvoi])

  function changerReponse(questionId: string, valeur: ValeurReponse) {
    setBrouillon((avant) => ({
      ...avant,
      reponses: { ...avant.reponses, [questionId]: valeur },
    }))
  }

  function envoyer() {
    const pret: Brouillon = { ...brouillon, langue, envoi_en_attente: true }
    setBrouillon(pret)
    // Garde tout de suite : si la page se ferme pendant l'envoi, il reprendra.
    sauverBrouillon(code, pret)
    void lancerEnvoi(pret)
  }

  function reessayerApresErreur() {
    setErreurEnvoi(null)
    void lancerEnvoi(brouillonRef.current)
  }

  function retourVersQuestions() {
    setBrouillon((avant) => ({ ...avant, envoi_en_attente: false }))
    setMessage(null)
    setDepartQuestions(Math.max(nombreQuestions - 1, 0))
    setEcran('questions')
  }

  if (erreurEnvoi !== null) {
    return <EcranErreur erreur={erreurEnvoi} reessayer={reessayerApresErreur} />
  }

  if (ecran === 'accueil') {
    return (
      <EcranAccueil
        donnees={donnees}
        entreeActive={lancementFini}
        commencer={() => {
          setDepartQuestions(0)
          setEcran('questions')
        }}
      />
    )
  }

  if (ecran === 'questions') {
    return (
      <EcranQuestion
        donnees={donnees}
        reponses={brouillon.reponses}
        changerReponse={changerReponse}
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
        envoyer={envoyer}
        retour={retourVersQuestions}
        envoiEnCours={envoiEnCours}
        message={message}
      />
    )
  }

  return <EcranRemerciement donnees={donnees} />
}

type ProprietesPageAvis = {
  code: string | undefined
}

// Page d'avis d'un QR code : ecran d'ouverture anime des le scan, erreur (E5), puis le parcours.
function PageAvis({ code }: ProprietesPageAvis) {
  const { etat, recharger } = utiliserQuestionnaire(code)

  // L'ecran d'ouverture ne se joue qu'une fois par scan.
  const [lancementFini, setLancementFini] = useState(false)
  const terminerLancement = useCallback(() => setLancementFini(true), [])

  // Pas d'ecran d'ouverture si le QR est inconnu ou en erreur : on montre l'erreur tout de suite.
  const afficherLancement = !lancementFini && etat.statut !== 'erreur' && code !== undefined

  let contenu: ReactNode = null
  if (etat.statut === 'erreur' || code === undefined) {
    const erreur =
      etat.statut === 'erreur'
        ? etat.erreur
        : new ErreurService(404, 'QR_INCONNU', 'Code absent.', null)
    contenu = <EcranErreur erreur={erreur} reessayer={recharger} />
  } else if (etat.statut === 'pret') {
    contenu = <ParcoursAvis code={code} donnees={etat.donnees} lancementFini={lancementFini} />
  }

  // Le parcours se charge en dessous de l'ecran d'ouverture, qui s'efface pour le reveler.
  // L'ecran d'ouverture garde toujours la meme place ici : son animation ne repart pas a zero.
  return (
    <>
      {contenu}
      {afficherLancement && (
        <EcranLancement
          organisation={etat.statut === 'pret' ? etat.donnees.organisation : null}
          terminer={terminerLancement}
        />
      )}
    </>
  )
}

// La cle remet tout a zero si le code du QR change dans l'adresse.
function RouteAvis() {
  const { code } = useParams()
  return <PageAvis key={code} code={code} />
}

function PageIntrouvable() {
  const { t } = utiliserLangue()
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg text-slate-600">{t('erreur.qrInconnu.message')}</p>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/q/:code" element={<RouteAvis />} />
      <Route path="*" element={<PageIntrouvable />} />
    </Routes>
  )
}

export default App