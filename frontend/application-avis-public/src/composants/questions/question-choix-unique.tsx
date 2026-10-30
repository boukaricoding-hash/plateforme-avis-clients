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
              'flex min-h-12 w-full items-center gap-3 rounded-[var(--rayon-md)] border px-4 py-3 text-left text-base transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale ' +
              (choisie
                ? 'border-principale bg-surface font-semibold text-texte shadow-doux'
                : 'border-bordure-forte bg-surface/70 text-texte hover:border-principale')
            }
          >
            <span
              aria-hidden="true"
              className={
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ' +
                (choisie ? 'border-principale' : 'border-bordure-champ')
              }
            >
              {choisie ? <span className="h-2.5 w-2.5 rounded-full bg-principale" /> : null}
            </span>
            <span>{libelleOption(option, langue)}</span>
          </button>
        )
      })}
    </div>
  )
}