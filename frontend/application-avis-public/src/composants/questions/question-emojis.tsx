import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ProprietesQuestion } from './types-question'

// De tres mecontent (1) a tres content (5).
const EMOJIS = [
  { note: 1, symbole: '\u{1F620}' },
  { note: 2, symbole: '\u{1F641}' },
  { note: 3, symbole: '\u{1F610}' },
  { note: 4, symbole: '\u{1F642}' },
  { note: 5, symbole: '\u{1F60D}' },
]

// 5 emojis tactiles (56 px). Le client choisit une note de 1 a 5.
// L'emoji choisi est agrandi, sur une pastille claire au contour fin.
export function QuestionEmojis({ valeur, changer }: ProprietesQuestion) {
  const { t } = utiliserLangue()

  const noteChoisie = typeof valeur === 'number' ? valeur : 0

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="radiogroup" className="flex items-center justify-center gap-2">
        {EMOJIS.map(({ note, symbole }) => {
          const choisi = note === noteChoisie
          return (
            <button
              key={note}
              type="button"
              role="radio"
              aria-checked={choisi}
              aria-label={t('question.etoiles', { note })}
              onClick={() => changer(note)}
              className={
                'flex h-14 w-14 items-center justify-center rounded-full border text-3xl transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale ' +
                (choisi
                  ? 'scale-110 border-principale bg-surface shadow-moyen'
                  : noteChoisie > 0
                    ? 'border-transparent opacity-50'
                    : 'border-transparent')
              }
            >
              <span aria-hidden="true">{symbole}</span>
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