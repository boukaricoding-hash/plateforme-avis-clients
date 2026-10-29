import { utiliserLangue } from '../../hooks/utiliser-langue'
import { libelleOption, valeurOption } from '../../utilitaires/valeur-option'
import type { ProprietesQuestion } from './types-question'

// Choix unique : une liste de gros boutons, un seul peut etre choisi.
// La valeur envoyee est celle de l'option (valeurOption), le texte affiche
// depend de la langue (libelleOption).
export function QuestionChoixUnique({ question, valeur, changer }: ProprietesQuestion) {
  const { langue } = utiliserLangue()

  const options = question.options ?? []
  const valeurChoisie = typeof valeur === 'string' ? valeur : null

  return (
    <div role="radiogroup" className="flex flex-col gap-3">
      {options.map((option) => {
        const valeurDeLOption = valeurOption(option)
        const choisie = valeurDeLOption === valeurChoisie
        return (
          <button
            key={valeurDeLOption}
            type="button"
            role="radio"
            aria-checked={choisie}
            onClick={() => changer(valeurDeLOption)}
            className={
              'flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-colors ' +
              (choisie
                ? 'border-[var(--couleur-principale)] bg-white font-semibold text-slate-900'
                : 'border-slate-300 bg-white text-slate-700')
            }
          >
            <span
              aria-hidden="true"
              className={
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ' +
                (choisie ? 'border-[var(--couleur-principale)]' : 'border-slate-300')
              }
            >
              {choisie ? (
                <span className="h-3 w-3 rounded-full bg-[var(--couleur-principale)]" />
              ) : null}
            </span>
            <span>{libelleOption(option, langue)}</span>
          </button>
        )
      })}
    </div>
  )
}