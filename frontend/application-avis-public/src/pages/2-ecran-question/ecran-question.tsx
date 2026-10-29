import { useEffect, useMemo, useRef, useState } from 'react'
import { BarreProgression } from '../../composants/barre-progression'
import { QuestionParType } from '../../composants/questions/question-par-type'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { QuestionnairePublic, QuestionPublique, ValeurReponse } from '../../types/avis-public'
import { aUneReponse } from '../../utilitaires/reponse-donnee'
import { choisirTexte } from '../../utilitaires/textes-multilingues'

// Reponses donnees par le client, rangees par identifiant de question.
export type ReponsesParQuestion = Record<string, ValeurReponse>

type Proprietes = {
  donnees: QuestionnairePublic
  // Les reponses sont gardees par le parent : elles survivent a Retour et au changement d'ecran.
  reponses: ReponsesParQuestion
  changerReponse: (questionId: string, valeur: ValeurReponse) => void
  // Retour sur la premiere question : on revient a l'accueil (E1).
  retourAccueil: () => void
  // Suivant sur la derniere question : le jour 10 branche ici l'ecran E3.
  terminer: () => void
  // Question affichee au depart (0 = la premiere). Sert au retour depuis E3.
  indexInitial?: number
}

// Ecran E2 : une question par ecran, barre de progression, boutons Retour et Suivant.
// Une question obligatoire sans reponse bloque le bouton Suivant.
export function EcranQuestion({
  donnees,
  reponses,
  changerReponse,
  retourAccueil,
  terminer,
  indexInitial = 0,
}: Proprietes) {
  const { langue, t } = utiliserLangue()

  // Questions dans l'ordre voulu par le questionnaire.
  const questions = useMemo(
    () => [...donnees.questionnaire.questions].sort((a, b) => a.ordre - b.ordre),
    [donnees],
  )
  const total = questions.length

  const [index, setIndex] = useState(() =>
    Math.min(Math.max(indexInitial, 0), Math.max(total - 1, 0)),
  )
  // Vrai apres un clic sur Suivant sans reponse a une question obligatoire.
  const [blocage, setBlocage] = useState(false)

  const titreRef = useRef<HTMLHeadingElement>(null)

  // A chaque nouvelle question : retour en haut et focus sur le titre (lecteurs d'ecran).
  useEffect(() => {
    window.scrollTo(0, 0)
    titreRef.current?.focus()
  }, [index])

  const question: QuestionPublique | undefined = questions[index]

  if (question === undefined) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-base text-slate-700">{t('commun.erreurGenerique')}</p>
        <button
          type="button"
          onClick={retourAccueil}
          className="flex h-14 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-8 text-lg font-semibold text-slate-700"
        >
          {t('question.retour')}
        </button>
      </main>
    )
  }

  const reponse: ValeurReponse | undefined = reponses[question.id]
  const manqueReponse = question.obligatoire && !aUneReponse(reponse)
  const aide = choisirTexte(question.aide, langue)

  function allerSuivant() {
    if (manqueReponse) {
      setBlocage(true)
      return
    }
    setBlocage(false)
    if (index < total - 1) {
      setIndex(index + 1)
    } else {
      terminer()
    }
  }

  function allerRetour() {
    setBlocage(false)
    if (index > 0) {
      setIndex(index - 1)
    } else {
      retourAccueil()
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
      <BarreProgression courant={index + 1} total={total} />

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1
            ref={titreRef}
            tabIndex={-1}
            className="text-2xl font-bold text-slate-900 outline-none"
          >
            {choisirTexte(question.libelle, langue)}
          </h1>
          {aide !== '' ? <p className="text-base text-slate-600">{aide}</p> : null}
        </div>

        <QuestionParType
          key={question.id}
          question={question}
          valeur={reponse}
          changer={(valeur) => {
            changerReponse(question.id, valeur)
            setBlocage(false)
          }}
        />

        {blocage && manqueReponse ? (
          <p role="alert" className="text-base font-medium text-red-600">
            {t('question.obligatoire')}
          </p>
        ) : null}
      </section>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <button
          type="button"
          onClick={allerRetour}
          className="flex h-14 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold text-slate-700 active:opacity-90"
        >
          {t('question.retour')}
        </button>
        <button
          type="button"
          onClick={allerSuivant}
          className="flex h-14 items-center justify-center rounded-xl bg-[var(--couleur-principale)] text-lg font-semibold text-white shadow-sm active:opacity-90"
        >
          {t('question.suivant')}
        </button>
      </div>
    </main>
  )
}