import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserTheme } from '../hooks/utiliser-theme'

// Bouton rond qui passe du theme sombre au theme clair, et inversement.
// Il montre le theme vers lequel on va : un soleil en sombre, une lune en clair.
export function BoutonTheme() {
  const { t } = utiliserLangue()
  const { theme, basculerTheme } = utiliserTheme()
  const versClair = theme === 'sombre'
  const libelle = t(versClair ? 'commun.themeClair' : 'commun.themeSombre')

  return (
    <button
      type="button"
      onClick={basculerTheme}
      aria-label={libelle}
      title={libelle}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-texte-secondaire transition-colors hover:bg-accent-fond hover:text-texte"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {versClair ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </button>
  )
}