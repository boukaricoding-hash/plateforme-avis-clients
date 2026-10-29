import { useState } from 'react'
import { Route, Routes, useParams } from 'react-router'
import { utiliserLangue } from './hooks/utiliser-langue'
import { utiliserQuestionnaire } from './hooks/utiliser-questionnaire'
import { EcranAccueil } from './pages/1-accueil-questionnaire/ecran-accueil'
import { EcranQuestion } from './pages/2-ecran-question/ecran-question'
import type { ReponsesParQuestion } from './pages/2-ecran-question/ecran-question'
import type { ValeurReponse } from './types/avis-public'

type Ecran = 'accueil' | 'questions' | 'fin'

type ProprietesPageAvis = {
  code: string | undefined
}

// Page d'avis d'un QR code : chargement, erreur, puis E1 -> E2.
// Les reponses sont gardees ici : elles survivent a Retour et au changement d'ecran.
function PageAvis({ code }: ProprietesPageAvis) {
  const { t } = utiliserLangue()
  const { etat } = utiliserQuestionnaire(code)
  const [ecran, setEcran] = useState<Ecran>('accueil')
  const [reponses, setReponses] = useState<ReponsesParQuestion>({})

  function changerReponse(questionId: string, valeur: ValeurReponse) {
    setReponses((avant) => ({ ...avant, [questionId]: valeur }))
  }

  if (etat.statut === 'chargement') {
    return (
      <main className="flex min-h-svh items-center justify-center p-6 text-center">
        <p className="text-lg text-slate-600">{t('commun.chargement')}</p>
      </main>
    )
  }

  if (etat.statut === 'erreur') {
    // Provisoire : le jour 10 remplace ceci par les pages d'erreur claires (E5).
    // Le code d'erreur est affiche pour confirmer les codes du backend.
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg text-slate-800">{etat.erreur.message}</p>
        <p className="font-mono text-sm text-slate-500">
          {etat.erreur.code} ({etat.erreur.statut})
        </p>
      </main>
    )
  }

  const donnees = etat.donnees

  if (ecran === 'accueil') {
    return <EcranAccueil donnees={donnees} commencer={() => setEcran('questions')} />
  }

  if (ecran === 'questions') {
    return (
      <EcranQuestion
        donnees={donnees}
        reponses={reponses}
        changerReponse={changerReponse}
        retourAccueil={() => setEcran('accueil')}
        terminer={() => setEcran('fin')}
      />
    )
  }

  // Provisoire : le jour 10 branche ici l'ecran E3 (commentaire, coordonnees, envoi).
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-lg text-slate-800">
        Fin des questions ({Object.keys(reponses).length} réponses). L'envoi arrive au jour 10.
      </p>
      <button
        type="button"
        onClick={() => setEcran('questions')}
        className="flex h-14 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-8 text-lg font-semibold text-slate-700"
      >
        {t('question.retour')}
      </button>
    </main>
  )
}

// La cle remet les reponses a zero si le code du QR change dans l'adresse.
function RouteAvis() {
  const { code } = useParams()
  return <PageAvis key={code} code={code} />
}

function PageIntrouvable() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg text-slate-600">Adresse introuvable.</p>
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