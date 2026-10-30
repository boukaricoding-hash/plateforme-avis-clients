import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ProprietesQuestion } from './types-question'

// Oui / Non : deux gros boutons cote a cote.
// La valeur envoyee est un booleen : true pour Oui, false pour Non.
export function QuestionOuiNon({ valeur, changer }: ProprietesQuestion) {
  const { t } = utiliserLangue()

  // Attention : false est une vraie reponse (Non), on teste donc le type.
  const reponse = typeof valeur === 'boolean' ? valeur : null

  const choix = [
    { valeur: true, texte: t('question.oui') },
    { valeur: false, texte: t('question.non') },
  ]

  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {choix.map((element) => {
        const choisi = reponse === element.valeur
        return (
          <button
            key={String(element.valeur)}
            type="button"
            role="radio"
            aria-checked={choisi}
            onClick={() => changer(element.valeur)}
            className={
              'flex h-16 items-center justify-center rounded-[var(--rayon-md)] border text-lg font-semibold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale ' +
              (choisi
                ? 'border-principale bg-principale text-texte-sur-principale shadow-doux'
                : 'border-bordure-forte bg-surface/70 text-texte hover:border-principale')
            }
          >
            {element.texte}
          </button>
        )
      })}
    </div>
  )
}