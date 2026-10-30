import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/avis-public'

// Icone de globe.
function IconeGlobe() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  )
}

// Un seul petit bouton : icone de globe + langue actuelle (FR ou EN), avec une bordure fine.
// Un clic change directement de langue, sans menu. Zone tactile de 44 px minimum.
export function SelecteurLangue() {
  const { langue, changerLangue, t } = utiliserLangue()

  const autre: Langue = langue === 'fr' ? 'en' : 'fr'
  const libelles: Record<Langue, string> = {
    fr: t('commun.francais'),
    en: t('commun.anglais'),
  }

  return (
    <button
      type="button"
      lang={autre}
      aria-label={`${t('commun.langue')} : ${libelles[autre]}`}
      onClick={() => changerLangue(autre)}
      className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--rayon-sm)] border border-bordure-forte px-3 text-sm font-semibold uppercase tracking-wide text-texte transition hover:bg-surface/60 active:scale-95"
    >
      <IconeGlobe />
      {langue}
    </button>
  )
}