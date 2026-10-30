import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ProprietesQuestion } from './types-question'

// Meme limite que le backend (validations/avis.ts).
const LONGUEUR_MAX = 2000

// Texte libre : une zone de saisie sur plusieurs lignes.
// La valeur envoyee est le texte tel que tape (le backend retire les espaces autour).
export function QuestionTexteLibre({ valeur, changer }: ProprietesQuestion) {
  const { t } = utiliserLangue()

  const texte = typeof valeur === 'string' ? valeur : ''

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={texte}
        onChange={(evenement) => changer(evenement.target.value)}
        placeholder={t('question.placeholderTexte')}
        maxLength={LONGUEUR_MAX}
        rows={6}
        // text-base (16 px) evite le zoom automatique sur iPhone a la selection du champ.
        className="min-h-40 w-full resize-none rounded-[var(--rayon-md)] border border-bordure-champ bg-surface p-4 text-base text-texte outline-none transition placeholder:text-texte-discret focus:border-principale focus:shadow-doux"
      />
      <p className="text-right text-sm text-texte-discret" aria-hidden="true">
        {texte.length} / {LONGUEUR_MAX}
      </p>
    </div>
  )
}