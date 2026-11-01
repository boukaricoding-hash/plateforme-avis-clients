import { useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../hooks/utiliser-utilisateur'
import type { Langue } from '../types/langue'

type Proprietes = {
  onOuvrirMenu: () => void
}

export function BarreHaut({ onOuvrirMenu }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false)

  async function surDeconnexion() {
    setDeconnexionEnCours(true)
    await seDeconnecter()
  }

  function boutonLangue(code: Langue, libelle: string, nom: string) {
    const actif = langue === code
    return (
      <button
        type="button"
        onClick={() => changerLangue(code)}
        aria-pressed={actif}
        aria-label={nom}
        className={`min-h-11 min-w-11 rounded-md px-2 text-sm font-semibold transition-colors ${
          actif
            ? 'bg-principale text-texte-sur-principale'
            : 'text-texte-secondaire hover:bg-fond-alt'
        }`}
      >
        {libelle}
      </button>
    )
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-bordure bg-surface px-3 sm:px-5">
      {/* Bouton du menu : tablette et telephone seulement */}
      <button
        type="button"
        onClick={onOuvrirMenu}
        aria-label={t('menu.ouvrir')}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-texte hover:bg-fond-alt lg:hidden"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
          <path d="M3 18h18v-2H3v2Zm0-5h18v-2H3v2Zm0-7v2h18V6H3Z" />
        </svg>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1" role="group" aria-label={t('commun.langue')}>
        {boutonLangue('fr', 'FR', t('commun.francais'))}
        {boutonLangue('en', 'EN', t('commun.anglais'))}
      </div>

      {utilisateur !== null && (
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-semibold text-texte">{utilisateur.nom}</p>
          <p className="text-xs text-texte-secondaire">{t(`roles.${utilisateur.role}`)}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void surDeconnexion()}
        disabled={deconnexionEnCours}
        className="min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-medium text-texte transition-colors hover:bg-fond-alt disabled:opacity-60"
      >
        {deconnexionEnCours ? t('barreHaut.deconnexionEnCours') : t('barreHaut.deconnexion')}
      </button>
    </header>
  )
}