import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ProprietesQuestion } from './types-question'

const NOTES = [1, 2, 3, 4, 5]

// 5 etoiles tactiles (48 px). Le client choisit une note de 1 a 5.
// Etoile choisie : couleur du decor (terracotta) ; etoile vide : fond clair et contour fin.
export function QuestionEtoiles({ valeur, changer }: ProprietesQuestion) {
  const { t } = utiliserLangue()

  const noteChoisie = typeof valeur === 'number' ? valeur : 0

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="radiogroup" className="flex items-center justify-center gap-1">
        {NOTES.map((note) => {
          const remplie = note <= noteChoisie
          return (
            <button
              key={note}
              type="button"
              role="radio"
              aria-checked={note === noteChoisie}
              aria-label={t('question.etoiles', { note })}
              onClick={() => changer(note)}
              className="flex h-12 w-12 items-center justify-center rounded-full transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={
                  'h-10 w-10 transition-colors ' +
                  (remplie
                    ? 'fill-decor stroke-principale-fonce'
                    : 'fill-surface stroke-bordure-forte')
                }
                strokeWidth="1.2"
                strokeLinejoin="round"
              >
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
              </svg>
            </button>
          )
        })}
      </div>
      <p className="min-h-6 text-base font-medium text-texte-secondaire" aria-live="polite">
        {noteChoisie > 0 ? t('question.etoiles', { note: noteChoisie }) : ''}
      </p>
    </div>
  )
}