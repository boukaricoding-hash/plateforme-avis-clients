import { useEffect, useMemo, useRef, useState } from 'react'
import { Mascotte } from '../../composants/mascotte'
import type { HumeurMascotte } from '../../composants/mascotte'
import { ProgressionBulles } from '../../composants/progression-bulles'
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

// Meme fond que l'accueil : peche tres clair en haut, beige, puis beige rose en bas.
const FOND_QUESTION =
  'linear-gradient(170deg, color-mix(in srgb, var(--couleur-decor-clair) 40%, var(--fond-alt)) 0%, var(--fond) 35%, var(--fond-alt) 62%, var(--surface-douce) 100%)'

// Mouvements du fond (les noms commencent par « question- »).
// Meme famille que l'accueil, mais pas identiques : le degrade glisse dans l'autre sens,
// et les vagues sont plus basses et plus lentes pour ne pas gener les reponses.
const STYLES = `
@keyframes question-lumiere {
  from { background-position: 0% 100%; }
  to { background-position: 0% 0%; }
}
@keyframes question-vague {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.question-fond {
  background-size: 100% 220%;
  animation: question-lumiere 32s ease-in-out infinite alternate;
}
.question-vague-1 {
  animation: question-vague 30s linear infinite reverse;
}
.question-vague-2 {
  animation: question-vague 19s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .question-fond,
  .question-vague-1,
  .question-vague-2 {
    animation: none;
  }
}
`

// Une vague : le dessin se repete deux fois (800 de large, periode 400),
// donc en la decalant de la moitie on retombe exactement sur le meme dessin.
const VAGUE = 'M0 50 C 100 10, 300 90, 400 50 C 500 10, 700 90, 800 50 L800 100 L0 100 Z'

// Decor : meme style que l'accueil (degrade qui glisse, trame de points fins, deux vagues basses),
// avec une autre disposition : la trame de points est plus visible en bas et s'efface vers le haut,
// et les vagues sont plus basses.
// Purement decoratif : cache aux lecteurs d'ecran et sans effet sur les clics.
function DecorQuestion() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <style>{STYLES}</style>

      {/* Degrade qui glisse */}
      <div
        className="question-fond absolute inset-0"
        style={{ background: FOND_QUESTION, backgroundSize: '100% 220%' }}
      />

      {/* Trame de points fins, plus visible en bas, effacee vers le haut */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{
          opacity: 0.07,
          WebkitMaskImage: 'linear-gradient(0deg, #000 0%, transparent 70%)',
          maskImage: 'linear-gradient(0deg, #000 0%, transparent 70%)',
        }}
      >
        <defs>
          <pattern id="question-points" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="1.2" style={{ fill: 'var(--texte)' }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#question-points)" />
      </svg>

      {/* Vagues : deux couches qui defilent doucement en sens inverses. */}
      <div className="question-vague-1 absolute bottom-0 left-0 h-28 w-[200%]">
        <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="h-full w-full">
          <path d={VAGUE} style={{ fill: 'var(--surface-douce)', fillOpacity: 0.9 }} />
        </svg>
      </div>
      <div className="question-vague-2 absolute bottom-0 left-0 h-20 w-[200%]">
        <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="h-full w-full">
          <path d={VAGUE} style={{ fill: 'var(--couleur-decor-clair)', fillOpacity: 0.4 }} />
        </svg>
      </div>
    </div>
  )
}

// Humeur de la mascotte selon la question et la reponse deja donnee :
// - texte libre : elle ecoute ;
// - une note (etoiles, emojis, NPS, echelle) : contente si la note est haute, triste si elle est basse ;
// - sinon : attentive.
function choisirHumeur(
  question: QuestionPublique,
  reponse: ValeurReponse | undefined,
): HumeurMascotte {
  if (question.type === 'TEXTE_LIBRE') {
    return 'ecoute'
  }
  // Oui / Non : la reponse est un booleen. Oui = contente, Non = triste.
  if (question.type === 'OUI_NON') {
    if (reponse === true) {
      return 'content'
    }
    if (reponse === false) {
      return 'triste'
    }
    return 'attentif'
  }
  if (typeof reponse !== 'number') {
    return 'attentif'
  }

  // Part de la note dans son echelle : 0 = la plus basse, 1 = la plus haute.
  let part: number | null = null
  switch (question.type) {
    case 'ETOILES':
    case 'EMOJIS':
      part = (reponse - 1) / 4
      break
    case 'NPS':
      part = reponse / 10
      break
    case 'ECHELLE': {
      const min = question.echelle_min ?? 1
      const max = question.echelle_max ?? 5
      part = max > min ? (reponse - min) / (max - min) : null
      break
    }
    default:
      part = null
  }

  if (part === null) {
    return 'attentif'
  }
  if (part >= 0.75) {
    return 'content'
  }
  if (part <= 0.25) {
    return 'triste'
  }
  return 'attentif'
}

// Fleche vers la gauche (retour).
function FlecheGauche() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

// Fleche vers la droite (suivant). Quand elle est prete, elle avance doucement en boucle.
function FlecheDroite({ anime }: { anime: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <g>
        {anime ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 2.5 0; 0 0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        ) : null}
        <path d="M9 5l7 7-7 7" />
      </g>
    </svg>
  )
}

// Ecran E2 : une question par ecran.
// En haut : la fleche de retour a gauche et la progression en bulles numerotees.
// Au centre : mascotte, question et reponses, empilees verticalement.
// La fleche Suivant est collee au bord droit de l'ecran, a la hauteur du milieu du bloc central.
// Une question obligatoire sans reponse rend la fleche pale, et un appui affiche le message.
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
  // Vrai apres un appui sur Suivant sans reponse a une question obligatoire.
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
      <div className="relative isolate min-h-svh w-full overflow-hidden">
        <DecorQuestion />
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-base text-texte-secondaire">{t('commun.erreurGenerique')}</p>
          <button
            type="button"
            onClick={retourAccueil}
            className="inline-flex h-12 items-center justify-center rounded-[var(--rayon-sm)] border-2 border-principale-fonce px-8 text-base font-semibold text-principale-fonce transition active:scale-95"
          >
            {t('question.retour')}
          </button>
        </main>
      </div>
    )
  }

  const reponse: ValeurReponse | undefined = reponses[question.id]
  const manqueReponse = question.obligatoire && !aUneReponse(reponse)
  const aide = choisirTexte(question.aide, langue)
  const humeur = choisirHumeur(question, reponse)

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
    <div className="relative isolate min-h-svh w-full overflow-hidden">
      <DecorQuestion />

      <main className="relative mx-auto flex min-h-svh w-full max-w-md flex-col pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Haut : retour a gauche, bulles au centre, une case vide a droite pour garder les bulles bien centrees. */}
        <div className="flex items-center justify-between gap-2 px-3">
          <button
            type="button"
            onClick={allerRetour}
            aria-label={t('question.retour')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-texte-secondaire transition hover:bg-surface/60 hover:text-texte active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale"
          >
            <FlecheGauche />
          </button>

          <ProgressionBulles courant={index + 1} total={total} />

          <span aria-hidden="true" className="h-11 w-11 shrink-0" />
        </div>

        {/* Centre : mascotte, question, reponses, puis la fleche Suivant a droite, le tout empile. */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6">
          <Mascotte humeur={humeur} taille={120} />

          {/* La cle fait rejouer l'apparition a chaque nouvelle question (la mascotte, elle, reste en place). */}
          <section
            key={question.id}
            className="flex w-full animate-monte flex-col items-center gap-6 motion-reduce:animate-none"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1
                ref={titreRef}
                tabIndex={-1}
                className="font-titre text-2xl font-semibold leading-snug text-texte outline-none"
              >
                {choisirTexte(question.libelle, langue)}
              </h1>
              {aide !== '' ? <p className="text-base text-texte-secondaire">{aide}</p> : null}
            </div>

            <div className="w-full">
              <QuestionParType
                key={question.id}
                question={question}
                valeur={reponse}
                changer={(valeur) => {
                  changerReponse(question.id, valeur)
                  setBlocage(false)
                }}
              />
            </div>

            {blocage && manqueReponse ? (
              <p role="alert" className="text-center text-base font-medium text-erreur">
                {t('question.obligatoire')}
              </p>
            ) : null}

            {/* Fleche Suivant : derniere ligne de la pile (juste apres les reponses, ex. « 1 sur 5 »), poussee a droite. */}
            <div className="flex w-full justify-end">
              <button
                type="button"
                onClick={allerSuivant}
                aria-label={t('question.suivant')}
                aria-disabled={manqueReponse}
                className={
                  'flex h-12 w-12 items-center justify-center rounded-full border border-bordure-forte bg-surface/60 text-principale-fonce backdrop-blur-sm transition hover:bg-surface active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale ' +
                  (manqueReponse ? 'opacity-50' : 'opacity-100')
                }
              >
                <FlecheDroite anime={!manqueReponse} />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}