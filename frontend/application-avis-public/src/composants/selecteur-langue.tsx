import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/avis-public'

const LANGUES: Langue[] = ['fr', 'en']

// Deux boutons : Francais et English. Zones tactiles de 44 px minimum.
export function SelecteurLangue() {
  const { langue, changerLangue, t } = utiliserLangue()

  const libelles: Record<Langue, string> = {
    fr: t('commun.francais'),
    en: t('commun.anglais'),
  }

  return (
    <div
      role="group"
      aria-label={t('commun.langue')}
      className="inline-flex rounded-full border border-slate-300 bg-white p-1"
    >
      {LANGUES.map((code) => {
        const actif = code === langue
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={actif}
            onClick={() => changerLangue(code)}
            className={
              'min-h-11 min-w-11 rounded-full px-4 text-sm font-semibold transition-colors ' +
              (actif
                ? 'bg-[var(--couleur-principale)] text-white'
                : 'text-slate-700 hover:bg-slate-100')
            }
          >
            {libelles[code]}
          </button>
        )
      })}
    </div>
  )
}