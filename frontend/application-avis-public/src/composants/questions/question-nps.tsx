import { utiliserLangue } from '../../hooks/utiliser-langue'
import { choisirTexte } from '../../utilitaires/textes-multilingues'
import type { ProprietesQuestion } from './types-question'

// Les 11 notes du NPS : 0 a 10.
const NOTES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Echelle NPS tactile (0 a 10), sur 2 lignes pour tenir sur un petit telephone.
// Libelles des extremites : ceux de la question s'ils existent,
// sinon ceux des traductions (npsMin / npsMax).
export function QuestionNps({ question, valeur, changer }: ProprietesQuestion) {
  const { langue, t } = utiliserLangue()

  // Attention : 0 est une vraie reponse, on teste donc le type et non "valeur > 0".
  const noteChoisie = typeof valeur === 'number' ? valeur : null

  const libelleMin =
    question.libelles_extremites !== null
      ? choisirTexte(question.libelles_extremites.min, langue)
      : t('question.npsMin')
  const libelleMax =
    question.libelles_extremites !== null
      ? choisirTexte(question.libelles_extremites.max, langue)
      : t('question.npsMax')

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" className="grid grid-cols-6 gap-2">
        {NOTES.map((note) => {
          const choisie = note === noteChoisie
          return (
            <button
              key={note}
              type="button"
              role="radio"
              aria-checked={choisie}
              onClick={() => changer(note)}
              className={
                'flex h-12 min-w-11 items-center justify-center rounded-xl border-2 text-lg font-semibold transition-colors ' +
                (choisie
                  ? 'border-[var(--couleur-principale)] bg-[var(--couleur-principale)] text-white'
                  : 'border-slate-300 bg-white text-slate-700')
              }
            >
              {note}
            </button>
          )
        })}
      </div>
      <div className="flex items-start justify-between gap-4 text-sm text-slate-500">
        <span className="max-w-[45%]">{libelleMin}</span>
        <span className="max-w-[45%] text-right">{libelleMax}</span>
      </div>
    </div>
  )
}