import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Theme } from '../types/theme'
import { ContexteTheme } from './contexte-theme'
import type { ValeurContexteTheme } from './contexte-theme'

const CLE_STOCKAGE = 'tableau-de-bord.theme'

// Couleur de la barre du navigateur sur telephone, pour chaque theme.
const COULEURS_BARRE: Record<Theme, string> = {
  clair: '#faf8f4',
  sombre: '#080808',
}

// Theme de depart : le choix deja fait sur cet appareil, sinon le reglage du systeme
// (clair si le systeme est en clair, sombre dans tous les autres cas).
function themeDeDepart(): Theme {
  try {
    const memorise = window.localStorage.getItem(CLE_STOCKAGE)
    if (memorise === 'clair' || memorise === 'sombre') {
      return memorise
    }
  } catch {
    // Stockage indisponible : on retombe sur le reglage du systeme.
  }
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'clair'
  }
  return 'sombre'
}

type Proprietes = {
  children: ReactNode
}

export function FournisseurTheme({ children }: Proprietes) {
  const [theme, setTheme] = useState<Theme>(themeDeDepart)

  // Le theme est pose sur la balise html avant l'affichage : tout le CSS s'adapte.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', COULEURS_BARRE[theme])
  }, [theme])

  const basculerTheme = useCallback(() => {
    const nouveau: Theme = theme === 'clair' ? 'sombre' : 'clair'
    setTheme(nouveau)
    try {
      window.localStorage.setItem(CLE_STOCKAGE, nouveau)
    } catch {
      // Sans stockage, le choix vaut seulement pour cette visite.
    }
  }, [theme])

  const valeur = useMemo<ValeurContexteTheme>(
    () => ({ theme, basculerTheme }),
    [theme, basculerTheme],
  )

  return <ContexteTheme.Provider value={valeur}>{children}</ContexteTheme.Provider>
}