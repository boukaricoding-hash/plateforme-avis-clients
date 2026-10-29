import { utiliserLangue } from '../../hooks/utiliser-langue'
import { choisirTexte } from '../../utilitaires/textes-multilingues'
import type { ProprietesQuestion } from './types-question'

// Echelle : des boutons numerotes de echelle_min a echelle_max.
// Les libelles des extremites (ex. "Pas du tout" / "Tout a fait") sont facultatifs.
export function QuestionEchelle({ question, valeur, changer }: ProprietesQuestion) {
  const { langue } = utiliserLangue()

  const min = question.echelle_min ?? 1
  const max = question.echelle_max ?? 5

  const notes: number[] = []
  for (let note = min; note <= max; note++) {
    notes.push(note)
  }

  // Attention : 0 peut etre une vraie reponse, on teste donc le type.
  const noteChoisie = typeof valeur === 'number' ? valeur : null

  const extremites = question.libelles_extremites

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" className="flex flex-wrap items-center justify-center gap-2">
        {notes.map((note) => {
          const choisie = note === noteChoisie
          return (
            <button
              key={note}
              type="button"
              role="radio"
              aria-checked={choisie}
              onClick={() => changer(note)}
              className={
                'flex h-12 w-12 items-center justify-center rounded-xl border-2 text-lg font-semibold transition-colors ' +
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
      {extremites !== null ? (
        <div className="flex items-start justify-between gap-4 text-sm text-slate-500">
          <span className="max-w-[45%]">{choisirTexte(extremites.min, langue)}</span>
          <span className="max-w-[45%] text-right">{choisirTexte(extremites.max, langue)}</span>
        </div>
      ) : null}
    </div>
  )
}