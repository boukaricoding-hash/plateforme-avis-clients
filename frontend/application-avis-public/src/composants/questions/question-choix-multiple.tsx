import { utiliserLangue } from '../../hooks/utiliser-langue'
import { libelleOption, valeurOption } from '../../utilitaires/valeur-option'
import type { ProprietesQuestion } from './types-question'

// Choix multiple : le client peut cocher plusieurs options.
// La valeur envoyee est un tableau de valeurs d'options (valeurOption).
export function QuestionChoixMultiple({ question, valeur, changer }: ProprietesQuestion) {
  const { langue, t } = utiliserLangue()

  const options = question.options ?? []
  const valeursChoisies: string[] = Array.isArray(valeur) ? valeur : []

  // Ajoute l'option si elle n'est pas cochee, la retire sinon.
  // L'ordre du tableau suit l'ordre des options de la question.
  function basculer(valeurDeLOption: string) {
    const dejaCochee = valeursChoisies.includes(valeurDeLOption)
    const nouvelles = dejaCochee
      ? valeursChoisies.filter((v) => v !== valeurDeLOption)
      : [...valeursChoisies, valeurDeLOption]
    const ordonnees = options
      .map((option) => valeurOption(option))
      .filter((v) => nouvelles.includes(v))
    changer(ordonnees)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">{t('question.plusieursReponses')}</p>
      <div role="group" className="flex flex-col gap-3">
        {options.map((option) => {
          const valeurDeLOption = valeurOption(option)
          const cochee = valeursChoisies.includes(valeurDeLOption)
          return (
            <button
              key={valeurDeLOption}
              type="button"
              role="checkbox"
              aria-checked={cochee}
              onClick={() => basculer(valeurDeLOption)}
              className={
                'flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-colors ' +
                (cochee
                  ? 'border-[var(--couleur-principale)] bg-white font-semibold text-slate-900'
                  : 'border-slate-300 bg-white text-slate-700')
              }
            >
              <span
                aria-hidden="true"
                className={
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ' +
                  (cochee
                    ? 'border-[var(--couleur-principale)] bg-[var(--couleur-principale)]'
                    : 'border-slate-300')
                }
              >
                {cochee ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 stroke-white"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </span>
              <span>{libelleOption(option, langue)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}