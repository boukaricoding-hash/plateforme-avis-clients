import { utiliserLangue } from '../hooks/utiliser-langue'

type Proprietes = {
  // Numero de la question affichee (a partir de 1).
  courant: number
  // Nombre total de questions.
  total: number
}

// Texte « Question 2 sur 8 » et barre qui se remplit.
export function BarreProgression({ courant, total }: Proprietes) {
  const { t } = utiliserLangue()

  const pourcentage = total > 0 ? Math.min(100, Math.round((courant / total) * 100)) : 0

  return (
    <div className="w-full">
      <p className="mb-2 text-sm font-medium text-slate-600">
        {t('question.progression', { courant, total })}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={courant}
        aria-label={t('question.progression', { courant, total })}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-[var(--couleur-principale)] transition-[width] duration-300"
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  )
}